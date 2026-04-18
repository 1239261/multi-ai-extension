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
    try {
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && 
             style.visibility !== 'hidden' && 
             parseFloat(style.opacity) > 0 &&
             element.offsetWidth > 0 &&
             element.offsetHeight > 0;
    } catch (e) {
      return false;
    }
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
      await this.sleep(200);
    }
    return null;
  }

  async injectAndSubmit(question) {
    console.log('Doubao: Waiting for page...');
    await this.sleep(3000);
    
    const inputEl = await this.waitForElement([
      'textarea',
      '[contenteditable="true"]',
      '[role="textbox"]',
      'input[type="text"]'
    ], 15000);

    if (!inputEl) {
      throw new Error('Doubao: Input not found');
    }

    console.log('Doubao: Found input, filling...');
    inputEl.focus();
    
    this.clearInput(inputEl);
    await this.sleep(200);
    
    this.fillText(inputEl, question);
    await this.sleep(500);
    
    const btn = this.findSendButton();
    if (btn) {
      console.log('Doubao: Clicking send button');
      btn.click();
    } else {
      console.log('Doubao: Button not found, try keyboard');
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
      inputEl.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    }
    
    await this.sleep(2000);
    
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

  clearInput(el) {
    el.value = '';
    el.textContent = '';
    el.innerHTML = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  fillText(el, text) {
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value')?.set;
      if (setter) setter.call(el, text);
      else el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      el.textContent = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  findSendButton() {
    const selectors = [
      'button#flow-end-msg-send',
      'button[data-dbx-name="button"]',
      'button[class*="send"]',
      '[id="flow-end-msg-send"]',
      '[data-dbx-name="button"][aria-label*="send"]',
      '[data-dbx-name="button"][aria-label*="发送"]'
    ];

    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && this.isVisible(el)) {
          console.log('Doubao: Found button with:', sel);
          return el;
        }
      } catch (e) {}
    }

    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      const id = (btn.id || '').toLowerCase();
      if (ariaLabel.includes('send') || ariaLabel.includes('发送') ||
          id.includes('send') || id.includes('msg-send')) {
        if (this.isVisible(btn)) {
          console.log('Doubao: Found send button:', id, ariaLabel);
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
      const content = this.getResponseContent();
      
      const loading = this.findElement(['[class*="loading"]', '[class*="generating"]', '[class*="thinking"]']);
      if (loading && this.isVisible(loading)) {
        stableCount = 0;
        await this.sleep(500);
        continue;
      }
      
      if (content && content.length > 20) {
        if (content === lastContent) {
          stableCount++;
          if (stableCount >= 3) {
            this.lastResponse = content;
            return true;
          }
        } else {
          stableCount = 0;
          lastContent = content;
        }
      }
      
      await this.sleep(500);
    }
    return false;
  }

  getResponseContent() {
    const selectors = [
      '[class*="message-content"]',
      '[class*="bubble-content"]',
      '[class*="chat-content"]',
      '[class*="response"]'
    ];
    
    let longest = '';
    for (const sel of selectors) {
      try {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          if (this.isVisible(el)) {
            const text = el.textContent?.trim() || '';
            if (text.length > longest.length && text.length > 20) {
              longest = text;
            }
          }
        }
      } catch (e) {}
    }
    return longest;
  }

  async submitQuestion(question) {
    try {
      console.log('Doubao: Submitting...');
      await this.injectAndSubmit(question);
      const content = this.getResponseContent();
      console.log('Doubao: Response length:', content?.length);
      return { provider: 'doubao', content: content || this.lastResponse, status: 'success' };
    } catch (error) {
      console.error('Doubao error:', error);
      const content = this.getResponseContent();
      if (content && content.length > 10) {
        return { provider: 'doubao', content, status: 'success' };
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
        sendResponse({ success: false });
      });
    return true;
  }
});
