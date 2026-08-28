const test = require('node:test');
const assert = require('node:assert/strict');

const { TemplateBrowserController } = require('../src/controllers/templateBrowserController');

function responseRecorder() {
  return {
    statusCode: 200,
    view: undefined,
    locals: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    render(view, locals) {
      this.view = view;
      this.locals = locals;
      return this;
    }
  };
}

test('generator page selects a requested template and loads the user favorites', async () => {
  const templates = [
    { id: 1 },
    {
      id: 7,
      requiredFields: ['topic', 'siteName'],
      subjectTemplate: '{topic}',
      bodyTemplate: 'Main copy',
      followUp1BodyTemplate: 'Follow-up for {siteName}'
    }
  ];
  const repository = {
    list: async () => templates,
    listFavoriteIds: async (userId) => {
      assert.equal(userId, 42);
      return [7];
    }
  };
  const controller = new TemplateBrowserController({
    templateRepository: repository,
    categories: ['PR']
  });
  const res = responseRecorder();

  await controller.generatorPage(
    { query: { templateId: '7' }, session: { user: { id: 42 } } },
    res,
    assert.fail
  );

  assert.equal(res.view, 'generator');
  assert.equal(res.locals.selectedTemplate.id, 7);
  assert.deepEqual(res.locals.selectedTemplate.requiredFields, ['topic']);
  assert.deepEqual(res.locals.selectedTemplate.followUpRequiredFields, ['siteName']);
  assert.deepEqual(res.locals.favoriteIds, [7]);
});

test('browser filters are normalized before repository access', async () => {
  let filters;
  const repository = {
    async list(received) {
      filters = received;
      return [];
    }
  };
  const controller = new TemplateBrowserController({
    templateRepository: repository,
    categories: ['PR']
  });
  const res = responseRecorder();

  await controller.templatesPage(
    { query: { search: `  ${'x'.repeat(140)}  `, category: ' PR ' } },
    res,
    assert.fail
  );

  assert.equal(filters.search.length, 120);
  assert.equal(filters.category, 'PR');
  assert.equal(res.view, 'templates');
});

test('missing template detail returns the dedicated not-found page', async () => {
  const controller = new TemplateBrowserController({
    templateRepository: { findById: async () => null },
    categories: []
  });
  const res = responseRecorder();

  await controller.templateDetailPage({ params: { id: '999' } }, res, assert.fail);

  assert.equal(res.statusCode, 404);
  assert.equal(res.view, '404');
});

test('invalid template detail identifiers return not found without querying storage', async () => {
  const controller = new TemplateBrowserController({
    templateRepository: {
      findById: async () => assert.fail('invalid identifiers must not reach the repository')
    },
    categories: []
  });
  const res = responseRecorder();

  await controller.templateDetailPage({ params: { id: 'not-a-number' } }, res, assert.fail);

  assert.equal(res.statusCode, 404);
  assert.equal(res.view, '404');
});
