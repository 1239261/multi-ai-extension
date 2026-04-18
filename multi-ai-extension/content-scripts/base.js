class BaseProvider {
  constructor(providerName) {
    this.providerName = providerName;
    this.selectors = {
      input: '',
      submitButton: '',
      responseContainer: '',
      loadingIndicator: ''
    };
  }

  async waitForSelector(selector, timeout = 10000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const element = document.querySelector(selector);
      if (element) return element;
      await this.sleep(100);
    }
    throw new Error(`Selector ${selector} not found within ${timeout}ms`);
  }

  async waitForResponse(timeout = 30000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (this.isResponseReady()) {
        return true;
      }
      await this.sleep(100);
    }
    return false;
  }

  isResponseReady() {
    return false;
  }

  async typeText(selector, text) {
    const element = await this.waitForSelector(selector);
    element.focus();
    element.value = '';
    element.dispatchEvent(new Event('input', { bubbles: true }));
    
    for (const char of text) {
      element.value += char;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      await this.sleep(10);
    }
    
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return element;
  }

  async click(selector) {
    const element = await this.waitForSelector(selector);
    element.click();
    await this.sleep(50);
    return element;
  }

  async submitQuestion(question) {
    try {
      await this.injectAndSubmit(question);
      const response = await this.extractResponse();
      return {
        provider: this.providerName,
        content: response,
        status: 'success'
      };
    } catch (error) {
      console.error(`${this.providerName} error:`, error);
      return {
        provider: this.providerName,
        content: '',
        status: this.getErrorStatus(error)
      };
    }
  }

  async injectAndSubmit(question) {
    throw new Error('Must be implemented by subclass');
  }

  async extractResponse() {
    throw new Error('Must be implemented by subclass');
  }

  checkLoginStatus() {
    return true;
  }

  getErrorStatus(error) {
    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      return 'timeout';
    }
    if (error.message.includes('login') || error.message.includes('Login')) {
      return 'login_required';
    }
    return 'error';
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getCurrentUrl() {
    return window.location.href;
  }

  isAtChatPage() {
    return true;
  }
}

window.BaseProvider = BaseProvider;
