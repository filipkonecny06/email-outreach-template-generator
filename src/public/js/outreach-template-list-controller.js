class OutreachTemplateListController {
  constructor({
    documentObject = globalThis.document,
    AbortControllerImpl = globalThis.AbortController,
    elements,
    apiClient,
    onSelect,
    notify
  }) {
    this.document = documentObject;
    this.AbortController = AbortControllerImpl;
    this.elements = elements;
    this.apiClient = apiClient;
    this.onSelect = onSelect;
    this.notify = notify;
    this.pendingFavoriteIds = new Set();
    this.refreshController = null;
    this.refreshRevision = 0;
  }

  destroy() {
    this.refreshController?.abort();
    this.refreshController = null;
    this.refreshRevision += 1;
  }

  handleClick(event) {
    const favoriteToggle = event.target.closest('.favorite-toggle');
    if (favoriteToggle) {
      event.preventDefault();
      event.stopPropagation();
      void this.toggleFavorite(favoriteToggle);
      return;
    }

    const button = event.target.closest('.template-item');
    if (button) this.onSelect(button);
  }

  async toggleFavorite(button) {
    const templateId = button.dataset.favoriteId;
    if (this.pendingFavoriteIds.has(templateId)) return;
    this.pendingFavoriteIds.add(templateId);
    button.disabled = true;

    try {
      const data = await this.apiClient.toggleFavorite(templateId);
      button.classList.toggle('active', data.favorited);
      button.setAttribute('aria-pressed', String(data.favorited));
      this.notify(`Template ${data.favorited ? 'favorited' : 'unfavorited'}.`, 'success');
    } catch (error) {
      this.notify(error.message, 'error');
    } finally {
      this.pendingFavoriteIds.delete(templateId);
      button.disabled = false;
    }
  }

  buildRow(template) {
    const row = this.document.createElement('li');
    row.className = 'template-row';

    const selectButton = this.document.createElement('button');
    selectButton.type = 'button';
    selectButton.className = 'template-item';
    selectButton.dataset.templateId = String(template.id);
    selectButton.dataset.requiredFields = JSON.stringify(template.requiredFields || []);
    selectButton.dataset.followUpRequiredFields = JSON.stringify(
      template.followUpRequiredFields || []
    );
    selectButton.setAttribute('aria-label', `Select ${template.name}`);
    selectButton.setAttribute('aria-selected', 'false');

    const label = this.document.createElement('span');
    const name = this.document.createElement('strong');
    const category = this.document.createElement('small');
    name.textContent = template.name;
    category.textContent = template.category;
    label.append(name, category);
    selectButton.append(label);
    row.append(selectButton);

    if (template.isFavorite !== undefined) {
      const favoriteButton = this.document.createElement('button');
      favoriteButton.type = 'button';
      favoriteButton.className = 'favorite-toggle';
      if (template.isFavorite) favoriteButton.classList.add('active');
      favoriteButton.dataset.favoriteId = String(template.id);
      favoriteButton.setAttribute('aria-pressed', String(template.isFavorite));
      favoriteButton.setAttribute('aria-label', `Toggle favorite for ${template.name}`);
      favoriteButton.textContent = '★';
      row.append(favoriteButton);
    }

    if (String(template.id) === this.elements.templateIdInput.value) {
      selectButton.classList.add('active');
      selectButton.setAttribute('aria-selected', 'true');
    }
    return row;
  }

  async refresh() {
    const { searchInput, categoryFilter, favoritesOnly, templateList } = this.elements;
    this.refreshController?.abort();
    const requestController = new this.AbortController();
    const requestRevision = this.refreshRevision + 1;
    this.refreshRevision = requestRevision;
    this.refreshController = requestController;

    try {
      const templates = await this.apiClient.listTemplates(
        {
          search: searchInput.value,
          category: categoryFilter.value,
          favorites: favoritesOnly.checked
        },
        { signal: requestController.signal }
      );
      if (
        requestController !== this.refreshController ||
        requestRevision !== this.refreshRevision
      ) {
        return;
      }
      templateList.replaceChildren(...templates.map((template) => this.buildRow(template)));
    } catch (error) {
      if (
        error.name === 'AbortError' ||
        requestController !== this.refreshController ||
        requestRevision !== this.refreshRevision
      ) {
        return;
      }
      this.notify(error.message, 'error');
    } finally {
      if (requestController === this.refreshController) this.refreshController = null;
    }
  }
}

if (typeof window !== 'undefined') {
  window.OutreachOps = window.OutreachOps || {};
  window.OutreachOps.OutreachTemplateListController = OutreachTemplateListController;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OutreachTemplateListController };
}
