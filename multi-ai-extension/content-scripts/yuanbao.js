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
           parseFloat(style.opacity) > 0 &&
           element.offsetWidth > 0 &&
           element.offsetHeight > 0;
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
    console.log('Yuanbao: Waiting for page...');
    await this.sleep(2000);
    
    const inputEl = await this.waitForElement([
      'textarea',
      '[contenteditable="true"]',
      '[role="textbox"]',
      'input[type="text"]'
    ], 15000);

    if (!inputEl) {
      throw new Error('Yuanbao: Input not found');
    }

    console.log('Yuanbao: Found input, filling...');
    inputEl.focus();
    
    this.clearInput(inputEl);
    await this.sleep(200);
    
    this.fillText(inputEl, question);
    await this.sleep(500);
    
    const btn = this.findSendButton();
    if (btn) {
      console.log('Yuanbao: Clicking send button');
      btn.click();
    } else {
      console.log('Yuanbao: Button not found, try keyboard');
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
      throw new Error('Yuanbao: Response timeout');
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
      'a#yuanbao-send-btn',
      'a[class*="send-btn"]',
      'a[class*="send"]',
      'button#yuanbao-send-btn',
      'button[class*="send-btn"]',
      '[class*="icon-send"]',
      '[class*="iconfont"][class*="send"]'
    ];

    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && this.isVisible(el)) {
          console.log('Yuanbao: Found button with:', sel);
          return el;
        }
      } catch (e) {}
    }

    const links = document.querySelectorAll('a, button');
    for (const el of links) {
      const className = (el.className || '');
      const id = (el.id || '');
      if (id.includes('send') || className.includes('send')) {
        if (this.isVisible(el)) {
          console.log('Yuanbao: Found send element:', id, className);
          return el;
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
      '[class*="message"]',
      '[class*="response-content"]',
      '[class*="content"]',
      '[class*="answer"]'
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
      console.log('Yuanbao: Submitting...');
      await this.injectAndSubmit(question);
      const content = this.getResponseContent();
      console.log('Yuanbao: Response length:', content?.length);
      return { provider: 'yuanbao', content: content || this.lastResponse, status: 'success' };
    } catch (error) {
      console.error('Yuanbao error:', error);
      const content = this.getResponseContent();
      if (content && content.length > 10) {
        return { provider: 'yuanbao', content, status: 'success' };
      }
      return { provider: 'yuanbao', content: error.message, status: 'error' };
    }
  }
}

const provider = new YuanbaoProvider();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FORWARD_TO_PROVIDER' && message.provider === 'yuanbao') {
    provider.submitQuestion(message.question)
      .then(response => {
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
        chrome.runtime.sendMessage({
          type: 'PROVIDER_RESPONSE',
          provider: 'yuanbao',
          content: '',
          status: 'error',
          conversationId: message.conversationId
        });
        sendResponse({ success: false });
      });
    return true;
  }
});
