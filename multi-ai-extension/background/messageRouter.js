import { MESSAGE_TYPES, RESPONSE_STATUS, PROVIDERS } from '../utils/constants.js';
import { logger } from '../utils/logger.js';
import { conversationManager } from './conversationManager.js';
import { storageManager } from './storageManager.js';

class MessageRouter {
  constructor() {
    this.logger = logger;
    this.popupPort = null;
    this.providerTabs = new Map();
  }

  setPopupPort(port) {
    this.popupPort = port;
    this.logger.info('Popup port set', { portName: port.name });
  }

  clearPopupPort() {
    this.popupPort = null;
    this.logger.info('Popup port cleared');
  }

  async handlePopupMessage(message, sender, sendResponse) {
    this.logger.debug('Message from popup', { type: message.type, message });

    switch (message.type) {
      case MESSAGE_TYPES.SEND_QUESTION:
        return this.handleSendQuestion(message, sendResponse);

      case MESSAGE_TYPES.GET_HISTORY:
        return this.handleGetHistory(sendResponse);

      case MESSAGE_TYPES.GET_SETTINGS:
        return this.handleGetSettings(sendResponse);

      case MESSAGE_TYPES.UPDATE_SETTINGS:
        return this.handleUpdateSettings(message.settings, sendResponse);

      case MESSAGE_TYPES.CANCEL_REQUEST:
        return this.handleCancelRequest(message.conversationId, sendResponse);

      default:
        this.logger.warn('Unknown message type from popup', { type: message.type });
        return { success: false, error: 'Unknown message type' };
    }
  }

  async handleProviderResponse(message, sender, sendResponse) {
    this.logger.debug('Message from content script', { 
      type: message.type, 
      provider: message.provider,
      conversationId: message.conversationId 
    });

    const { provider, content, status, conversationId } = message;

    conversationManager.removePendingProvider(conversationId, provider);

    const response = {
      provider,
      content,
      rawContent: content,
      status,
      timestamp: new Date().toISOString()
    };

    conversationManager.addResponse(conversationId, provider, response);

    this.notifyPopup({
      type: MESSAGE_TYPES.AI_RESPONSE,
      provider,
      content,
      status,
      conversationId
    });

    if (conversationManager.isConversationComplete(conversationId)) {
      const conversation = await conversationManager.finalizeConversation(conversationId);
      this.notifyPopup({
        type: MESSAGE_TYPES.ALL_RESPONSES_COMPLETE,
        conversationId,
        conversation
      });
    }

    sendResponse({ success: true });
    return true;
  }

  async handleSendQuestion(message, sendResponse) {
    const { question } = message;

    if (!question || question.trim().length === 0) {
      return { success: false, error: 'EMPTY_QUESTION' };
    }

    if (question.length > 10000) {
      return { success: false, error: 'QUESTION_TOO_LONG' };
    }

    const settings = await storageManager.getSettings();
    const conversation = conversationManager.createConversation(question);

    const enabledProviders = settings.enabledProviders || Object.values(PROVIDERS);

    for (const provider of enabledProviders) {
      conversationManager.addPendingProvider(conversation.id, provider);
    }

    this.notifyPopup({
      type: MESSAGE_TYPES.QUESTION_SENT,
      conversationId: conversation.id,
      providers: enabledProviders
    });

    this.sendToProviders(conversation.id, question, enabledProviders, settings.timeoutSeconds);

    return { 
      success: true, 
      conversationId: conversation.id,
      providers: enabledProviders 
    };
  }

  async sendToProviders(conversationId, question, providers, timeoutSeconds) {
    for (const provider of providers) {
      const tabs = await this.findProviderTabs(provider);
      
      if (tabs.length === 0) {
        conversationManager.removePendingProvider(conversationId, provider);
        conversationManager.addResponse(conversationId, provider, {
          provider,
          content: '',
          rawContent: '',
          status: 'disconnected',
          timestamp: new Date().toISOString()
        });

        this.notifyPopup({
          type: MESSAGE_TYPES.AI_RESPONSE,
          provider,
          content: '',
          status: 'disconnected',
          conversationId
        });

        if (conversationManager.isConversationComplete(conversationId)) {
          const conversation = await conversationManager.finalizeConversation(conversationId);
          this.notifyPopup({
            type: MESSAGE_TYPES.ALL_RESPONSES_COMPLETE,
            conversationId,
            conversation
          });
        }
        continue;
      }

      const tab = tabs[0];

      conversationManager.setTimeout(conversationId, provider, timeoutSeconds * 1000, async () => {
        conversationManager.removePendingProvider(conversationId, provider);
        
        conversationManager.addResponse(conversationId, provider, {
          provider,
          content: '',
          rawContent: '',
          status: RESPONSE_STATUS.TIMEOUT,
          timestamp: new Date().toISOString()
        });

        this.notifyPopup({
          type: MESSAGE_TYPES.AI_RESPONSE,
          provider,
          content: '',
          status: RESPONSE_STATUS.TIMEOUT,
          conversationId
        });

        if (conversationManager.isConversationComplete(conversationId)) {
          const conversation = await conversationManager.finalizeConversation(conversationId);
          this.notifyPopup({
            type: MESSAGE_TYPES.ALL_RESPONSES_COMPLETE,
            conversationId,
            conversation
          });
        }
      });

      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: MESSAGE_TYPES.FORWARD_TO_PROVIDER,
          provider,
          question,
          conversationId
        });
        this.logger.info('Question sent to provider', { provider, tabId: tab.id, conversationId });
      } catch (error) {
        this.logger.error('Failed to send to provider', { provider, error: error.message });
        conversationManager.removePendingProvider(conversationId, provider);
        
        conversationManager.addResponse(conversationId, provider, {
          provider,
          content: '',
          rawContent: '',
          status: RESPONSE_STATUS.ERROR,
          timestamp: new Date().toISOString()
        });

        this.notifyPopup({
          type: MESSAGE_TYPES.AI_RESPONSE,
          provider,
          content: '',
          status: RESPONSE_STATUS.ERROR,
          conversationId
        });
      }
    }
  }

  async findProviderTabs(provider) {
    const providerUrls = {
      [PROVIDERS.QWEN]: ['https://qwen.ai/', 'https://qwen.cn/'],
      [PROVIDERS.YUANBAO]: ['https://yuanbao.tencent.com/'],
      [PROVIDERS.DEEPSEEK]: ['https://chat.deepseek.com/'],
      [PROVIDERS.DOUBAO]: ['https://doubao.com/']
    };

    const urls = providerUrls[provider] || [];
    const tabs = await chrome.tabs.query({ url: urls.map(u => `${u}*`) });
    return tabs;
  }

  async handleGetHistory(sendResponse) {
    const conversations = await storageManager.getConversations();
    return { success: true, conversations };
  }

  async handleGetSettings(sendResponse) {
    const settings = await storageManager.getSettings();
    return { success: true, settings };
  }

  async handleUpdateSettings(settings, sendResponse) {
    const success = await storageManager.saveSettings(settings);
    return { success };
  }

  handleCancelRequest(conversationId, sendResponse) {
    conversationManager.cancelConversation(conversationId);
    return { success: true };
  }

  notifyPopup(message) {
    if (this.popupPort) {
      try {
        this.popupPort.postMessage(message);
        this.logger.debug('Message sent to popup', { type: message.type });
      } catch (error) {
        this.logger.error('Failed to send to popup', { error: error.message });
      }
    }
  }
}

const messageRouter = new MessageRouter();

export { MessageRouter, messageRouter };
