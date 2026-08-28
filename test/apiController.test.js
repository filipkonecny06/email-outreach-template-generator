const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DB_HOST = '127.0.0.1';
process.env.DB_NAME = 'outreach_test';
process.env.DB_USER = 'outreach';

const { ApiController } = require('../src/controllers/apiController');
const { outreachFieldRules } = require('../src/middleware/validation');

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

async function runRules(rules, req) {
  await Promise.all(rules.map((rule) => rule.run(req)));
}

function controller(overrides = {}) {
  return new ApiController({
    TemplateModel: { findByPk: async () => ({ id: 7 }) },
    FavoriteModel: { findOrCreate: async () => [{ destroy: async () => {} }, true] },
    GenerationHistoryModel: { create: async () => ({ id: 1 }) },
    generationService: {
      renderFromTemplate: async () => ({
        template: { id: 7 },
        subject: 'Subject',
        body: 'Body',
        followUps: []
      }),
      getTemplates: async () => []
    },
    ...overrides
  });
}

test('creating a favorite performs one atomic find-or-create and no duplicate insert', async () => {
  const calls = [];
  const FavoriteModel = {
    async findOrCreate(options) {
      calls.push(options);
      return [{ destroy: async () => assert.fail('new favorites must not be destroyed') }, true];
    },
    async create() {
      assert.fail('findOrCreate already inserted the favorite');
    }
  };
  const res = responseRecorder();
  const errors = [];

  await controller({ FavoriteModel }).toggleFavorite(
    { params: { templateId: '7' }, session: { user: { id: 42 } } },
    res,
    (error) => errors.push(error)
  );

  assert.deepEqual(errors, []);
  assert.deepEqual(res.body, { favorited: true });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    where: { UserId: 42, TemplateId: 7 },
    defaults: { UserId: 42, TemplateId: 7 }
  });
});

test('toggling an existing favorite removes that exact record', async () => {
  let destroyed = false;
  const FavoriteModel = {
    async findOrCreate() {
      return [
        {
          async destroy() {
            destroyed = true;
          }
        },
        false
      ];
    }
  };
  const res = responseRecorder();

  await controller({ FavoriteModel }).toggleFavorite(
    { params: { templateId: '7' }, session: { user: { id: 42 } } },
    res,
    assert.fail
  );

  assert.equal(destroyed, true);
  assert.deepEqual(res.body, { favorited: false });
});

test('preview validation uses a consistent details array before generation', async () => {
  const req = {
    id: 'validation-request-id',
    body: { templateId: 0, tone: 'casual', length: 'huge' }
  };
  await runRules(outreachFieldRules, req);
  const res = responseRecorder();

  await controller().preview(req, res, assert.fail);

  assert.equal(res.statusCode, 422);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  assert.ok(Array.isArray(res.body.error.details));
  assert.ok(res.body.error.details.some((detail) => detail.field === 'templateId'));
  assert.equal(res.body.error.requestId, 'validation-request-id');
});

test('template API delegates filtering and returns only public template metadata', async () => {
  let filters;
  const generationService = {
    async getTemplates(received) {
      filters = received;
      return [
        {
          id: 7,
          name: 'Research pitch',
          category: 'PR',
          requiredFields: ['topic'],
          followUpRequiredFields: ['siteName'],
          isFavorite: true,
          subjectTemplate: 'internal template content'
        }
      ];
    }
  };
  const res = responseRecorder();

  await controller({ generationService }).getTemplates(
    {
      query: { search: '  research  ', category: ' PR ', favorites: 'true' },
      session: { user: { id: 42 } }
    },
    res,
    assert.fail
  );

  assert.deepEqual(filters, {
    search: 'research',
    category: 'PR',
    userId: 42,
    onlyFavorites: true
  });
  assert.deepEqual(res.body, [
    {
      id: 7,
      name: 'Research pitch',
      category: 'PR',
      requiredFields: ['topic'],
      followUpRequiredFields: ['siteName'],
      isFavorite: true
    }
  ]);
});

test('history saves the server-rendered content and template identity', async () => {
  const req = {
    body: { templateId: '7', tone: 'friendly', length: 'medium' },
    session: { user: { id: 42 } }
  };
  await runRules(outreachFieldRules, req);
  let created;
  const GenerationHistoryModel = {
    async create(record) {
      created = record;
      return { id: 99 };
    }
  };
  const res = responseRecorder();

  await controller({ GenerationHistoryModel }).saveHistory(req, res, assert.fail);

  assert.equal(res.statusCode, 201);
  assert.equal(created.UserId, 42);
  assert.equal(created.TemplateId, 7);
  assert.equal(created.subject, 'Subject');
  assert.equal(created.body, 'Body');
  assert.deepEqual(res.body, { id: 99, message: 'Saved to history.' });
});
