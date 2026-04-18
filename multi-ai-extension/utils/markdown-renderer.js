class MarkdownRenderer {
  constructor() {
    this.marked = null;
    this.highlight = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    if (typeof marked === 'undefined') {
      throw new Error('marked.js is required but not loaded');
    }

    if (typeof hljs === 'undefined') {
      throw new Error('highlight.js is required but not loaded');
    }

    this.marked = marked;
    this.highlight = hljs;

    this.marked.setOptions({
      breaks: true,
      gfm: true,
      highlight: (code, lang) => {
        if (lang && this.highlight.getLanguage(lang)) {
          try {
            return this.highlight.highlight(code, { language: lang }).value;
          } catch (e) {
            return code;
          }
        }
        return this.highlight.highlightAuto(code).value;
      }
    });

    this.initialized = true;
  }

  render(markdown) {
    if (!this.initialized) {
      throw new Error('MarkdownRenderer must be initialized before use');
    }

    if (!markdown || typeof markdown !== 'string') {
      return '';
    }

    try {
      return this.marked(markdown);
    } catch (error) {
      return this.escapeHtml(markdown);
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  extractText(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }
}

const markdownRenderer = new MarkdownRenderer();

export { MarkdownRenderer, markdownRenderer };
