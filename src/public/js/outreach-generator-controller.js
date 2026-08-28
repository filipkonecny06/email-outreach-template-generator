const outreachBrowserDependencies = (() => {
  if (typeof module !== 'undefined' && module.exports) {
    return {
      ...require('./outreach-api-client'),
      ...require('./outreach-export-service'),
      ...require('./outreach-form-view'),
      ...require('./outreach-template-list-controller')
    };
  }
  return typeof window === 'undefined' ? {} : window.OutreachOps || {};
})();

class OutreachGeneratorController {
  static collectElements(documentObject) {
    const page = documentObject?.querySelector('[data-page="generator"]');
    if (!page) return null;

    const form = documentObject.getElementById('generatorForm');
    return {
      page,
      csrfToken:
        documentObject.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
      form,
      templateList: documentObject.getElementById('templateList'),
      templateIdInput: documentObject.getElementById('templateId'),
      subjectPreview: documentObject.getElementById('subjectPreview'),
      bodyPreview: documentObject.getElementById('bodyPreview'),
      formError: documentObject.getElementById('formError'),
      followUpContainer: documentObject.getElementById('followUpContainer'),
      categoryFilter: documentObject.getElementById('categoryFilter'),
      searchInput: documentObject.getElementById('templateSearch'),
      favoritesOnly: documentObject.getElementById('favoritesOnly'),
      copySubjectButton: documentObject.getElementById('copySubjectBtn'),
      copyBodyButton: documentObject.getElementById('copyBodyBtn'),
      downloadTextButton: documentObject.getElementById('downloadTxtBtn'),
      exportCsvButton: documentObject.getElementById('exportCsvBtn'),
      saveHistoryButton: documentObject.getElementById('saveHistoryBtn'),
      includeFollowUps: documentObject.getElementById('includeFollowUps'),
      fieldContainers: [...form.querySelectorAll('[data-outreach-field]')]
    };
  }

  static mount(options = {}) {
    const documentObject = options.documentObject || globalThis.document;
    const elements =
      options.elements || OutreachGeneratorController.collectElements(documentObject);
    if (!elements) return null;
    return new OutreachGeneratorController({ ...options, documentObject, elements }).init();
  }

  constructor(options = {}) {
    this.document = options.documentObject || globalThis.document;
    this.window = options.windowObject || globalThis.window;
    this.AbortController = options.AbortControllerImpl || globalThis.AbortController;
    this.setTimer = options.setTimeoutImpl || globalThis.setTimeout;
    this.clearTimer = options.clearTimeoutImpl || globalThis.clearTimeout;
    this.elements =
      options.elements || OutreachGeneratorController.collectElements(this.document) || {};
    this.state = { subject: '', body: '', followUps: [] };
    this.previewController = null;
    this.savingHistory = false;
    this.listeners = [];

    const notify = options.notify || ((message, type) => this.window?.toast?.(message, type));
    const ApiClient = outreachBrowserDependencies.OutreachApiClient;
    const FormView = outreachBrowserDependencies.OutreachFormView;
    const ExportService = outreachBrowserDependencies.OutreachExportService;
    const TemplateListController = outreachBrowserDependencies.OutreachTemplateListController;

    this.apiClient =
      options.apiClient ||
      new ApiClient({ fetchImpl: options.fetchImpl, csrfToken: this.elements.csrfToken });
    this.formView =
      options.formView ||
      new FormView({
        documentObject: this.document,
        FormDataImpl: options.FormDataImpl,
        elements: this.elements
      });
    this.exportService =
      options.exportService ||
      new ExportService({
        documentObject: this.document,
        windowObject: this.window,
        BlobImpl: options.BlobImpl,
        URLObject: options.URLObject,
        notify
      });

    this.debouncedPreview = this.debounce(() => this.fetchPreview(), 280);
    this.templateList =
      options.templateListController ||
      new TemplateListController({
        documentObject: this.document,
        AbortControllerImpl: this.AbortController,
        elements: this.elements,
        apiClient: this.apiClient,
        notify,
        onSelect: (button) => {
          this.formView.selectTemplate(button);
          this.debouncedPreview();
        }
      });
    this.debouncedTemplateRefresh = this.debounce(() => this.templateList.refresh(), 220);
    this.notify = notify;
  }

  init() {
    const {
      templateList,
      searchInput,
      categoryFilter,
      favoritesOnly,
      form,
      copySubjectButton,
      copyBodyButton,
      downloadTextButton,
      exportCsvButton,
      saveHistoryButton,
      includeFollowUps,
      templateIdInput
    } = this.elements;

    this.listen(templateList, 'click', (event) => this.templateList.handleClick(event));
    this.listen(searchInput, 'input', this.debouncedTemplateRefresh);
    this.listen(categoryFilter, 'change', () => this.templateList.refresh());
    this.listen(favoritesOnly, 'change', () => this.templateList.refresh());
    this.listen(form, 'input', this.debouncedPreview);
    this.listen(form, 'submit', (event) => this.handleSubmit(event));
    this.listen(copySubjectButton, 'click', () =>
      this.exportService.copy('subject', this.state.subject)
    );
    this.listen(copyBodyButton, 'click', () => this.exportService.copy('body', this.state.body));
    this.listen(downloadTextButton, 'click', () => this.exportService.downloadText(this.state));
    this.listen(exportCsvButton, 'click', () => this.exportService.downloadCsv(this.state));
    this.listen(saveHistoryButton, 'click', () => this.saveHistory());
    this.listen(includeFollowUps, 'change', () => this.formView.updateRequiredFields());

    if (templateIdInput.value) {
      const selectedButton = [...templateList.querySelectorAll('.template-item')].find(
        (button) => button.dataset.templateId === templateIdInput.value
      );
      this.formView.updateRequiredFields(this.formView.requirementsFrom(selectedButton));
      void this.fetchPreview();
    } else {
      this.formView.updateRequiredFields([]);
    }
    return this;
  }

  destroy() {
    for (const removeListener of this.listeners.splice(0)) removeListener();
    this.debouncedPreview.cancel();
    this.debouncedTemplateRefresh.cancel();
    this.previewController?.abort();
    this.previewController = null;
    this.templateList.destroy();
  }

  listen(element, eventName, handler) {
    element.addEventListener(eventName, handler);
    this.listeners.push(() => element.removeEventListener(eventName, handler));
  }

  debounce(callback, delay) {
    let timerId;
    const debounced = (...args) => {
      this.clearTimer(timerId);
      timerId = this.setTimer(() => callback(...args), delay);
    };
    debounced.cancel = () => {
      this.clearTimer(timerId);
      timerId = undefined;
    };
    return debounced;
  }

  async fetchPreview({ reportValidity = false } = {}) {
    this.previewController?.abort();
    this.previewController = null;
    if (!this.formView.selectedTemplateId) {
      this.formView.showError('Choose a template from the library.');
      return;
    }
    if (!this.formView.isValid({ report: reportValidity })) return;

    this.formView.clearError();
    const requestController = new this.AbortController();
    this.previewController = requestController;
    try {
      const data = await this.apiClient.preview(this.formView.serialize(), {
        signal: requestController.signal
      });
      if (requestController !== this.previewController) return;
      this.state = {
        subject: data.subject,
        body: data.body,
        followUps: data.followUps || []
      };
      this.formView.renderPreview(this.state);
    } catch (error) {
      if (error.name === 'AbortError' || requestController !== this.previewController) return;
      this.formView.showError(error.message);
    } finally {
      if (requestController === this.previewController) this.previewController = null;
    }
  }

  handleSubmit(event) {
    event.preventDefault();
    void this.fetchPreview({ reportValidity: true });
  }

  async saveHistory() {
    const { saveHistoryButton } = this.elements;
    if (
      this.savingHistory ||
      !this.formView.selectedTemplateId ||
      !this.formView.isValid({ report: true })
    ) {
      return;
    }
    this.savingHistory = true;
    saveHistoryButton.disabled = true;
    try {
      await this.apiClient.saveHistory(this.formView.serialize());
      this.notify('Saved to history.', 'success');
    } catch (error) {
      this.notify(error.message, 'error');
    } finally {
      this.savingHistory = false;
      saveHistoryButton.disabled = false;
    }
  }
}

if (typeof window !== 'undefined') {
  window.OutreachOps = window.OutreachOps || {};
  window.OutreachOps.OutreachGeneratorController = OutreachGeneratorController;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OutreachGeneratorController };
}
