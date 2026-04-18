class DeepseekProvider extends BaseProvider {
  constructor() {
    super('deepseek');
    
    this.selectors = {
      input: 'textarea[placeholder*="输入"], textarea[placeholder*="Send"], div[contenteditable="true"]',
      submitButton: 'button[type="submit"], button:has-text("Send")',
      responseContainer: '.markdown-content, .response-content, [class*="message"]',
      loadingIndicator: '.loading, [class*="thinking"]'
    };
  }

  isAtChatPage() {
    return this.getCurrentUrl().includes('chat.deepseek.com');
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
      'textarea[placeholder*="Send"]',
      'textarea',
      'div[contenteditable="true"]',
      '[role="textbox"]'
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
      'button:has-text("Send")',
      'button:has-text(">")]'
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
    
    if (element.tagName === 'TEXTAREA') {
      element.value = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
    }
  }

  isResponseReady() {
    const loading = document.querySelector(this.selectors.loadingIndicator);
    if (loading && this.isVisible(loading)) {
      return false;
    }
    return true;
  }

  async extractResponse() {
    await this.waitForResponse();
    
    const responseEls = document.querySelectorAll(this.selectors.responseContainer);
    let lastResponse = '';
    
    for (const el of responseEls) {
      if (this.isVisible(el) && el.textContent.trim().length > 0) {
        const text = el.textContent.trim();
        if (text.length > lastResponse.length) {
          lastResponse = text;
        }
      }
    }

    return lastResponse;
  }

  isVisible(element) {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           element.offsetParent !== null;
  }

  checkLoginStatus() {
    return !document.querySelector('button:has-text("Log in")');
  }
}

const provider = new DeepseekProvider();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FORWARD_TO_PROVIDER' && message.provider === 'deepseek') {
    provider.submitQuestion(message.question)
      .then(response => {
        chrome.runtime.sendMessage({
          type: 'PROVIDER_RESPONSE',
          provider: 'deepseek',
          content: response.content,
          status: response.status,
          conversationId: message.conversationId
        });
        sendResponse({ success: true });
      })
      .catch(error => {
        chrome.runtime.sendMessage({
          type: 'PROVIDER_RESPONSE',
          provider: 'deepseek',
          content: '',
          status: 'error',
          conversationId: message.conversationId
        });
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});
