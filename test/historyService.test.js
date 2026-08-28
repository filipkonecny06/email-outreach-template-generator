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
