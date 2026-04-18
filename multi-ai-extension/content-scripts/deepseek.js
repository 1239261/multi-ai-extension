class DeepseekProvider {
  constructor() {
    this.providerName = 'deepseek';
    this.lastResponse = '';
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           element.offsetParent !== null;
  }

  findElement(selectors) {
    for (const selector of selectors) {
      try {
        const el = document.querySelector(selector);
        if (el && this.isVisible(el)) {
          return el;
        }
      } catch (e) {
        // Skip invalid selectors
      }
    }
    return null;
  }

  async waitForElement(selectors, timeout = 10000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const el = this.findElement(selectors);
      if (el) return el;
      await this.sleep(200);
    }
    return null;
  }

  async injectAndSubmit(question) {
    await this.sleep(1500);
    
    const inputEl = await this.waitForElement([
      'textarea',
      'div[contenteditable="true"]',
      '[role="textbox"]',
      'input[type="text"]'
    ], 15000);

    if (!inputEl) {
      throw new Error('Deepseek: Input element not found');
    }

    this.clearAndFillInput(inputEl, question);
    await this.sleep(500);
    
    const submitBtn = this.findElement([
      'button[type="submit"]',
      'button[aria-label*="Send"]',
      'button[aria-label*="send"]',
      '[class*="send"]',
      '[class*="submit"]'
    ]);

    if (submitBtn) {
      submitBtn.click();
    } else {
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', ctrlKey: true, bubbles: true }));
    }

    await this.sleep(1000);
    
    const ready = await this.waitForResponse(60000);
    if (!ready) {
      throw new Error('Deepseek: Response timeout');
    }
  }

  clearAndFillInput(element, text) {
    element.focus();
    
    element.value = '';
    element.dispatchEvent(new Event('input', { bubbles: true }));
    
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      const prototype = element;
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value').set;
      nativeInputValueSetter.call(element, text);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
    }
  }

  async waitForResponse(timeout = 60000) {
    const startTime = Date.now();
    let lastContent = '';
    
    while (Date.now() - startTime < timeout) {
      const response = this.getResponseContent();
      
      const loadingEl = this.findElement(['[class*="loading"]', '[class*="generating"]', '[class*="thinking"]']);
      if (loadingEl && this.isVisible(loadingEl)) {
        await this.sleep(500);
        continue;
      }
      
      if (response && response.length > 10 && response !== lastContent) {
        this.lastResponse = response;
        return true;
      }
      
      lastContent = response;
      await this.sleep(500);
    }
    return false;
  }

  getResponseContent() {
    const candidates = [
      ...document.querySelectorAll('[class*="message"]'),
      ...document.querySelectorAll('[class*="response"]'),
      ...document.querySelectorAll('[class*="content"]'),
      ...document.querySelectorAll('[class*="answer"]'),
      ...document.querySelectorAll('.markdown-content')
    ];
    
    let longest = '';
    for (const el of candidates) {
      if (this.isVisible(el) && el.textContent.trim().length > longest.length) {
        const text = el.textContent.trim();
        if (text.length > 20) {
          longest = text;
        }
      }
    }
    
    return longest;
  }

  async submitQuestion(question) {
    try {
      await this.injectAndSubmit(question);
      const response = this.getResponseContent();
      return {
        provider: this.providerName,
        content: response || this.lastResponse,
        status: 'success'
      };
    } catch (error) {
      console.error('Deepseek error:', error);
      return {
        provider: this.providerName,
        content: '',
        status: error.message.includes('timeout') ? 'timeout' : 'error'
      };
    }
  }
}

const provider = new DeepseekProvider();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FORWARD_TO_PROVIDER' && message.provider === 'deepseek') {
    console.log('Deepseek: Received question:', message.question);
    
    provider.submitQuestion(message.question)
      .then(response => {
        console.log('Deepseek: Response:', response);
        chrome.runtime.sendMessage({
          type: 'PROVIDER_RESPONSE',
          provider: 'deepseek',
          content: response.content,
          status: response.status,
          conversationId: message.conversationId
        });
        sendResponse({ success: response.status === 'success' });
      })
      .catch(error => {
        console.error('Deepseek: Error:', error);
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
