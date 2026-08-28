const test = require('node:test');
const assert = require('node:assert/strict');

const {
  loadConfig,
  loadValidatedDatabaseConfig,
  parseTrustProxy
} = require('../src/config/environment');
const {
  createMySqlConnectionOptions,
  createSequelizeCliOptions,
  createSequelizeOptions
} = require('../src/config/databaseConnection');
const { TemplateCatalogRepository } = require('../src/repositories/templateCatalogRepository');
const { TemplateCatalogService } = require('../src/services/templateCatalogService');
const { OutreachTemplateRenderer } = require('../src/services/outreachTemplateRenderer');

const campaign = {
  firstName: 'Ada',
  siteName: 'Example Journal',
  articleUrl: 'https://example.com/topic',
  yourUrl: 'https://example.org/research',
  brokenUrl: 'https://example.net/old-source',
  topic: 'technical SEO',
  offerAngle: 'a reproducible research workflow',
  specificCompliment: 'the clear explanation of trade-offs',
  senderName: 'Filip'
};

test('version-controlled catalog is schema-valid and contains distinct campaign patterns', () => {
  const service = new TemplateCatalogService({ repository: new TemplateCatalogRepository() });
  const catalog = service.loadAndValidate();

  assert.equal(catalog.version, 1);
  assert.equal(catalog.templates.length, 24);
  assert.equal(
    new Set(catalog.templates.map((template) => template.key)).size,
    catalog.templates.length
  );
  assert.ok(new Set(catalog.templates.map((template) => template.category)).size >= 6);
});

test('tone and length selections produce meaningful copy changes', () => {
  const service = new TemplateCatalogService({ repository: new TemplateCatalogRepository() });
  const template = service.loadAndValidate().templates[0];
  const renderer = new OutreachTemplateRenderer();

  const shortDirect = renderer.renderCampaign(template, {
    ...campaign,
    tone: 'direct',
    length: 'short'
  });
  const longFormal = renderer.renderCampaign(
    template,
    { ...campaign, tone: 'formal', length: 'long' },
    { includeFollowUps: true }
  );

  assert.match(shortDirect.body, /^Hi Ada,/);
  assert.match(longFormal.body, /^Hello Ada,/);
  assert.ok(longFormal.body.length > shortDirect.body.length);
  assert.match(longFormal.body, /Kind regards,/);
  assert.equal(longFormal.followUps.length, 2);
  assert.equal(longFormal.body.includes('&amp;'), false);
});

test('catalog records retain a stable key and editable content configuration', () => {
  const service = new TemplateCatalogService({ repository: new TemplateCatalogRepository() });
  const template = service.loadAndValidate().templates[0];
  const record = service.toDatabaseRecord(template);

  assert.equal(record.catalogKey, template.key);
  assert.deepEqual(record.contentConfig, template.content);
  assert.ok(record.bodyTemplate.includes('genuinely useful'));
});

test('catalog validation rejects declared fields that no template text uses', () => {
  const repository = new TemplateCatalogRepository();
  const schema = repository.readSchema();
  const catalog = structuredClone(repository.readCatalog());
  catalog.templates[0].requiredFields.push('brokenUrl');
  const service = new TemplateCatalogService({
    repository: {
      readSchema: () => schema,
      readCatalog: () => catalog
    }
  });

  assert.throws(() => service.loadAndValidate(), /declares unused required fields: brokenUrl/);
});

test('catalog management supports filtered listing and a safe dry-run sync', async () => {
  const service = new TemplateCatalogService({ repository: new TemplateCatalogRepository() });
  const guestPostTemplates = service.list({ category: 'Guest Post' });
  const Template = {
    findAll: async () => [],
    create: async () => {
      throw new Error('dry runs must not create records');
    }
  };

  assert.ok(guestPostTemplates.length >= 3);
  const summary = await service.sync({ Template, dryRun: true });
  assert.equal(summary.create, service.loadAndValidate().templates.length);
  assert.equal(summary.update, 0);
  assert.equal(summary.dryRun, true);
});

test('catalog sync updates changed records and leaves matching records alone', async () => {
  const service = new TemplateCatalogService({ repository: new TemplateCatalogRepository() });
  const desired = service
    .loadAndValidate()
    .templates.map((template) => service.toDatabaseRecord(template));
  const updated = [];
  const transaction = { id: 'catalog-transaction' };
  const unchangedRecord = {
    ...desired[0],
    contentConfig: Object.fromEntries(Object.entries(desired[0].contentConfig).reverse())
  };
  const changedRecord = {
    ...desired[1],
    name: 'Stale name',
    update: async (record, options) => updated.push({ record, options }),
    toJSON() {
      return { ...this };
    }
  };
  const staleRecord = {
    catalogKey: 'retired-catalog-entry',
    async destroy(options) {
      assert.equal(options.transaction, transaction);
    }
  };
  const matchingRecord = {
    ...unchangedRecord,
    update: async () => {
      throw new Error('matching records must not be updated');
    },
    toJSON() {
      return { ...this };
    }
  };

  const Template = {
    sequelize: {
      async transaction(operation) {
        return operation(transaction);
      }
    },
    findAll: async (options) => {
      assert.equal(options.transaction, transaction);
      return [matchingRecord, changedRecord, staleRecord];
    },
    create: async (_record, options) => assert.equal(options.transaction, transaction)
  };
  const summary = await service.sync({ Template, dryRun: false });

  assert.equal(summary.unchanged, 1);
  assert.equal(summary.update, 1);
  assert.equal(summary.stale, 1);
  assert.equal(summary.deleted, 1);
  assert.deepEqual(summary.staleKeys, ['retired-catalog-entry']);
  assert.ok(summary.create > 0);
  assert.equal(updated[0].record.name, desired[1].name);
  assert.equal(updated[0].options.transaction, transaction);
});

test('catalog dry-run reports stale catalog rows without modifying database state', async () => {
  const service = new TemplateCatalogService({ repository: new TemplateCatalogRepository() });
  const catalogRecord = {
    catalogKey: 'retired-catalog-entry',
    toJSON: () => ({ catalogKey: 'retired-catalog-entry' }),
    update: async () => assert.fail('dry-run must not update records'),
    destroy: async () => assert.fail('dry-run must not delete records')
  };
  const Template = {
    findAll: async (options) => {
      const operators = Object.getOwnPropertySymbols(options.where.catalogKey);
      assert.equal(operators.length, 1);
      assert.equal(options.where.catalogKey[operators[0]], null);
      return [catalogRecord];
    },
    create: async () => assert.fail('dry-run must not create records')
  };

  const summary = await service.sync({ Template, dryRun: true });

  assert.equal(summary.stale, 1);
  assert.equal(summary.deleted, 0);
  assert.deepEqual(summary.staleKeys, ['retired-catalog-entry']);
  assert.equal(summary.create, service.loadAndValidate().templates.length);
});

test('environment validation rejects placeholders and accepts a production-safe session secret', () => {
  const base = {
    NODE_ENV: 'test',
    DB_HOST: 'localhost',
    DB_NAME: 'outreach_test',
    DB_USER: 'outreach',
    SESSION_SECRET: 'a'.repeat(48)
  };

  assert.equal(loadConfig({ env: base }).session.secret.length, 48);
  assert.throws(
    () =>
      loadConfig({
        env: { ...base, SESSION_SECRET: 'replace-this-with-a-random-secret-value-long-enough' }
      }),
    /must be replaced/
  );
});

test('environment parsing validates numeric settings and explicit proxy modes', () => {
  const base = {
    NODE_ENV: 'production',
    DB_HOST: 'db',
    DB_NAME: 'outreach',
    DB_USER: 'outreach',
    SESSION_SECRET: 'b'.repeat(48),
    PORT: '4100',
    DB_PORT: '3307',
    SESSION_MAX_AGE_MS: '120000',
    RATE_LIMIT_WINDOW_MS: '30000',
    RATE_LIMIT_MAX: '25',
    AUTH_RATE_LIMIT_WINDOW_MS: '60000',
    AUTH_RATE_LIMIT_MAX: '6',
    TRUST_PROXY: '2'
  };
  const config = loadConfig({ env: base });

  assert.equal(config.port, 4100);
  assert.equal(config.database.port, 3307);
  assert.equal(config.rateLimit.authWindowMs, 60000);
  assert.equal(config.rateLimit.authMax, 6);
  assert.equal(config.trustProxy, 2);
  assert.equal(parseTrustProxy('false'), false);
  assert.equal(parseTrustProxy('true'), 1);
  assert.equal(parseTrustProxy('loopback'), 'loopback');
  assert.throws(
    () => loadConfig({ env: { ...base, PORT: 'not-a-port' } }),
    /PORT must be an integer/
  );
  assert.throws(() => loadConfig({ env: { ...base, NODE_ENV: 'preview' } }), /NODE_ENV must be/);
});

test('database TLS settings are parsed once and shared by both MySQL clients', () => {
  const env = {
    NODE_ENV: 'production',
    DB_HOST: 'managed-db.example.com',
    DB_NAME: 'outreach',
    DB_USER: 'outreach',
    DB_PASSWORD: 'secret',
    DB_SSL: 'true',
    DB_SSL_REJECT_UNAUTHORIZED: 'true',
    DB_SSL_CA: 'line one\\nline two',
    SESSION_SECRET: 'c'.repeat(48)
  };
  const database = loadConfig({ env }).database;
  const expectedSsl = { rejectUnauthorized: true, ca: 'line one\nline two' };

  assert.deepEqual(createMySqlConnectionOptions(database).ssl, expectedSsl);
  assert.deepEqual(createSequelizeOptions(database).dialectOptions.ssl, expectedSsl);
  assert.deepEqual(createSequelizeCliOptions(database).dialectOptions.ssl, expectedSsl);
  assert.throws(
    () => loadValidatedDatabaseConfig({ env: { ...env, DB_SSL: 'treu' } }),
    (error) => error.code === 'INVALID_CONFIGURATION' && /DB_SSL must be true or false/.test(error)
  );
  assert.throws(
    () =>
      loadValidatedDatabaseConfig({
        env: { ...env, DB_SSL_REJECT_UNAUTHORIZED: 'sometimes' }
      }),
    (error) =>
      error.code === 'INVALID_CONFIGURATION' &&
      /DB_SSL_REJECT_UNAUTHORIZED must be true or false/.test(error)
  );
});
