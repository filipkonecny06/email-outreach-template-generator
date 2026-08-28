const test = require('node:test');
const assert = require('node:assert/strict');

const { OutreachGeneratorController } = require('../src/public/js/outreach-generator-controller');
const { FakeElement, fakeDocument } = require('../test-support/browser');

function createElements() {
  const elements = {
    page: new FakeElement('section'),
    csrfToken: 'csrf-token',
    form: new FakeElement('form'),
    templateList: new FakeElement('ul'),
    templateIdInput: new FakeElement('input'),
    subjectPreview: new FakeElement('pre'),
    bodyPreview: new FakeElement('pre'),
    formError: new FakeElement('p'),
    followUpContainer: new FakeElement('div'),
    categoryFilter: new FakeElement('select'),
    searchInput: new FakeElement('input'),
    favoritesOnly: new FakeElement('input'),
    copySubjectButton: new FakeElement('button'),
    copyBodyButton: new FakeElement('button'),
    downloadTextButton: new FakeElement('button'),
    exportCsvButton: new FakeElement('button'),
    saveHistoryButton: new FakeElement('button'),
    includeFollowUps: new FakeElement('input'),
    fieldContainers: []
  };
  elements.templateIdInput.value = '';
  elements.form.querySelectorAll = () => [];
  elements.templateList.querySelectorAll = () => [];
  return elements;
}

function createHarness(overrides = {}) {
  const elements = overrides.elements || createElements();
  const calls = [];
  const formView = {
    selectedTemplateId: '',
    updateRequiredFields: (value) => calls.push(['requirements', value]),
    requirementsFrom: (button) => ({ button }),
    selectTemplate: (button) => calls.push(['select', button]),
    showError: (message) => calls.push(['error', message]),
    clearError: () => calls.push(['clearError']),
    isValid: () => true,
    serialize: () => ({ templateId: '7' }),
    renderPreview: (state) => calls.push(['render', state]),
    ...overrides.formView
  };
  const apiClient = {
    preview: async () => ({ subject: 'Subject', body: 'Body', followUps: [] }),
    saveHistory: async () => ({ id: 1 }),
    ...overrides.apiClient
  };
  const exportService = {
    copy: (...args) => calls.push(['copy', ...args]),
    downloadText: (state) => calls.push(['text', state]),
    downloadCsv: (state) => calls.push(['csv', state]),
    ...overrides.exportService
  };
  const templateListController = {
    handleClick: (event) => calls.push(['templateClick', event]),
    refresh: () => calls.push(['refresh']),
    destroy: () => calls.push(['destroyTemplateList']),
    ...overrides.templateListController
  };
  const notifications = [];
  const scheduled = [];
  const controller = new OutreachGeneratorController({
    documentObject: overrides.documentObject || fakeDocument(),
    windowObject: { toast: (message, type) => notifications.push({ message, type }) },
    elements,
    formView,
    apiClient,
    exportService,
    templateListController,
    setTimeoutImpl: (callback) => {
      scheduled.push(callback);
      return scheduled.length;
    },
    clearTimeoutImpl() {}
  });
  return {
    controller,
    elements,
    formView,
    apiClient,
    exportService,
    templateListController,
    calls,
    notifications,
    scheduled
  };
}

test('element collection and mounting keep browser bootstrap dependencies explicit', () => {
  const elements = createElements();
  const controls = {
    generatorForm: elements.form,
    templateList: elements.templateList,
    templateId: elements.templateIdInput,
    subjectPreview: elements.subjectPreview,
    bodyPreview: elements.bodyPreview,
    formError: elements.formError,
    followUpContainer: elements.followUpContainer,
    categoryFilter: elements.categoryFilter,
    templateSearch: elements.searchInput,
    favoritesOnly: elements.favoritesOnly,
    copySubjectBtn: elements.copySubjectButton,
    copyBodyBtn: elements.copyBodyButton,
    downloadTxtBtn: elements.downloadTextButton,
    exportCsvBtn: elements.exportCsvButton,
    saveHistoryBtn: elements.saveHistoryButton,
    includeFollowUps: elements.includeFollowUps
  };
  const documentObject = {
    querySelector(selector) {
      if (selector === '[data-page="generator"]') return elements.page;
      if (selector === 'meta[name="csrf-token"]') return { getAttribute: () => 'csrf-token' };
      return null;
    },
    getElementById: (id) => controls[id]
  };

  const collected = OutreachGeneratorController.collectElements(documentObject);
  assert.equal(collected.page, elements.page);
  assert.equal(collected.csrfToken, 'csrf-token');
  assert.deepEqual(collected.fieldContainers, []);
  assert.equal(OutreachGeneratorController.collectElements({ querySelector: () => null }), null);
  assert.equal(
    OutreachGeneratorController.mount({ documentObject: { querySelector: () => null } }),
    null
  );

  const harness = createHarness({ elements: collected, documentObject });
  const mounted = OutreachGeneratorController.mount({
    documentObject,
    elements: collected,
    formView: harness.formView,
    apiClient: harness.apiClient,
    exportService: harness.exportService,
    templateListController: harness.templateListController,
    setTimeoutImpl: () => 1,
    clearTimeoutImpl() {}
  });
  assert.equal(mounted instanceof OutreachGeneratorController, true);
  mounted.destroy();
});

test('initialization routes browser events to focused collaborators and removes listeners', () => {
  const harness = createHarness();
  const { controller, elements, calls, scheduled } = harness;
  controller.init();

  const clickEvent = { target: {} };
  elements.templateList.emit('click', clickEvent);
  elements.searchInput.emit('input');
  elements.categoryFilter.emit('change');
  elements.favoritesOnly.emit('change');
  elements.form.emit('input');
  elements.copySubjectButton.emit('click');
  elements.copyBodyButton.emit('click');
  elements.downloadTextButton.emit('click');
  elements.exportCsvButton.emit('click');
  elements.includeFollowUps.emit('change');

  assert.equal(
    calls.some(([name]) => name === 'templateClick'),
    true
  );
  assert.equal(calls.filter(([name]) => name === 'refresh').length, 2);
  assert.equal(scheduled.length, 2);
  assert.deepEqual(
    calls.filter(([name]) => name === 'copy'),
    [
      ['copy', 'subject', ''],
      ['copy', 'body', '']
    ]
  );
  assert.equal(
    calls.some(([name]) => name === 'text'),
    true
  );
  assert.equal(
    calls.some(([name]) => name === 'csv'),
    true
  );

  let previewAborted = false;
  controller.previewController = { abort: () => (previewAborted = true) };
  controller.destroy();
  assert.equal(previewAborted, true);
  assert.equal(
    calls.some(([name]) => name === 'destroyTemplateList'),
    true
  );
  assert.equal(controller.listeners.length, 0);
  assert.equal(elements.templateList.listeners.size, 0);
});

test('an initially selected template is prepared and previewed immediately', async () => {
  const selected = new FakeElement('button');
  selected.dataset.templateId = '7';
  const elements = createElements();
  elements.templateIdInput.value = '7';
  elements.templateList.querySelectorAll = () => [selected];
  const harness = createHarness({
    elements,
    formView: { selectedTemplateId: '7' }
  });

  harness.controller.init();
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(harness.calls[0], ['requirements', { button: selected }]);
  assert.equal(
    harness.calls.some(([name]) => name === 'render'),
    true
  );
  harness.controller.destroy();
});

test('preview requests validate selection and ignore stale out-of-order responses', async () => {
  const pending = [];
  const harness = createHarness({
    formView: { selectedTemplateId: '' },
    apiClient: {
      preview: (_payload, options) =>
        new Promise((resolve) => pending.push({ resolve, signal: options.signal }))
    }
  });
  const { controller, formView, calls } = harness;

  await controller.fetchPreview();
  assert.deepEqual(calls.at(-1), ['error', 'Choose a template from the library.']);

  formView.selectedTemplateId = '7';
  formView.isValid = ({ report }) => !report;
  await controller.fetchPreview({ reportValidity: true });
  assert.equal(pending.length, 0);

  formView.isValid = () => true;
  const stale = controller.fetchPreview();
  const current = controller.fetchPreview();
  assert.equal(pending[0].signal.aborted, true);
  assert.equal(pending[1].signal.aborted, false);

  pending[1].resolve({ subject: 'Current', body: 'Body', followUps: undefined });
  await current;
  pending[0].resolve({ subject: 'Stale', body: 'Old', followUps: [] });
  await stale;

  assert.deepEqual(controller.state, { subject: 'Current', body: 'Body', followUps: [] });
  assert.equal(calls.filter(([name]) => name === 'render').length, 1);
});

test('invalid edits abort earlier previews and current API failures reach the form', async () => {
  let resolvePreview;
  const harness = createHarness({
    formView: { selectedTemplateId: '7' },
    apiClient: {
      preview: () => new Promise((resolve) => (resolvePreview = resolve))
    }
  });
  const pending = harness.controller.fetchPreview();
  const signal = harness.controller.previewController.signal;
  harness.formView.isValid = () => false;
  await harness.controller.fetchPreview();
  assert.equal(signal.aborted, true);
  resolvePreview({ subject: 'Stale', body: 'Body', followUps: [] });
  await pending;
  assert.equal(
    harness.calls.some(([name]) => name === 'render'),
    false
  );

  harness.formView.isValid = () => true;
  harness.apiClient.preview = async () => {
    throw new Error('Preview unavailable.');
  };
  await harness.controller.fetchPreview();
  assert.deepEqual(harness.calls.at(-1), ['error', 'Preview unavailable.']);

  harness.apiClient.preview = async () => {
    const error = new Error('aborted');
    error.name = 'AbortError';
    throw error;
  };
  await harness.controller.fetchPreview();
  assert.notDeepEqual(harness.calls.at(-1), ['error', 'aborted']);
});

test('submit and history persistence enforce validity, mutation locks, and button recovery', async () => {
  let prevented = false;
  let resolveSave;
  let saveCalls = 0;
  const harness = createHarness({
    formView: { selectedTemplateId: '' },
    apiClient: {
      saveHistory: async () => {
        saveCalls += 1;
        return new Promise((resolve) => (resolveSave = resolve));
      }
    }
  });
  harness.controller.handleSubmit({ preventDefault: () => (prevented = true) });
  assert.equal(prevented, true);
  await harness.controller.saveHistory();
  assert.equal(saveCalls, 0);

  harness.formView.selectedTemplateId = '7';
  harness.formView.isValid = () => false;
  await harness.controller.saveHistory();
  assert.equal(saveCalls, 0);

  harness.formView.isValid = () => true;
  const first = harness.controller.saveHistory();
  const duplicate = harness.controller.saveHistory();
  assert.equal(saveCalls, 1);
  assert.equal(harness.elements.saveHistoryButton.disabled, true);
  resolveSave({ id: 9 });
  await Promise.all([first, duplicate]);
  assert.equal(harness.elements.saveHistoryButton.disabled, false);
  assert.deepEqual(harness.notifications.at(-1), {
    message: 'Saved to history.',
    type: 'success'
  });

  harness.apiClient.saveHistory = async () => {
    throw new Error('History unavailable.');
  };
  await harness.controller.saveHistory();
  assert.deepEqual(harness.notifications.at(-1), {
    message: 'History unavailable.',
    type: 'error'
  });
  assert.equal(harness.controller.savingHistory, false);
  assert.equal(harness.elements.saveHistoryButton.disabled, false);
});
