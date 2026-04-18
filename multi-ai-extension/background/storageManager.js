import { STORAGE_KEYS, DEFAULT_SETTINGS, CONSTRAINTS } from '../utils/constants.js';
import { logger } from '../utils/logger.js';

class StorageManager {
  constructor() {
    this.logger = logger;
  }

  async getSettings() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
      if (result[STORAGE_KEYS.SETTINGS]) {
        return { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] };
      }
      return DEFAULT_SETTINGS;
    } catch (error) {
      this.logger.error('Failed to get settings', { error: error.message });
      return DEFAULT_SETTINGS;
    }
  }

  async saveSettings(settings) {
    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.SETTINGS]: settings
      });
      this.logger.info('Settings saved', { settings });
      return true;
    } catch (error) {
      this.logger.error('Failed to save settings', { error: error.message });
      return false;
    }
  }

  async getConversations() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.CONVERSATIONS);
      return result[STORAGE_KEYS.CONVERSATIONS] || [];
    } catch (error) {
      this.logger.error('Failed to get conversations', { error: error.message });
      return [];
    }
  }

  async saveConversation(conversation) {
    try {
      const conversations = await this.getConversations();
      conversations.unshift(conversation);

      if (conversations.length > CONSTRAINTS.MAX_HISTORY_COUNT) {
        conversations.splice(CONSTRAINTS.MAX_HISTORY_COUNT);
      }

      await chrome.storage.local.set({
        [STORAGE_KEYS.CONVERSATIONS]: conversations
      });

      this.logger.info('Conversation saved', { id: conversation.id });
      return true;
    } catch (error) {
      this.logger.error('Failed to save conversation', { error: error.message });
      return false;
    }
  }

  async deleteConversation(conversationId) {
    try {
      const conversations = await this.getConversations();
      const filtered = conversations.filter(c => c.id !== conversationId);
      await chrome.storage.local.set({
        [STORAGE_KEYS.CONVERSATIONS]: filtered
      });
      this.logger.info('Conversation deleted', { id: conversationId });
      return true;
    } catch (error) {
      this.logger.error('Failed to delete conversation', { error: error.message });
      return false;
    }
  }

  async clearAllConversations() {
    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.CONVERSATIONS]: []
      });
      this.logger.info('All conversations cleared');
      return true;
    } catch (error) {
      this.logger.error('Failed to clear conversations', { error: error.message });
      return false;
    }
  }
}

const storageManager = new StorageManager();

export { StorageManager, storageManager };
