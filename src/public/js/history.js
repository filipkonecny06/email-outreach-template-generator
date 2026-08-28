/** Copies saved plain-text drafts while keeping listener setup and teardown testable. */
class HistoryClipboardController {
  static collectElements(documentObject) {
    const page = documentObject?.querySelector('[data-page="history"]');
    return page ? { page } : null;
  }

  static mount(options = {}) {
    const documentObject = options.documentObject || globalThis.document;
    const elements = options.elements || HistoryClipboardController.collectElements(documentObject);
    if (!elements) return null;

    const controller = new HistoryClipboardController({
      ...options,
      documentObject,
      elements
    });
    return controller.init();
  }

  constructor(options = {}) {
    this.document = options.documentObject || globalThis.document;
    this.window = options.windowObject || globalThis.window;
    this.elements = options.elements || {};
    this.clipboard = options.clipboard || this.window?.navigator?.clipboard;
    this.notify = options.notify || ((message, type) => this.window?.toast?.(message, type));
    this.boundHandleClick = (event) => this.handleClick(event);
    this.mounted = false;
  }

  init() {
    if (!this.mounted) {
      this.document.addEventListener('click', this.boundHandleClick);
      this.mounted = true;
    }
    return this;
  }

  destroy() {
    if (!this.mounted) return;
    this.document.removeEventListener('click', this.boundHandleClick);
    this.mounted = false;
  }

  async handleClick(event) {
    const button = event.target?.closest?.('.copy-history');
    if (!button) return false;

    const card = button.closest?.('.history-card');
    if (!card) return false;

    if (!this.clipboard?.writeText) {
      this.notify('Clipboard is unavailable.', 'error');
      return false;
    }

    const subject = card.querySelector('[data-history-subject]')?.textContent || '';
    const body = card.querySelector('[data-history-body]')?.textContent || '';
    button.disabled = true;

    try {
      await this.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      this.notify('History entry copied.', 'success');
      return true;
    } catch {
      this.notify('Could not copy the history entry.', 'error');
      return false;
    } finally {
      button.disabled = false;
    }
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.HistoryClipboardController = HistoryClipboardController;
  HistoryClipboardController.mount();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HistoryClipboardController };
}
