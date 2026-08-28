const test = require('node:test');
const assert = require('node:assert/strict');

const {
  HISTORY_PAGE_SIZE,
  HistoryService,
  pageForCount,
  requestedPageNumber
} = require('../src/services/historyService');

test('count-backed history pagination clamps to the real last page', async () => {
  let query;
  const service = new HistoryService({
    GenerationHistoryModel: {
      count: async ({ where }) => {
        assert.deepEqual(where, { UserId: 42 });
        return 60;
      },
      findAll: async (options) => {
        query = options;
        return [{ id: 51 }];
      }
    },
    TemplateModel: { name: 'Template' }
  });

  const result = await service.listPage({
    where: { UserId: 42 },
    requestedPage: requestedPageNumber('999999999999999999999'),
    order: 'DESC'
  });

  assert.equal(result.page, 3);
  assert.equal(result.totalPages, 3);
  assert.equal(result.total, 60);
  assert.equal(query.limit, HISTORY_PAGE_SIZE);
  assert.equal(query.offset, 50);
  assert.deepEqual(query.order, [
    ['createdAt', 'DESC'],
    ['id', 'DESC']
  ]);
});

test('pagination keeps pages beyond 1000 reachable and handles an empty history', async () => {
  assert.deepEqual(pageForCount(1200, 30000), {
    page: 1200,
    totalPages: 1200,
    offset: 29975
  });

  const service = new HistoryService({
    GenerationHistoryModel: {
      count: async () => 0,
      findAll: async () => assert.fail('an empty history must not run a row query')
    },
    TemplateModel: {}
  });
  const result = await service.listPage({ where: { UserId: 42 }, requestedPage: 50, order: 'ASC' });

  assert.deepEqual(result, {
    entries: [],
    total: 0,
    page: 1,
    totalPages: 1,
    offset: 0
  });
});

test('user history owns filtering, injected page size, saving, and deletion', async () => {
  const calls = [];
  const entry = { destroy: async () => calls.push('destroy') };
  const historyRepository = {
    count: async (where) => {
      calls.push(['count', where]);
      return 11;
    },
    findPage: async (query) => {
      calls.push(['findPage', query]);
      return [{ id: 1 }];
    },
    create: async (record) => {
      calls.push(['create', record]);
      return { id: 9 };
    },
    findOwnedById: async (id, userId) => {
      calls.push(['findOwnedById', id, userId]);
      return entry;
    }
  };
  const service = new HistoryService({ historyRepository, pageSize: 10 });

  const page = await service.listForUser({
    userId: 42,
    search: 'campaign',
    requestedPage: 1,
    order: 'DESC'
  });
  assert.equal(page.totalPages, 2);
  assert.equal(calls[0][1].UserId, 42);
  assert.equal(calls[0][1][require('sequelize').Op.or].length, 2);
  assert.equal(calls[1][1].limit, 10);

  const rendered = { template: { id: 7 }, subject: 'Subject', body: 'Body' };
  assert.deepEqual(
    await service.saveSnapshot({ userId: 42, rendered, payload: { tone: 'direct' } }),
    {
      id: 9
    }
  );
  assert.equal(await service.deleteOwned({ entryId: 9, userId: 42 }), true);
  historyRepository.findOwnedById = async () => null;
  assert.equal(await service.deleteOwned({ entryId: 9, userId: 7 }), false);
});
