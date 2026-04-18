class QwenProvider extends BaseProvider {
  constructor() {
    super('qwen');
    
    this.selectors = {
      input: 'textarea[placeholder*="输入"], textarea[placeholder*="问题"], div[contenteditable="true"]',
      submitButton: 'button[type="submit"], button:has-text("发送"), button:has-text("提交")',
      responseContainer: '.response-content, .message-content, [class*="response"]',
      loadingIndicator: '.loading, [class*="generating"]'
    };
  }

  isAtChatPage() {
    return this.getCurrentUrl().includes('qwen.ai') || this.getCurrentUrl().includes('qwen.cn');
  }

  async injectAndSubmit(question) {
    await this.waitForPageReady();
    
    const inputEl = await this.findInputElement();
    if (!inputEl) {
      throw new Error('Input element not found');
    }

    await this.fillInput(inputEl, question);
    await this.sleep(300);
    
    const submitBtn = await this.findSubmitButton();
    if (submitBtn) {
      submitBtn.click();
    } else {
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', ctrlKey: true }));
    }
  }

  async waitForPageReady() {
    await this.sleep(1000);
    let retries = 0;
    while (retries < 10) {
      if (document.querySelector(this.selectors.input) || await this.findInputElement()) {
        return;
      }
      await this.sleep(500);
      retries++;
    }
  }

  async findInputElement() {
    const selectors = [
      'textarea[placeholder*="输入"]',
      'textarea[placeholder*="问题"]',
      'textarea[placeholder*="请"]',
      'div[contenteditable="true"]',
      '[role="textbox"]',
      'div[contenteditable]'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && this.isVisible(el)) {
        return el;
      }
    }
    return null;
  }

  async findSubmitButton() {
    const selectors = [
      'button[type="submit"]',
      'button:has-text("发送")',
      'button:has-text("提交")',
      'button:has-text("问")',
      '[class*="send"] button',
      '[class*="submit"] button'
    ];

    for (const selector of selectors) {
      try {
        const el = document.querySelector(selector);
        if (el && this.isVisible(el) && !el.disabled) {
          return el;
        }
      } catch (e) {
        // Skip invalid selectors
      }
    }
    return null;
  }

  async fillInput(element, text) {
    element.focus();
    
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      element.value = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      for (const char of text) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        
        document.execCommand('insertText', false, char);
        await this.sleep(5);
      }
    }
  }

  isResponseReady() {
    const loading = document.querySelector(this.selectors.loadingIndicator);
    if (loading && this.isVisible(loading)) {
      return false;
    }

    const responseEls = document.querySelectorAll(this.selectors.responseContainer);
    for (const el of responseEls) {
      if (this.isVisible(el) && el.textContent.trim().length > 0) {
        const currentResponse = el.textContent;
        if (currentResponse !== this.lastResponse) {
          this.lastResponse = currentResponse;
          return true;
        }
      }
    }

    return false;
  }

  async extractResponse() {
    await this.waitForResponse();
    
    const responseEls = document.querySelectorAll(this.selectors.responseContainer);
    let lastResponse = '';
    
    for (const el of responseEls) {
      if (this.isVisible(el) && el.textContent.trim().length > 0) {
        lastResponse = el.textContent.trim();
      }
    }

    if (!lastResponse) {
      const allText = document.body.innerText;
      const lines = allText.split('\n').filter(l => l.trim().length > 0);
      lastResponse = lines.slice(-10).join('\n');
    }

    return lastResponse;
  }

  isVisible(element) {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           element.offsetParent !== null;
  }

  checkLoginStatus() {
    const loginIndicators = [
      'button:has-text("登录")',
      'button:has-text("Sign in")',
      '[href*="login"]',
      '[href*="signin"]'
    ];

    for (const selector of loginIndicators) {
      try {
        const el = document.querySelector(selector);
        if (el && this.isVisible(el)) {
          return false;
        }
      } catch (e) {
        // Skip invalid selectors
      }
    }
    return true;
  }
}

const provider = new QwenProvider();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FORWARD_TO_PROVIDER' && message.provider === 'qwen') {
    provider.submitQuestion(message.question)
      .then(response => {
        chrome.runtime.sendMessage({
          type: 'PROVIDER_RESPONSE',
          provider: 'qwen',
          content: response.content,
          status: response.status,
          conversationId: message.conversationId
        });
        sendResponse({ success: true });
      })
      .catch(error => {
        chrome.runtime.sendMessage({
          type: 'PROVIDER_RESPONSE',
          provider: 'qwen',
          content: '',
          status: 'error',
          conversationId: message.conversationId
        });
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});
