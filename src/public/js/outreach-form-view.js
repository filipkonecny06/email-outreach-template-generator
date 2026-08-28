class OutreachFormView {
  constructor({
    documentObject = globalThis.document,
    FormDataImpl = globalThis.FormData,
    elements
  }) {
    this.document = documentObject;
    this.FormData = FormDataImpl;
    this.elements = elements;
    this.fieldContainers = elements.fieldContainers || [];
    this.selectedRequirements = { requiredFields: [], followUpRequiredFields: [] };
  }

  get selectedTemplateId() {
    return this.elements.templateIdInput.value;
  }

  serialize() {
    const data = Object.fromEntries(new this.FormData(this.elements.form).entries());
    data.includeFollowUps = Boolean(this.elements.includeFollowUps.checked);
    return data;
  }

  isValid({ report = false } = {}) {
    const valid = this.elements.form.checkValidity();
    if (!valid && report) this.elements.form.reportValidity();
    return valid;
  }

  showError(message) {
    this.elements.formError.textContent = message;
  }

  clearError() {
    this.showError('');
  }

  parseFieldList(value) {
    try {
      const fields = JSON.parse(value || '[]');
      return Array.isArray(fields) ? fields : [];
    } catch {
      return [];
    }
  }

  requirementsFrom(button) {
    return {
      requiredFields: this.parseFieldList(button?.dataset.requiredFields),
      followUpRequiredFields: this.parseFieldList(button?.dataset.followUpRequiredFields)
    };
  }

  updateRequiredFields(requirements = this.selectedRequirements) {
    this.selectedRequirements = Array.isArray(requirements)
      ? { requiredFields: requirements, followUpRequiredFields: [] }
      : requirements;
    const activeFields = new Set(this.selectedRequirements.requiredFields);
    if (this.elements.includeFollowUps?.checked) {
      for (const field of this.selectedRequirements.followUpRequiredFields) activeFields.add(field);
    }
    for (const container of this.fieldContainers) {
      const input = container.querySelector('[name]');
      const isActive = activeFields.has(container.dataset.outreachField);
      container.hidden = !isActive;
      input.disabled = !isActive;
      input.required = isActive;
    }
  }

  selectTemplate(button) {
    this.elements.templateList.querySelectorAll('.template-item').forEach((item) => {
      item.classList.remove('active');
      item.setAttribute('aria-selected', 'false');
    });
    button.classList.add('active');
    button.setAttribute('aria-selected', 'true');
    this.elements.templateIdInput.value = button.dataset.templateId;
    this.updateRequiredFields(this.requirementsFrom(button));
    this.clearError();
  }

  renderHighlightedText(element, value) {
    const text = String(value);
    const nodes = [];
    const tokenPattern = /\{[a-zA-Z0-9_]+\}/g;
    let cursor = 0;

    for (const match of text.matchAll(tokenPattern)) {
      if (match.index > cursor) {
        nodes.push(this.document.createTextNode(text.slice(cursor, match.index)));
      }
      const mark = this.document.createElement('mark');
      mark.textContent = match[0];
      nodes.push(mark);
      cursor = match.index + match[0].length;
    }
    if (cursor < text.length || nodes.length === 0) {
      nodes.push(this.document.createTextNode(text.slice(cursor)));
    }
    element.replaceChildren(...nodes);
  }

  renderPreview(state) {
    const { subjectPreview, bodyPreview, followUpContainer } = this.elements;
    this.renderHighlightedText(subjectPreview, state.subject || 'No subject generated yet.');
    this.renderHighlightedText(bodyPreview, state.body || 'No body generated yet.');

    const followUps = state.followUps.map((followUp) => {
      const block = this.document.createElement('div');
      block.className = 'preview-block';
      const heading = this.document.createElement('h3');
      heading.textContent = `Follow-up #${followUp.sequence}`;
      const preview = this.document.createElement('pre');
      preview.className = 'preview-text';
      this.renderHighlightedText(preview, `Subject: ${followUp.subject}\n\n${followUp.body}`);
      block.append(heading, preview);
      return block;
    });
    followUpContainer.replaceChildren(...followUps);
  }
}

if (typeof window !== 'undefined') {
  window.OutreachOps = window.OutreachOps || {};
  window.OutreachOps.OutreachFormView = OutreachFormView;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OutreachFormView };
}
