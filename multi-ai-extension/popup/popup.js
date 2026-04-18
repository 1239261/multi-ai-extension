const MESSAGE_TYPES = {
  SEND_QUESTION: 'SEND_QUESTION',
  QUESTION_SENT: 'QUESTION_SENT',
  AI_RESPONSE: 'AI_RESPONSE',
  ALL_RESPONSES_COMPLETE: 'ALL_RESPONSES_COMPLETE',
  GET_HISTORY: 'GET_HISTORY',
  HISTORY_RESPONSE: 'HISTORY_RESPONSE',
  GET_SETTINGS: 'GET_SETTINGS',
  SETTINGS_RESPONSE: 'SETTINGS_RESPONSE',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  CANCEL_REQUEST: 'CANCEL_REQUEST'
};

const PROVIDER_NAMES = {
  qwen: '通义千问',
  yuanbao: '元宝',
  deepseek: 'DeepSeek',
  doubao: '豆包'
};

const PROVIDER_LOGOS = {
  qwen: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="20" font-size="20">🎯</text></svg>',
  yuanbao: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="20" font-size="20">💎</text></svg>',
  deepseek: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="20" font-size="20">🔍</text></svg>',
  doubao: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="20" font-size="20">🫛</text></svg>'
};

const RESPONSE_STATUS_TEXT = {
  success: '已完成',
  error: '错误',
  timeout: '超时',
  login_required: '需登录',
  cancelled: '已取消',
  disconnected: '未连接',
  busy: '处理中'
};

let currentConversationId = null;
let currentProviders = [];
let pendingResponses = new Map();
let settings = {};

function $(selector) {
  return document.querySelector(selector);
}

function $$(selector) {
  return document.querySelectorAll(selector);
}

async function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

function createPort() {
  return new Promise((resolve) => {
    const port = chrome.runtime.connect({ name: 'popup' });
    port.onMessage.addListener((message) => {
      handlePortMessage(message);
    });
    port.onDisconnect.addListener(() => {
      console.log('Port disconnected');
    });
    resolve(port);
  });
}

let popupPort = null;

async function init() {
  popupPort = await createPort();

  loadSettings();
  setupEventListeners();
  updateStatusBar([]);
  showEmptyState();
}

async function loadSettings() {
  try {
    const response = await sendMessage({ type: MESSAGE_TYPES.GET_SETTINGS, target: 'background' });
    if (response.success) {
      settings = response.settings;
      currentProviders = settings.enabledProviders || Object.keys(PROVIDER_NAMES);
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
    currentProviders = Object.keys(PROVIDER_NAMES);
  }
}

function setupEventListeners() {
  $('#btn-send').addEventListener('click', handleSend);
  $('#btn-history').addEventListener('click', showHistory);
  $('#btn-close-history').addEventListener('click', hideHistory);
  $('#btn-settings').addEventListener('click', showSettings);
  $('#btn-close-settings').addEventListener('click', hideSettings);
  $('#question-input').addEventListener('input', handleInputChange);
  $('#question-input').addEventListener('keydown', handleInputKeydown);
}

function handleInputChange(e) {
  const value = e.target.value;
  const charCount = $('#char-count');
  charCount.textContent = `${value.length} / 10000`;
  
  if (value.length > 10000) {
    charCount.style.color = 'var(--error-color)';
  } else {
    charCount.style.color = 'var(--text-secondary)';
  }
}

function handleInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    handleSend();
  }
}

async function handleSend() {
  const input = $('#question-input');
  const question = input.value.trim();

  if (!question) {
    showError('请输入问题内容');
    return;
  }

  if (question.length > 10000) {
    showError('问题内容不能超过10000个字符');
    return;
  }

  $('#btn-send').disabled = true;
  currentConversationId = null;
  pendingResponses.clear();

  clearResponses();
  updateStatusBar(currentProviders.map(p => ({ provider: p, status: 'busy' })));

  try {
    const response = await sendMessage({
      type: MESSAGE_TYPES.SEND_QUESTION,
      target: 'background',
      question
    });

    if (response.success) {
      currentConversationId = response.conversationId;
      currentProviders = response.providers;
      initResponseCards(response.providers);
      updateFooterStatus('等待响应...');
    } else {
      showError(getErrorMessage(response.error));
      resetSendButton();
    }
  } catch (error) {
    showError('发送失败: ' + error.message);
    resetSendButton();
  }
}

function handlePortMessage(message) {
  console.log('Received message from background:', message);

  switch (message.type) {
    case MESSAGE_TYPES.QUESTION_SENT:
      currentConversationId = message.conversationId;
      break;

    case MESSAGE_TYPES.AI_RESPONSE:
      updateResponseCard(message.provider, message.content, message.status);
      pendingResponses.set(message.provider, message.status);
      updateOverallStatus();
      break;

    case MESSAGE_TYPES.ALL_RESPONSES_COMPLETE:
      currentConversationId = null;
      resetSendButton();
      updateFooterStatus('完成');
      break;
  }
}

function initResponseCards(providers) {
  const grid = $('#response-grid');
  grid.innerHTML = '';

  providers.forEach(provider => {
    const card = createResponseCard(provider);
    grid.appendChild(card);
  });
}

function createResponseCard(provider) {
  const card = document.createElement('div');
  card.className = 'response-card';
  card.id = `card-${provider}`;

  card.innerHTML = `
    <div class="response-card-header">
      <div class="response-card-title">
        <img class="response-card-logo" src="${PROVIDER_LOGOS[provider] || ''}" alt="${PROVIDER_NAMES[provider] || provider}">
        <span>${PROVIDER_NAMES[provider] || provider}</span>
      </div>
      <span class="response-card-status busy">等待中</span>
    </div>
    <div class="response-card-body loading">
      <div class="loading-spinner"></div>
      <span>等待响应...</span>
    </div>
  `;

  return card;
}

function updateResponseCard(provider, content, status) {
  const card = $(`#card-${provider}`);
  if (!card) return;

  const statusEl = card.querySelector('.response-card-status');
  const bodyEl = card.querySelector('.response-card-body');

  statusEl.textContent = RESPONSE_STATUS_TEXT[status] || status;
  statusEl.className = `response-card-status ${status}`;

  bodyEl.classList.remove('loading');
  bodyEl.innerHTML = '';

  switch (status) {
    case 'success':
      bodyEl.innerHTML = `<div class="markdown-content">${renderMarkdown(content)}</div>`;
      break;
    case 'timeout':
      bodyEl.innerHTML = `<div class="timeout-message">AI响应超时</div>`;
      break;
    case 'login_required':
      bodyEl.innerHTML = `
        <div class="error-message">
          请先登录 ${PROVIDER_NAMES[provider] || provider}
          <a href="${getProviderUrl(provider)}" target="_blank" class="login-link">前往登录</a>
        </div>
      `;
      break;
    case 'error':
      bodyEl.innerHTML = `<div class="error-message">发生错误，请稍后重试</div>`;
      break;
    case 'disconnected':
      bodyEl.innerHTML = `
        <div class="error-message">
          未检测到 ${PROVIDER_NAMES[provider] || provider} 页面
          <br><small>请先打开对应的AI网站</small>
        </div>
      `;
      break;
    default:
      bodyEl.innerHTML = `<div class="error-message">状态: ${status}</div>`;
  }
}

function getProviderUrl(provider) {
  const urls = {
    qwen: 'https://qwen.ai/',
    yuanbao: 'https://yuanbao.tencent.com/',
    deepseek: 'https://chat.deepseek.com/',
    doubao: 'https://doubao.com/'
  };
  return urls[provider] || '#';
}

function renderMarkdown(text) {
  if (!text) return '';
  
  let html = text
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  
  html = '<p>' + html + '</p>';
  
  html = html.replace(/<p><(h[123]|pre|ul|ol|li)>/g, '<$1>');
  html = html.replace(/<\/(h[123]|pre|ul|ol|li)><\/p>/g, '</$1>');
  html = html.replace(/<p><li>/g, '<li>');
  html = html.replace(/<\/li><\/p>/g, '</li>');

  return html;
}

function updateOverallStatus() {
  let allComplete = true;
  let hasError = false;

  pendingResponses.forEach((status) => {
    if (status === 'busy') {
      allComplete = false;
    } else if (status === 'error' || status === 'timeout') {
      hasError = true;
    }
  });

  if (allComplete) {
    resetSendButton();
    updateFooterStatus('完成');
  }
}

function updateStatusBar(statusList) {
  const statusBar = $('#status-bar');
  statusBar.innerHTML = '';

  const allProviders = currentProviders.length > 0 ? currentProviders : Object.keys(PROVIDER_NAMES);

  allProviders.forEach(provider => {
    const status = statusList.find(s => s.provider === provider)?.status || 'disconnected';
    const indicator = document.createElement('div');
    indicator.className = `status-indicator ${status}`;
    indicator.innerHTML = `
      <span class="status-dot"></span>
      <span>${PROVIDER_NAMES[provider] || provider}</span>
    `;
    statusBar.appendChild(indicator);
  });
}

function updateFooterStatus(text) {
  $('#footer-status').textContent = text;
}

function clearResponses() {
  $('#response-grid').innerHTML = '';
}

function showEmptyState() {
  const grid = $('#response-grid');
  grid.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">💬</div>
      <div class="empty-state-text">输入问题并发送，开始多AI查询</div>
    </div>
  `;
}

function showError(message) {
  updateFooterStatus(message);
}

function resetSendButton() {
  $('#btn-send').disabled = false;
}

async function showHistory() {
  $('#section-input').classList.add('hidden');
  $('#section-status').classList.add('hidden');
  $('#section-responses').classList.add('hidden');
  $('#section-history').classList.remove('hidden');
  $('#section-settings').classList.add('hidden');

  try {
    const response = await sendMessage({ type: MESSAGE_TYPES.GET_HISTORY, target: 'background' });
    if (response.success) {
      renderHistory(response.conversations || []);
    }
  } catch (error) {
    console.error('Failed to load history:', error);
  }
}

function hideHistory() {
  $('#section-history').classList.add('hidden');
  $('#section-input').classList.remove('hidden');
  $('#section-status').classList.remove('hidden');
  $('#section-responses').classList.remove('hidden');
}

function renderHistory(conversations) {
  const list = $('#history-list');
  
  if (conversations.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-text">暂无历史记录</div></div>';
    return;
  }

  list.innerHTML = conversations.map(conv => `
    <div class="history-item" data-id="${conv.id}">
      <div class="history-item-content">
        <div class="history-item-question">${escapeHtml(conv.question)}</div>
        <div class="history-item-meta">${formatDate(conv.timestamp)} · ${conv.responses.length} 个回复</div>
      </div>
      <button class="history-item-delete" data-id="${conv.id}">删除</button>
    </div>
  `).join('');

  list.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (!e.target.classList.contains('history-item-delete')) {
        loadConversation(item.dataset.id, conversations);
      }
    });
  });

  list.querySelectorAll('.history-item-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteConversation(btn.dataset.id);
    });
  });
}

async function loadConversation(id, conversations) {
  const conv = conversations.find(c => c.id === id);
  if (!conv) return;

  hideHistory();
  clearResponses();
  
  $('#question-input').value = conv.question;
  handleInputChange({ target: $('#question-input') });

  initResponseCards(conv.responses.map(r => r.provider));
  
  conv.responses.forEach(response => {
    updateResponseCard(response.provider, response.content, response.status);
  });

  updateFooterStatus('已加载历史对话');
}

async function deleteConversation(id) {
  try {
    await chrome.storage.local.get('multi_ai_conversations', (result) => {
      const conversations = result.multi_ai_conversations || [];
      const filtered = conversations.filter(c => c.id !== id);
      chrome.storage.local.set({ multi_ai_conversations: filtered }, () => {
        showHistory();
      });
    });
  } catch (error) {
    console.error('Failed to delete conversation:', error);
  }
}

async function showSettings() {
  $('#section-input').classList.add('hidden');
  $('#section-status').classList.add('hidden');
  $('#section-responses').classList.add('hidden');
  $('#section-history').classList.add('hidden');
  $('#section-settings').classList.remove('hidden');

  renderSettings();
}

function hideSettings() {
  $('#section-settings').classList.add('hidden');
  $('#section-input').classList.remove('hidden');
  $('#section-status').classList.remove('hidden');
  $('#section-responses').classList.remove('hidden');
}

function renderSettings() {
  const content = $('#settings-content');
  
  content.innerHTML = `
    <div class="settings-group">
      <label class="settings-group-label">启用的AI平台</label>
      <div class="settings-checkbox-group">
        ${Object.entries(PROVIDER_NAMES).map(([key, name]) => `
          <label class="settings-checkbox">
            <input type="checkbox" name="provider" value="${key}" 
              ${(settings.enabledProviders || Object.keys(PROVIDER_NAMES)).includes(key) ? 'checked' : ''}>
            ${name}
          </label>
        `).join('')}
      </div>
    </div>

    <div class="settings-group">
      <label class="settings-group-label">响应超时时间</label>
      <div class="settings-range">
        <input type="range" id="timeout-range" min="10" max="60" value="${settings.timeoutSeconds || 30}">
        <span class="settings-range-value" id="timeout-value">${settings.timeoutSeconds || 30}秒</span>
      </div>
    </div>

    <div class="settings-group">
      <label class="settings-checkbox">
        <input type="checkbox" id="auto-save-checkbox" 
          ${settings.autoSaveHistory !== false ? 'checked' : ''}>
        自动保存历史记录
      </label>
    </div>

    <div class="settings-danger-zone">
      <button class="btn-danger" id="btn-clear-history">清除所有历史记录</button>
    </div>
  `;

  $('#timeout-range').addEventListener('input', (e) => {
    $('#timeout-value').textContent = e.target.value + '秒';
  });

  $('#timeout-range').addEventListener('change', saveSettingsFromUI);
  $('#auto-save-checkbox').addEventListener('change', saveSettingsFromUI);
  
  $$('input[name="provider"]').forEach(cb => {
    cb.addEventListener('change', saveSettingsFromUI);
  });

  $('#btn-clear-history').addEventListener('click', async () => {
    if (confirm('确定要清除所有历史记录吗？此操作不可撤销。')) {
      try {
        await chrome.storage.local.set({ multi_ai_conversations: [] });
        alert('历史记录已清除');
      } catch (error) {
        console.error('Failed to clear history:', error);
      }
    }
  });
}

async function saveSettingsFromUI() {
  const enabledProviders = Array.from($$('input[name="provider"]:checked')).map(cb => cb.value);
  const timeoutSeconds = parseInt($('#timeout-range').value, 10);
  const autoSaveHistory = $('#auto-save-checkbox').checked;

  settings = {
    enabledProviders,
    timeoutSeconds,
    autoSaveHistory
  };

  currentProviders = enabledProviders;
  updateStatusBar([]);

  try {
    await sendMessage({
      type: MESSAGE_TYPES.UPDATE_SETTINGS,
      target: 'background',
      settings
    });
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  
  return date.toLocaleDateString('zh-CN');
}

function getErrorMessage(errorCode) {
  const messages = {
    EMPTY_QUESTION: '请输入问题内容',
    QUESTION_TOO_LONG: '问题内容不能超过10000个字符',
    NETWORK_ERROR: '网络连接失败，请检查网络'
  };
  return messages[errorCode] || '发生错误: ' + errorCode;
}

document.addEventListener('DOMContentLoaded', init);
