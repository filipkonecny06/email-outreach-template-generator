const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');

const { TemplateRepository } = require('../src/repositories/templateRepository');

test('template repository owns search, category, and favorite query construction', async () => {
  let query;
  const Template = {
    findByPk: async (id) => ({ id }),
    async findAll(options) {
      query = options;
      return [];
    }
  };
  const Favorite = {
    findAll: async () => [{ TemplateId: 3 }, { TemplateId: 7 }]
  };
  const repository = new TemplateRepository({ Template, Favorite });

  assert.deepEqual(await repository.findById(7), { id: 7 });
  await repository.list({
    category: 'PR Mention',
    search: 'research',
    userId: 42,
    onlyFavorites: true
  });

  assert.equal(query.where.category, 'PR Mention');
  assert.equal(query.where.name[Op.like], '%research%');
  assert.equal(query.include[0].model, Favorite);
  assert.equal(query.include[0].required, true);
  assert.deepEqual(query.include[0].where, { UserId: 42 });
  assert.deepEqual(await repository.listFavoriteIds(42), [3, 7]);
});

test('anonymous template listing does not join favorite records', async () => {
  let query;
  const Template = {
    async findAll(options) {
      query = options;
      return [];
    }
  };
  const repository = new TemplateRepository({ Template, Favorite: {} });

  await repository.list();

  assert.deepEqual(query.where, {});
  assert.deepEqual(query.include, []);
});

test('favorite toggles remain atomic and return the resulting state', async () => {
  const calls = [];
  const existing = { destroy: async () => calls.push('destroy') };
  const Favorite = {
    async findOrCreate(options) {
      calls.push(options);
      return calls.length === 1 ? [{}, true] : [existing, false];
    }
  };
  const repository = new TemplateRepository({ Template: {}, Favorite });

  assert.equal(await repository.toggleFavorite(42, 7), true);
  assert.equal(await repository.toggleFavorite(42, 7), false);
  assert.deepEqual(calls[0], {
    where: { UserId: 42, TemplateId: 7 },
    defaults: { UserId: 42, TemplateId: 7 }
  });
  assert.equal(calls[2], 'destroy');
});
