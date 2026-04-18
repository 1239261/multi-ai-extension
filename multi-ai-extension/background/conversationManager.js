import { logger } from '../utils/logger.js';
import { storageManager } from './storageManager.js';
import { CONSTRAINTS } from '../utils/constants.js';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

class ConversationManager {
  constructor() {
    this.logger = logger;
    this.activeConversations = new Map();
    this.pendingProviders = new Map();
    this.providerTimeouts = new Map();
  }

  createConversation(question) {
    const id = generateUUID();
    const conversation = {
      id,
      timestamp: new Date().toISOString(),
      question,
      responses: []
    };

    this.activeConversations.set(id, conversation);
    this.pendingProviders.set(id, new Set());
    this.logger.info('Conversation created', { id, questionLength: question.length });

    return conversation;
  }

  addPendingProvider(conversationId, provider) {
    const pending = this.pendingProviders.get(conversationId);
    if (pending) {
      pending.add(provider);
      this.logger.debug('Provider added to pending', { conversationId, provider });
    }
  }

  removePendingProvider(conversationId, provider) {
    const pending = this.pendingProviders.get(conversationId);
    if (pending) {
      pending.delete(provider);
      this.logger.debug('Provider removed from pending', { conversationId, provider });
    }
  }

  isConversationComplete(conversationId) {
    const pending = this.pendingProviders.get(conversationId);
    return pending ? pending.size === 0 : true;
  }

  addResponse(conversationId, provider, response) {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation) {
      this.logger.warn('Conversation not found', { conversationId });
      return null;
    }

    const existingIndex = conversation.responses.findIndex(r => r.provider === provider);
    if (existingIndex >= 0) {
      conversation.responses[existingIndex] = response;
    } else {
      conversation.responses.push(response);
    }

    this.logger.info('Response added', { conversationId, provider, status: response.status });
    return conversation;
  }

  getConversation(conversationId) {
    return this.activeConversations.get(conversationId);
  }

  async finalizeConversation(conversationId) {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation) {
      this.logger.warn('Conversation not found for finalization', { conversationId });
      return null;
    }

    this.clearTimeout(conversationId);

    const success = await storageManager.saveConversation(conversation);

    this.activeConversations.delete(conversationId);
    this.pendingProviders.delete(conversationId);

    this.logger.info('Conversation finalized', { conversationId, saved: success });

    return conversation;
  }

  cancelConversation(conversationId) {
    this.clearTimeout(conversationId);

    const conversation = this.activeConversations.get(conversationId);
    if (conversation) {
      const pending = this.pendingProviders.get(conversationId);
      if (pending) {
        pending.forEach(provider => {
          this.addResponse(conversationId, provider, {
            provider,
            content: '',
            rawContent: '',
            status: 'cancelled',
            timestamp: new Date().toISOString()
          });
        });
      }
    }

    this.activeConversations.delete(conversationId);
    this.pendingProviders.delete(conversationId);

    this.logger.info('Conversation cancelled', { conversationId });
  }

  setTimeout(conversationId, provider, timeoutMs, callback) {
    const key = `${conversationId}:${provider}`;
    if (this.providerTimeouts.has(key)) {
      clearTimeout(this.providerTimeouts.get(key));
    }

    const timeoutId = setTimeout(() => {
      this.providerTimeouts.delete(key);
      if (callback) {
        callback();
      }
    }, timeoutMs);

    this.providerTimeouts.set(key, timeoutId);
  }

  clearTimeout(conversationId, provider = null) {
    if (provider) {
      const key = `${conversationId}:${provider}`;
      if (this.providerTimeouts.has(key)) {
        clearTimeout(this.providerTimeouts.get(key));
        this.providerTimeouts.delete(key);
      }
    } else {
      this.providerTimeouts.forEach((timeoutId, key) => {
        if (key.startsWith(conversationId + ':')) {
          clearTimeout(timeoutId);
          this.providerTimeouts.delete(key);
        }
      });
    }
  }
}

const conversationManager = new ConversationManager();

export { ConversationManager, conversationManager, generateUUID };
