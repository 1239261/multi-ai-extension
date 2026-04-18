import { MESSAGE_TYPES } from '../utils/constants.js';
import { logger } from '../utils/logger.js';
import { messageRouter } from './messageRouter.js';

logger.setLevel('INFO');
logger.info('Background script initializing');

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    messageRouter.setPopupPort(port);
    
    port.onDisconnect.addListener(() => {
      messageRouter.clearPopupPort();
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === 'background') {
    if (message.type === MESSAGE_TYPES.PROVIDER_RESPONSE) {
      messageRouter.handleProviderResponse(message, sender, sendResponse);
      return true;
    } else {
      messageRouter.handlePopupMessage(message, sender, sendResponse)
        .then(sendResponse)
        .catch((error) => {
          logger.error('Error handling message', { error: error.message });
          sendResponse({ success: false, error: error.message });
        });
      return true;
    }
  }
  return false;
});

chrome.commands?.onCommand.addListener((command) => {
  logger.info('Command triggered', { command });
});

logger.info('Background script initialized');
