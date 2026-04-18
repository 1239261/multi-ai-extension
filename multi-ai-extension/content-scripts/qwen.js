class QwenProvider {
  constructor() {
    this.providerName = 'qwen';
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
    console.log('Qwen: Waiting for page...');
    await this.sleep(3000);
    
    const inputEl = await this.waitForElement([
      'textarea.MessageInput__TextArea--dAQGxw1v',
      'textarea[class*="MessageInput"]',
      'textarea',
      'div[role="textbox"]',
      'div[data-placeholder*="提问"]',
      '[contenteditable="true"][role="textbox"]'
    ], 15000);

    if (!inputEl) {
      throw new Error('Qwen: Input not found');
    }

    console.log('Qwen: Found input, filling...');
    inputEl.focus();
    
    this.clearInput(inputEl);
    await this.sleep(200);
    
    this.fillText(inputEl, question);
    await this.sleep(500);
    
    const btn = this.findSendButton();
    if (btn) {
      console.log('Qwen: Clicking send button');
      btn.click();
    } else {
      console.log('Qwen: Button not found, try keyboard');
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
      throw new Error('Qwen: Response timeout');
    }
  }

  clearInput(el) {
    el.focus();
    el.value = '';
    el.textContent = '';
    el.innerHTML = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    
    document.execCommand('delete', false, null);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  fillText(el, text) {
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value')?.set;
      if (setter) setter.call(el, text);
      else el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      el.focus();
      el.textContent = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      
      document.execCommand('insertText', false, text);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  findSendButton() {
    const selectors = [
      'div.MessageInput__Submit--mW8tX660',
      'div[class*="MessageInput__Submit"]',
      'i.icon-line-arrow-up',
      '[class*="Submit"][class*="Icon"]',
      'button[aria-label="发送消息"]',
      'button[aria-label*="发送"]',
      'button[class*="sendChat"]',
      '[class*="sendChat"]'
    ];

    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && this.isVisible(el)) {
          console.log('Qwen: Found button with:', sel);
          return el;
        }
      } catch (e) {}
    }

    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (ariaLabel.includes('发送') || ariaLabel.includes('send')) {
        if (this.isVisible(btn)) {
          console.log('Qwen: Found send button:', ariaLabel);
          return btn;
        }
      }
    }

    const svgs = document.querySelectorAll('svg use[xlink\\:href*="send"]');
    for (const svg of svgs) {
      const btn = svg.closest('button');
      if (btn && this.isVisible(btn)) {
        console.log('Qwen: Found button near send icon');
        return btn;
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
      '[class*="response"]',
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
      console.log('Qwen: Submitting...');
      await this.injectAndSubmit(question);
      const content = this.getResponseContent();
      console.log('Qwen: Response length:', content?.length);
      return { provider: 'qwen', content: content || this.lastResponse, status: 'success' };
    } catch (error) {
      console.error('Qwen error:', error);
      const content = this.getResponseContent();
      if (content && content.length > 10) {
        return { provider: 'qwen', content, status: 'success' };
      }
      return { provider: 'qwen', content: error.message, status: 'error' };
    }
  }
}

const provider = new QwenProvider();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FORWARD_TO_PROVIDER' && message.provider === 'qwen') {
    provider.submitQuestion(message.question)
      .then(response => {
        chrome.runtime.sendMessage({
          type: 'PROVIDER_RESPONSE',
          provider: 'qwen',
          content: response.content,
          status: response.status,
          conversationId: message.conversationId
        });
        sendResponse({ success: true });
      })
      .catch(error => {
        chrome.runtime.sendMessage({
          type: 'PROVIDER_RESPONSE',
          provider: 'qwen',
          content: '',
          status: 'error',
          conversationId: message.conversationId
        });
        sendResponse({ success: false });
      });
    return true;
  }
});
