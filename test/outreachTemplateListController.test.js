const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OutreachTemplateListController
} = require('../src/public/js/outreach-template-list-controller');
const { FakeElement, fakeDocument, findElement } = require('../test-support/browser');

function createController(overrides = {}) {
  const notifications = [];
  const elements = {
    templateIdInput: { value: '' },
    searchInput: { value: '' },
    categoryFilter: { value: '' },
    favoritesOnly: { checked: false },
    templateList: new FakeElement('ul'),
    ...overrides.elements
  };
  const controller = new OutreachTemplateListController({
    documentObject: fakeDocument(),
    elements,
    apiClient: overrides.apiClient || {},
    onSelect: overrides.onSelect || (() => {}),
    notify: (message, type) => notifications.push({ message, type })
  });
  return { controller, elements, notifications };
}

test('template rows render server values as text and preserve selection metadata', () => {
  const maliciousName = '"><img src=x onerror=alert(1)>';
  const { controller, elements } = createController();
  elements.templateIdInput.value = '7';

  const row = controller.buildRow({
    id: 7,
    name: maliciousName,
    category: '<script>unsafe()</script>',
    requiredFields: ['topic'],
    followUpRequiredFields: ['siteName'],
    isFavorite: true
  });

  const selectButton = findElement(row, 'button');
  assert.equal(findElement(row, 'strong').textContent, maliciousName);
  assert.equal(findElement(row, 'small').textContent, '<script>unsafe()</script>');
  assert.equal(selectButton.attributes['aria-label'], `Select ${maliciousName}`);
  assert.equal(selectButton.dataset.requiredFields, '["topic"]');
  assert.equal(selectButton.dataset.followUpRequiredFields, '["siteName"]');
  assert.equal(selectButton.classList.contains('active'), true);
  assert.equal(row.children[1].classList.contains('active'), true);
  assert.equal(findElement(row, 'img'), undefined);
  assert.equal(findElement(row, 'script'), undefined);

  elements.templateIdInput.value = '';
  const plainRow = controller.buildRow({ id: 8, name: 'Plain', category: 'PR' });
  assert.equal(plainRow.children.length, 1);
  assert.equal(plainRow.children[0].classList.contains('active'), false);
});

test('click routing and favorite locks keep browser mutations deterministic', async () => {
  let selected;
  let resolveFavorite;
  let favoriteCalls = 0;
  const { controller, notifications } = createController({
    onSelect: (button) => {
      selected = button;
    },
    apiClient: {
      toggleFavorite: async () => {
        favoriteCalls += 1;
        return new Promise((resolve) => {
          resolveFavorite = resolve;
        });
      }
    }
  });
  const favoriteButton = new FakeElement('button');
  favoriteButton.dataset.favoriteId = '7';
  favoriteButton.closest = (selector) =>
    selector === '.favorite-toggle' ? favoriteButton : undefined;
  let prevented = false;
  let stopped = false;

  controller.handleClick({
    target: favoriteButton,
    preventDefault: () => (prevented = true),
    stopPropagation: () => (stopped = true)
  });
  const duplicate = controller.toggleFavorite(favoriteButton);
  assert.equal(favoriteCalls, 1);
  assert.equal(favoriteButton.disabled, true);
  assert.equal(prevented, true);
  assert.equal(stopped, true);

  resolveFavorite({ favorited: true });
  await duplicate;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(favoriteButton.disabled, false);
  assert.equal(favoriteButton.classList.contains('active'), true);
  assert.equal(favoriteButton.attributes['aria-pressed'], 'true');
  assert.deepEqual(notifications, [{ message: 'Template favorited.', type: 'success' }]);

  const selectButton = new FakeElement('button');
  selectButton.closest = (selector) => (selector === '.favorite-toggle' ? undefined : selectButton);
  controller.handleClick({ target: selectButton });
  assert.equal(selected, selectButton);

  const inertTarget = { closest: () => undefined };
  controller.handleClick({ target: inertTarget });
  assert.equal(selected, selectButton);
});

test('favorite API failures restore controls and report the server message', async () => {
  const button = new FakeElement('button');
  button.dataset.favoriteId = '9';
  const { controller, notifications } = createController({
    apiClient: {
      toggleFavorite: async () => {
        throw new Error('Favorite unavailable.');
      }
    }
  });

  await controller.toggleFavorite(button);

  assert.equal(button.disabled, false);
  assert.equal(controller.pendingFavoriteIds.size, 0);
  assert.deepEqual(notifications, [{ message: 'Favorite unavailable.', type: 'error' }]);
});

test('newer template refreshes supersede stale out-of-order responses', async () => {
  const pending = [];
  const calls = [];
  const rendered = [];
  const { controller, elements } = createController({
    apiClient: {
      listTemplates(filters, options) {
        calls.push({ filters, options });
        return new Promise((resolve) => pending.push(resolve));
      }
    }
  });
  controller.buildRow = (template) => template.name;
  elements.templateList.replaceChildren = (...rows) => rendered.splice(0, rendered.length, ...rows);
  elements.searchInput.value = 'old';

  const staleRefresh = controller.refresh();
  elements.searchInput.value = 'new';
  elements.categoryFilter.value = 'PR';
  elements.favoritesOnly.checked = true;
  const currentRefresh = controller.refresh();

  assert.equal(calls[0].options.signal.aborted, true);
  assert.equal(calls[1].options.signal.aborted, false);
  assert.deepEqual(calls[1].filters, { search: 'new', category: 'PR', favorites: true });
  pending[1]([{ name: 'New result' }]);
  await currentRefresh;
  pending[0]([{ name: 'Old result' }]);
  await staleRefresh;

  assert.deepEqual(rendered, ['New result']);
  assert.equal(controller.refreshController, null);
});

test('refresh errors are reported, abort errors are ignored, and destroy cancels work', async () => {
  const failures = [new Error('Template service unavailable.'), { name: 'AbortError' }];
  const { controller, notifications } = createController({
    apiClient: { listTemplates: async () => Promise.reject(failures.shift()) }
  });

  await controller.refresh();
  await controller.refresh();
  assert.deepEqual(notifications, [{ message: 'Template service unavailable.', type: 'error' }]);

  let aborted = false;
  controller.refreshController = { abort: () => (aborted = true) };
  const revision = controller.refreshRevision;
  controller.destroy();
  assert.equal(aborted, true);
  assert.equal(controller.refreshController, null);
  assert.equal(controller.refreshRevision, revision + 1);
});
