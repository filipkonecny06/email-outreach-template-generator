const test = require('node:test');
const assert = require('node:assert/strict');

const migration = require('../migrations/20260828000200-add-history-pagination-index');

function index(name, fields) {
  return { name, fields: fields.map((attribute) => ({ attribute })) };
}

function queryInterface(indexes) {
  const calls = [];
  return {
    calls,
    async showIndex(table) {
      calls.push(['showIndex', table]);
      return indexes;
    },
    async addIndex(table, fields, options) {
      calls.push(['addIndex', table, fields, options.name]);
    },
    async removeIndex(table, name) {
      calls.push(['removeIndex', table, name]);
    }
  };
}

test('rollback creates a stable foreign-key index before removing the pagination index', async () => {
  const database = queryInterface([index(migration.INDEX_NAME, ['UserId', 'createdAt', 'id'])]);

  await migration.down(database);

  assert.deepEqual(database.calls, [
    ['showIndex', 'GenerationHistories'],
    ['addIndex', 'GenerationHistories', ['UserId'], migration.ROLLBACK_USER_INDEX_NAME],
    ['removeIndex', 'GenerationHistories', migration.INDEX_NAME]
  ]);
});

test('rollback reuses an existing foreign-key-compatible index', async () => {
  const database = queryInterface([
    index(migration.INDEX_NAME, ['UserId', 'createdAt', 'id']),
    index('existing_user_index', ['UserId'])
  ]);

  await migration.down(database);

  assert.deepEqual(database.calls, [
    ['showIndex', 'GenerationHistories'],
    ['removeIndex', 'GenerationHistories', migration.INDEX_NAME]
  ]);
});

test('reapplying the migration removes only its rollback support index', async () => {
  const database = queryInterface([
    index(migration.INDEX_NAME, ['UserId', 'createdAt', 'id']),
    index(migration.ROLLBACK_USER_INDEX_NAME, ['UserId'])
  ]);

  await migration.up(database);

  assert.deepEqual(database.calls, [
    ['addIndex', 'GenerationHistories', ['UserId', 'createdAt', 'id'], migration.INDEX_NAME],
    ['showIndex', 'GenerationHistories'],
    ['removeIndex', 'GenerationHistories', migration.ROLLBACK_USER_INDEX_NAME]
  ]);
});
