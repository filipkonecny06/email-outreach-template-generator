const test = require('node:test');
const assert = require('node:assert/strict');

const { HistoryRepository } = require('../src/repositories/historyRepository');

test('history repository applies stable ordering and ownership to persistence calls', async () => {
  const calls = [];
  const Template = { name: 'Template' };
  const GenerationHistory = {
    count: async (options) => {
      calls.push(['count', options]);
      return 2;
    },
    findAll: async (options) => {
      calls.push(['findAll', options]);
      return [{ id: 2 }];
    },
    create: async (record) => {
      calls.push(['create', record]);
      return { id: 3 };
    },
    findOne: async (options) => {
      calls.push(['findOne', options]);
      return { id: 2 };
    }
  };
  const repository = new HistoryRepository({ GenerationHistory, Template });
  const where = { UserId: 42 };

  assert.equal(await repository.count(where), 2);
  assert.deepEqual(await repository.findPage({ where, order: 'DESC', limit: 25, offset: 0 }), [
    { id: 2 }
  ]);
  assert.deepEqual(calls[1][1].include, [
    { model: Template, attributes: ['id', 'name', 'category'] }
  ]);
  assert.deepEqual(calls[1][1].order, [
    ['createdAt', 'DESC'],
    ['id', 'DESC']
  ]);
  assert.deepEqual(await repository.create({ UserId: 42 }), { id: 3 });
  assert.deepEqual(await repository.findOwnedById(2, 42), { id: 2 });
  assert.deepEqual(calls[3][1], { where: { id: 2, UserId: 42 } });
});
