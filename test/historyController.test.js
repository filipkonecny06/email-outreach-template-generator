const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DB_HOST = '127.0.0.1';
process.env.DB_NAME = 'outreach_test';
process.env.DB_USER = 'outreach';

const { HistoryController } = require('../src/controllers/historyController');
const { requestedPageNumber } = require('../src/services/historyService');

function responseRecorder() {
  return {
    statusCode: 200,
    view: undefined,
    locals: undefined,
    redirectPath: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    render(view, locals) {
      this.view = view;
      this.locals = locals;
      return this;
    },
    redirect(path) {
      this.redirectPath = path;
      return this;
    }
  };
}

test('history listing validates pagination and preserves filters in navigation links', async () => {
  assert.equal(requestedPageNumber('invalid'), 1);
  assert.equal(requestedPageNumber('-2'), 1);
  assert.equal(requestedPageNumber('5000'), 5000);
  let listOptions;
  const historyService = {
    async listPage(options) {
      listOptions = options;
      return { total: 60, page: 3, entries: [{ id: 51 }] };
    }
  };
  const controller = new HistoryController({
    GenerationHistoryModel: {},
    TemplateModel: {},
    historyService
  });
  const res = responseRecorder();

  await controller.historyPage(
    {
      query: { page: '9999', search: '  campaign  ', order: 'oldest' },
      session: { user: { id: 42 } }
    },
    res,
    assert.fail
  );

  assert.equal(listOptions.where.UserId, 42);
  assert.equal(listOptions.requestedPage, 9999);
  assert.equal(listOptions.order, 'ASC');
  assert.equal(res.view, 'history');
  assert.equal(res.locals.pagination.page, 3);
  assert.equal(res.locals.pagination.previousUrl, '/history?page=2&order=oldest&search=campaign');
  assert.equal(res.locals.pagination.nextUrl, null);
});

test('history deletion destroys only a record owned by the current user', async () => {
  let lookup;
  let destroyed = false;
  const GenerationHistoryModel = {
    async findOne(options) {
      lookup = options;
      return {
        payload: { private: 'campaign data' },
        async update() {
          assert.fail('deletion must not retain a soft-deleted payload');
        },
        async destroy() {
          destroyed = true;
        }
      };
    }
  };
  const controller = new HistoryController({ GenerationHistoryModel, TemplateModel: {} });
  const res = responseRecorder();

  await controller.deleteHistoryEntry(
    { params: { id: '9' }, session: { user: { id: 42 } } },
    res,
    assert.fail
  );

  assert.deepEqual(lookup.where, { id: 9, UserId: 42 });
  assert.equal(destroyed, true);
  assert.equal(res.redirectPath, '/history');
});

test('history deletion does not reveal or alter another user record', async () => {
  let lookup;
  const GenerationHistoryModel = {
    async findOne(options) {
      lookup = options;
      return null;
    }
  };
  const controller = new HistoryController({ GenerationHistoryModel, TemplateModel: {} });
  const res = responseRecorder();

  await controller.deleteHistoryEntry(
    { params: { id: '9' }, session: { user: { id: 7 } } },
    res,
    assert.fail
  );

  assert.deepEqual(lookup.where, { id: 9, UserId: 7 });
  assert.equal(res.statusCode, 404);
  assert.equal(res.view, '404');
});

test('invalid history identifiers return not found without querying storage', async () => {
  const controller = new HistoryController({
    GenerationHistoryModel: {
      findOne: async () => assert.fail('invalid identifiers must not reach the database')
    },
    TemplateModel: {}
  });
  const res = responseRecorder();

  await controller.deleteHistoryEntry(
    { params: { id: 'invalid' }, session: { user: { id: 7 } } },
    res,
    assert.fail
  );

  assert.equal(res.statusCode, 404);
  assert.equal(res.view, '404');
});
