const test = require('node:test');
const assert = require('node:assert/strict');

const {
  HISTORY_PAGINATION_INDEX,
  parseSchemaMode,
  verifyHistorySchema
} = require('../scripts/database-smoke');

function queryInterface({ deletedAt = false, paginationIndex = false, fields } = {}) {
  return {
    async describeTable() {
      return { id: {}, UserId: {}, createdAt: {}, ...(deletedAt ? { deletedAt: {} } : {}) };
    },
    async showIndex() {
      return paginationIndex
        ? [
            {
              name: HISTORY_PAGINATION_INDEX,
              fields: fields || [{ attribute: 'UserId' }, { name: 'createdAt' }, 'id']
            }
          ]
        : [];
    }
  };
}

test('database smoke defaults to current and accepts explicit migration states', () => {
  assert.equal(parseSchemaMode([]), 'current');
  assert.equal(parseSchemaMode(['--schema=current']), 'current');
  assert.equal(parseSchemaMode(['--schema=legacy']), 'legacy');
  assert.throws(() => parseSchemaMode(['current']), /--schema=<current\|legacy>/);
});

test('current schema requires hard-delete history and the ordered pagination index', async () => {
  await verifyHistorySchema(queryInterface({ paginationIndex: true }), 'current');
  await assert.rejects(
    verifyHistorySchema(queryInterface({ deletedAt: true, paginationIndex: true }), 'current'),
    /must not contain deletedAt/
  );
  await assert.rejects(verifyHistorySchema(queryInterface(), 'current'), /must contain/);
  await assert.rejects(
    verifyHistorySchema(
      queryInterface({ paginationIndex: true, fields: ['UserId', 'id', 'createdAt'] }),
      'current'
    ),
    /must cover UserId, createdAt, id in order/
  );
});

test('legacy schema requires deletedAt and excludes the pagination index', async () => {
  await verifyHistorySchema(queryInterface({ deletedAt: true }), 'legacy');
  await assert.rejects(verifyHistorySchema(queryInterface(), 'legacy'), /must contain deletedAt/);
  await assert.rejects(
    verifyHistorySchema(queryInterface({ deletedAt: true, paginationIndex: true }), 'legacy'),
    /must not contain generation_history_user_created_id/
  );
  await assert.rejects(
    verifyHistorySchema(queryInterface({ deletedAt: true }), 'future'),
    /Unknown history schema mode/
  );
});
