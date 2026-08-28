const test = require('node:test');
const assert = require('node:assert/strict');

const { OutreachFormView } = require('../src/public/js/outreach-form-view');
const { FakeElement, fakeDocument, fieldContainer } = require('../test-support/browser');

function createView(overrides = {}) {
  const elements = {
    fieldContainers: [],
    form: { checkValidity: () => true, reportValidity() {} },
    formError: { textContent: '' },
    includeFollowUps: { checked: false },
    templateIdInput: { value: '' },
    templateList: { querySelectorAll: () => [] },
    subjectPreview: new FakeElement('pre'),
    bodyPreview: new FakeElement('pre'),
    followUpContainer: new FakeElement('div'),
    ...overrides.elements
  };
  return {
    elements,
    view: new OutreachFormView({
      documentObject: overrides.documentObject || fakeDocument(),
      FormDataImpl:
        overrides.FormDataImpl ||
        class {
          entries() {
            return [];
          }
        },
      elements
    })
  };
}

test('form view serializes active fields and reports invalid forms only when requested', () => {
  let reportCount = 0;
  let valid = false;
  class StubFormData {
    entries() {
      return [
        ['templateId', '7'],
        ['topic', 'research']
      ];
    }
  }
  const { view, elements } = createView({
    FormDataImpl: StubFormData,
    elements: {
      includeFollowUps: { checked: true },
      form: {
        checkValidity: () => valid,
        reportValidity: () => {
          reportCount += 1;
        }
      }
    }
  });

  assert.deepEqual(view.serialize(), {
    templateId: '7',
    topic: 'research',
    includeFollowUps: true
  });
  assert.equal(view.isValid(), false);
  assert.equal(reportCount, 0);
  assert.equal(view.isValid({ report: true }), false);
  assert.equal(reportCount, 1);
  valid = true;
  assert.equal(view.isValid({ report: true }), true);
  assert.equal(reportCount, 1);

  view.showError('Choose a template.');
  assert.equal(elements.formError.textContent, 'Choose a template.');
  view.clearError();
  assert.equal(elements.formError.textContent, '');
});

test('template metadata controls normal and follow-up field requirements', () => {
  const firstName = fieldContainer('firstName');
  const topic = fieldContainer('topic');
  const siteName = fieldContainer('siteName');
  const { view, elements } = createView({
    elements: { fieldContainers: [firstName, topic, siteName] }
  });
  const button = {
    dataset: { requiredFields: '["topic"]', followUpRequiredFields: '["siteName"]' }
  };

  assert.deepEqual(view.parseFieldList('invalid JSON'), []);
  assert.deepEqual(view.parseFieldList('{}'), []);
  assert.deepEqual(view.requirementsFrom(button), {
    requiredFields: ['topic'],
    followUpRequiredFields: ['siteName']
  });
  assert.deepEqual(view.requirementsFrom(undefined), {
    requiredFields: [],
    followUpRequiredFields: []
  });

  view.updateRequiredFields(view.requirementsFrom(button));
  assert.equal(firstName.hidden, true);
  assert.equal(firstName.input.disabled, true);
  assert.equal(topic.hidden, false);
  assert.equal(topic.input.required, true);
  assert.equal(siteName.hidden, true);

  elements.includeFollowUps.checked = true;
  view.updateRequiredFields();
  assert.equal(siteName.hidden, false);
  assert.equal(siteName.input.required, true);

  view.updateRequiredFields(['firstName']);
  assert.equal(firstName.hidden, false);
  assert.equal(siteName.hidden, true);
});

test('selecting a template updates list state, hidden value, and field requirements', () => {
  const other = new FakeElement('button');
  other.classList.add('active');
  const selected = new FakeElement('button');
  selected.dataset.templateId = '7';
  selected.dataset.requiredFields = '["topic"]';
  selected.dataset.followUpRequiredFields = '[]';
  const topic = fieldContainer('topic');
  const { view, elements } = createView({
    elements: {
      fieldContainers: [topic],
      templateList: { querySelectorAll: () => [other, selected] }
    }
  });
  elements.formError.textContent = 'old error';

  view.selectTemplate(selected);

  assert.equal(other.classList.contains('active'), false);
  assert.equal(other.attributes['aria-selected'], 'false');
  assert.equal(selected.classList.contains('active'), true);
  assert.equal(selected.attributes['aria-selected'], 'true');
  assert.equal(view.selectedTemplateId, '7');
  assert.equal(topic.hidden, false);
  assert.equal(elements.formError.textContent, '');
});

test('preview rendering uses text nodes and marks unresolved tokens', () => {
  const { view, elements } = createView();

  view.renderPreview({
    subject: 'Hello {firstName}',
    body: 'Body',
    followUps: [{ sequence: 1, subject: 'Follow up', body: 'Still {topic}' }]
  });

  assert.equal(elements.subjectPreview.children[1].tagName, 'MARK');
  assert.equal(elements.subjectPreview.children[1].textContent, '{firstName}');
  assert.equal(elements.bodyPreview.children.length, 1);
  assert.equal(elements.followUpContainer.children.length, 1);
  assert.equal(elements.followUpContainer.children[0].children[0].textContent, 'Follow-up #1');

  view.renderPreview({ subject: '', body: '', followUps: [] });
  assert.equal(elements.subjectPreview.children[0].textContent, 'No subject generated yet.');
  assert.equal(elements.bodyPreview.children[0].textContent, 'No body generated yet.');
  assert.deepEqual(elements.followUpContainer.children, []);
});
