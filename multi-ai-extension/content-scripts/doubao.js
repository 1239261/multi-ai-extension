class DoubaoProvider {
  constructor() {
    this.providerName = 'doubao';
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
           parseFloat(style.opacity) > 0;
  }

  findElement(selectors) {
    for (const selector of selectors) {
      try {
        const el = document.querySelector(selector);
        if (el && this.isVisible(el)) {
          return el;
        }
      } catch (e) {}
    }
    return null;
  }

  async waitForElement(selectors, timeout = 15000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const el = this.findElement(selectors);
      if (el) return el;
      await this.sleep(300);
    }
    return null;
  }

  async injectAndSubmit(question) {
    console.log('Doubao: Waiting for page to be ready...');
    await this.sleep(3000);
    
    const inputEl = await this.waitForElement([
      'textarea',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
      '[contenteditable="true"]',
      '[role="textbox"]',
      'input[type="text"]'
    ], 20000);

    if (!inputEl) {
      console.log('Doubao: Looking for input with mutation observer...');
      return new Promise((resolve, reject) => {
        const observer = new MutationObserver(() => {
          const el = this.findElement(['textarea', 'div[contenteditable]', '[role="textbox"]']);
          if (el) {
            observer.disconnect();
            this.doSubmit(el, question).then(resolve).catch(reject);
          }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        setTimeout(() => {
          observer.disconnect();
          reject(new Error('Doubao: Input element not found'));
        }, 20000);
      });
    }

    return this.doSubmit(inputEl, question);
  }

  async doSubmit(inputEl, question) {
    console.log('Doubao: Found input, filling text...');
    
    inputEl.focus();
    this.clearInput(inputEl);
    await this.sleep(300);
    
    if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
      const nativeSetter = Object.getOwnPropertyDescriptor(inputEl.constructor.prototype, 'value')?.set;
      if (nativeSetter) {
        nativeSetter.call(inputEl, question);
      } else {
        inputEl.value = question;
      }
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      for (let i = 0; i < question.length; i++) {
        document.execCommand('insertText', false, question[i]);
        await this.sleep(10);
      }
    }
    
    await this.sleep(500);
    console.log('Doubao: Looking for send button...');
    
    const sent = await this.trySend();
    if (!sent) {
      throw new Error('Doubao: Failed to send message');
    }
    
    await this.sleep(2000);
    console.log('Doubao: Waiting for response...');
    
    const ready = await this.waitForResponse(60000);
    if (!ready) {
      const response = this.getResponseContent();
      if (response && response.length > 10) {
        this.lastResponse = response;
        return;
      }
      throw new Error('Doubao: Response timeout');
    }
  }

  clearInput(element) {
    element.value = '';
    element.textContent = '';
    element.innerHTML = '';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async trySend() {
    const btn = this.findSendButton();
    if (btn) {
      console.log('Doubao: Clicking send button');
      btn.click();
      return true;
    }
    
    console.log('Doubao: No button found, trying keyboard...');
    const input = this.findElement(['textarea:focus', 'div[contenteditable="true"]:focus', '[role="textbox"]:focus', 'input[type="text"]:focus']);
    if (input) {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      return true;
    }
    
    return false;
  }

  findSendButton() {
    const buttons = document.querySelectorAll('button, [class*="button"], [class*="btn"]');
    
    for (const btn of buttons) {
      if (!this.isVisible(btn) || btn.disabled) continue;
      
      const text = (btn.textContent || '').trim().toLowerCase();
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      const className = (btn.className || '').toLowerCase();
      
      if (text.includes('发送') || text.includes('send') || text.includes('submit') ||
          aria.includes('发送') || aria.includes('send') ||
          className.includes('send') || className.includes('submit')) {
        console.log('Doubao: Found button:', text, aria, className);
        return btn;
      }
    }
    
    if (buttons.length > 0) {
      for (const btn of buttons) {
        if (this.isVisible(btn) && !btn.disabled && btn.offsetHeight > 0) {
          console.log('Doubao: Using fallback button:', btn.textContent?.substring(0, 30));
          return btn;
        }
      }
    }
    
    return null;
  }

  async waitForResponse(timeout = 60000) {
    const startTime = Date.now();
    let lastContent = '';
    let stableCount = 0;
    
    while (Date.now() - startTime < timeout) {
      const response = this.getResponseContent();
      
      const loading = this.findElement(['[class*="loading"]', '[class*="generating"]', '[class*="thinking"]', '[class*="sending"]']);
      if (loading && this.isVisible(loading)) {
        stableCount = 0;
        await this.sleep(500);
        continue;
      }
      
      if (response && response.length > 20) {
        if (response === lastContent) {
          stableCount++;
          if (stableCount >= 3) {
            this.lastResponse = response;
            return true;
          }
        } else {
          stableCount = 0;
          lastContent = response;
        }
      }
      
      await this.sleep(500);
    }
    return false;
  }

  getResponseContent() {
    const selectors = [
      '[class*="message"]',
      '[class*="response"]',
      '[class*="content"]',
      '[class*="answer"]',
      '[class*="result"]',
      '[class*="bubble"]'
    ];
    
    let longest = '';
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (this.isVisible(el)) {
          const text = el.textContent?.trim() || '';
          if (text.length > longest.length && text.length > 20) {
            longest = text;
          }
        }
      }
    }
    return longest;
  }

  async submitQuestion(question) {
    try {
      console.log('Doubao: Submitting question:', question.substring(0, 50));
      await this.injectAndSubmit(question);
      const response = this.getResponseContent();
      console.log('Doubao: Got response, length:', response?.length);
      return { provider: 'doubao', content: response || this.lastResponse, status: 'success' };
    } catch (error) {
      console.error('Doubao error:', error);
      const response = this.getResponseContent();
      if (response && response.length > 10) {
        return { provider: 'doubao', content: response, status: 'success' };
      }
      return { provider: 'doubao', content: error.message, status: 'error' };
    }
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
        sendResponse({ success: response.status === 'success' });
      })
      .catch(error => {
        chrome.runtime.sendMessage({
          type: 'PROVIDER_RESPONSE',
          provider: 'doubao',
          content: '',
          status: 'error',
          conversationId: message.conversationId
        });
        sendResponse({ success: false });
      });
    return true;
  }
});
