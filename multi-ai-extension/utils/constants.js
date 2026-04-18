export const PROVIDERS = {
  QWEN: 'qwen',
  YUANBAO: 'yuanbao',
  DEEPSEEK: 'deepseek',
  DOUBAO: 'doubao'
};

export const PROVIDER_NAMES = {
  [PROVIDERS.QWEN]: '通义千问',
  [PROVIDERS.YUANBAO]: '元宝',
  [PROVIDERS.DEEPSEEK]: 'DeepSeek',
  [PROVIDERS.DOUBAO]: '豆包'
};

export const PROVIDER_URLS = {
  [PROVIDERS.QWEN]: ['https://qwen.ai/*', 'https://qwen.cn/*'],
  [PROVIDERS.YUANBAO]: ['https://yuanbao.tencent.com/*'],
  [PROVIDERS.DEEPSEEK]: ['https://chat.deepseek.com/*'],
  [PROVIDERS.DOUBAO]: ['https://doubao.com/*']
};

export const MESSAGE_TYPES = {
  SEND_QUESTION: 'SEND_QUESTION',
  QUESTION_SENT: 'QUESTION_SENT',
  AI_RESPONSE: 'AI_RESPONSE',
  ALL_RESPONSES_COMPLETE: 'ALL_RESPONSES_COMPLETE',
  GET_HISTORY: 'GET_HISTORY',
  HISTORY_RESPONSE: 'HISTORY_RESPONSE',
  GET_SETTINGS: 'GET_SETTINGS',
  SETTINGS_RESPONSE: 'SETTINGS_RESPONSE',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  FORWARD_TO_PROVIDER: 'FORWARD_TO_PROVIDER',
  PROVIDER_RESPONSE: 'PROVIDER_RESPONSE',
  SAVE_CONVERSATION: 'SAVE_CONVERSATION',
  CANCEL_REQUEST: 'CANCEL_REQUEST',
  GET_PROVIDER_STATUS: 'GET_PROVIDER_STATUS',
  PROVIDER_STATUS_UPDATE: 'PROVIDER_STATUS_UPDATE'
};

export const RESPONSE_STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
  TIMEOUT: 'timeout',
  LOGIN_REQUIRED: 'login_required',
  CANCELLED: 'cancelled'
};

export const PROVIDER_STATUS = {
  READY: 'ready',
  BUSY: 'busy',
  ERROR: 'error',
  NOT_LOGGED_IN: 'not_logged_in',
  DISCONNECTED: 'disconnected'
};

export const DEFAULT_SETTINGS = {
  enabledProviders: [PROVIDERS.QWEN, PROVIDERS.YUANBAO, PROVIDERS.DEEPSEEK, PROVIDERS.DOUBAO],
  timeoutSeconds: 30,
  autoSaveHistory: true
};

export const STORAGE_KEYS = {
  SETTINGS: 'multi_ai_settings',
  HISTORY: 'multi_ai_history',
  CONVERSATIONS: 'multi_ai_conversations'
};

export const CONSTRAINTS = {
  MAX_PROVIDERS: 10,
  MIN_TIMEOUT: 10,
  MAX_TIMEOUT: 60,
  DEFAULT_TIMEOUT: 30,
  MAX_HISTORY_COUNT: 100,
  MAX_QUESTION_LENGTH: 10000
};

export const ERROR_MESSAGES = {
  NETWORK_ERROR: '网络连接失败，请检查网络',
  TIMEOUT: 'AI响应超时',
  LOGIN_REQUIRED: (provider) => `请先登录${PROVIDER_NAMES[provider] || provider}`,
  DOM_INJECTION_FAILED: '无法连接到此AI，请刷新页面后重试',
  STORAGE_FULL: '存储空间不足，请清理历史记录',
  EMPTY_QUESTION: '请输入问题内容',
  QUESTION_TOO_LONG: (max) => `问题内容不能超过${max}个字符`
};
