class DoubaoProvider extends BaseProvider {
  constructor() {
    super('doubao');
    
    this.selectors = {
      input: 'textarea, div[contenteditable="true"], [role="textbox"]',
      submitButton: 'button[type="submit"], button:has-text("发送"), button:has-text("发送")',
      responseContainer: '.message-content, .response-content, [class*="message"]',
      loadingIndicator: '.loading, .generating'
    };
  }

  isAtChatPage() {
    return this.getCurrentUrl().includes('doubao.com');
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
      'textarea',
      'div[contenteditable="true"]',
      '[role="textbox"]',
      '[placeholder*="输入"]',
      '[placeholder*="问题"]'
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
      'button:has-text("问")',
      '[class*="send"] button'
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
        lastResponse = el.textContent.trim();
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
    return !document.querySelector('button:has-text("登录")');
  }
}

const provider = new DoubaoProvider();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FORWARD_TO_PROVIDER' && message.provider === 'doubao') {
    provider.submitQuestion(message.question)
      .then(response => {
        chrome.runtime.sendMessage({
          type: 'PROVIDER_RESPONSE',
          provider: 'doubao',
          content: response.content,
          status: response.status,
          conversationId: message.conversationId
        });
        sendResponse({ success: true });
      })
      .catch(error => {
        chrome.runtime.sendMessage({
          type: 'PROVIDER_RESPONSE',
          provider: 'doubao',
          content: '',
          status: 'error',
          conversationId: message.conversationId
        });
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});
