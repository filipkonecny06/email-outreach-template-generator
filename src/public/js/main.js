class ToastController {
  static mount(options = {}) {
    const windowObject = options.windowObject || globalThis.window;
    const controller = new ToastController({ ...options, windowObject });
    return controller.init();
  }

  constructor(options = {}) {
    this.document = options.documentObject || globalThis.document;
    this.window = options.windowObject || globalThis.window;
    this.region = options.region ?? this.document?.getElementById('toastRegion');
    this.setTimer = options.setTimeoutImpl || globalThis.setTimeout;
    this.clearTimer = options.clearTimeoutImpl || globalThis.clearTimeout;
    this.duration = options.duration ?? 2800;
    this.activeToasts = new Map();
    this.previousToast = this.window.toast;
    this.boundShow = this.show.bind(this);
  }

  init() {
    this.window.toast = this.boundShow;
    return this;
  }

  show(message, type = 'info') {
    if (!this.region) return null;

    const variant = ['info', 'success', 'warning', 'error'].includes(type) ? type : 'info';
    const element = this.document.createElement('div');
    element.className = `toast ${variant}`;
    element.textContent = String(message ?? '');
    this.region.appendChild(element);

    const timer = this.setTimer(() => {
      element.remove();
      this.activeToasts.delete(element);
    }, this.duration);
    this.activeToasts.set(element, timer);
    return element;
  }

  destroy() {
    for (const [element, timer] of this.activeToasts) {
      this.clearTimer(timer);
      element.remove();
    }
    this.activeToasts.clear();

    if (this.window.toast === this.boundShow) {
      if (this.previousToast) this.window.toast = this.previousToast;
      else delete this.window.toast;
    }
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.ToastController = ToastController;
  ToastController.mount();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ToastController };
}
