class YuanbaoProvider {
  constructor() {
    this.providerName = 'yuanbao';
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

  findAllElements(selectors) {
    const results = [];
    for (const selector of selectors) {
      try {
        const els = document.querySelectorAll(selector);
        for (const el of els) {
          if (this.isVisible(el)) {
            results.push(el);
          }
        }
      } catch (e) {
        // Skip invalid selectors
      }
    }
    return results;
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
    await this.sleep(2000);
    
    const inputEl = await this.waitForElement([
      'textarea',
      'div[contenteditable="true"]',
      '[role="textbox"]',
      'input[type="text"]'
    ], 20000);

    if (!inputEl) {
      throw new Error('Yuanbao: Input element not found');
    }

    console.log('Yuanbao: Found input element:', inputEl.tagName);

    this.clearAndFillInput(inputEl, question);
    await this.sleep(800);
    
    const submitBtn = this.findSubmitButton();
    
    if (submitBtn) {
      console.log('Yuanbao: Found submit button, clicking...');
      submitBtn.click();
    } else {
      console.log('Yuanbao: No submit button found, trying keyboard...');
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', ctrlKey: true, bubbles: true }));
      inputEl.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', ctrlKey: true, bubbles: true }));
    }

    await this.sleep(2000);
    
    const ready = await this.waitForResponse(60000);
    if (!ready) {
      const response = this.getResponseContent();
      if (response && response.length > 10) {
        this.lastResponse = response;
        return;
      }
      throw new Error('Yuanbao: Response timeout');
    }
  }

  findSubmitButton() {
    const buttons = this.findAllElements([
      'button',
      '[class*="btn"]',
      '[class*="button"]',
      '[class*="send"]',
      '[class*="submit"]'
    ]);
    
    for (const btn of buttons) {
      const text = (btn.textContent || '').trim().toLowerCase();
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      
      if (text.includes('发送') || text.includes('send') || text.includes('submit') ||
          ariaLabel.includes('发送') || ariaLabel.includes('send') ||
          btn.type === 'submit' || btn.type === 'button') {
        
        if (!btn.disabled && this.isVisible(btn)) {
          console.log('Yuanbao: Found button with text:', text, 'aria:', ariaLabel);
          return btn;
        }
      }
    }
    
    if (buttons.length > 0) {
      for (const btn of buttons) {
        if (!btn.disabled && this.isVisible(btn)) {
          console.log('Yuanbao: Using fallback button:', btn.textContent?.substring(0, 30));
          return btn;
        }
      }
    }
    
    return null;
  }

  clearAndFillInput(element, text) {
    element.focus();
    
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      element.value = '';
      element.dispatchEvent(new Event('input', { bubbles: true }));
      
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(element.constructor.prototype, 'value')?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(element, text);
      } else {
        element.value = text;
      }
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      element.textContent = '';
      element.dispatchEvent(new Event('input', { bubbles: true }));
      
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
    }
    
    console.log('Yuanbao: Input filled with text length:', text.length);
  }

  async waitForResponse(timeout = 60000) {
    const startTime = Date.now();
    let lastContent = '';
    let unchangedCount = 0;
    
    while (Date.now() - startTime < timeout) {
      const response = this.getResponseContent();
      
      const loadingEl = this.findElement(['[class*="loading"]', '[class*="generating"]', '[class*="thinking"]', '[class*="sending"]']);
      if (loadingEl && this.isVisible(loadingEl)) {
        unchangedCount = 0;
        await this.sleep(500);
        continue;
      }
      
      if (response && response.length > 10) {
        if (response === lastContent) {
          unchangedCount++;
          if (unchangedCount >= 3) {
            this.lastResponse = response;
            return true;
          }
        } else {
          unchangedCount = 0;
          lastContent = response;
        }
      }
      
      await this.sleep(500);
    }
    return false;
  }

  getResponseContent() {
    const candidates = document.querySelectorAll('[class*="message"], [class*="response"], [class*="content"], [class*="answer"]');
    
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
      console.log('Yuanbao: Starting submit question...');
      await this.injectAndSubmit(question);
      const response = this.getResponseContent();
      console.log('Yuanbao: Got response, length:', response?.length || 0);
      return {
        provider: this.providerName,
        content: response || this.lastResponse,
        status: 'success'
      };
    } catch (error) {
      console.error('Yuanbao error:', error);
      const response = this.getResponseContent();
      if (response && response.length > 10) {
        return {
          provider: this.providerName,
          content: response,
          status: 'success'
        };
      }
      return {
        provider: this.providerName,
        content: '',
        status: error.message.includes('timeout') ? 'timeout' : 'error'
      };
    }
  }
}

const provider = new YuanbaoProvider();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FORWARD_TO_PROVIDER' && message.provider === 'yuanbao') {
    console.log('Yuanbao: Received question:', message.question);
    
    provider.submitQuestion(message.question)
      .then(response => {
        console.log('Yuanbao: Response:', response);
        chrome.runtime.sendMessage({
          type: 'PROVIDER_RESPONSE',
          provider: 'yuanbao',
          content: response.content,
          status: response.status,
          conversationId: message.conversationId
        });
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('Yuanbao: Error:', error);
        chrome.runtime.sendMessage({
          type: 'PROVIDER_RESPONSE',
          provider: 'yuanbao',
          content: '',
          status: 'error',
          conversationId: message.conversationId
        });
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});
