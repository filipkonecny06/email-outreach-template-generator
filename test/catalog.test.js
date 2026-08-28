const test = require('node:test');
const assert = require('node:assert/strict');

const { loadConfig, parseTrustProxy } = require('../src/config/environment');
const { TemplateCatalogRepository } = require('../src/repositories/templateCatalogRepository');
const { TemplateCatalogService } = require('../src/services/templateCatalogService');
const { OutreachTemplateRenderer } = require('../src/services/templateRenderer');

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
  assert.ok(catalog.templates.length >= 16);
  assert.equal(
    new Set(catalog.templates.map((template) => template.key)).size,
    catalog.templates.length
  );
  assert.ok(new Set(catalog.templates.map((template) => template.category)).size >= 6);
});

test('tone and length selections produce meaningful deterministic copy changes', () => {
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
  const unchangedRecord = { ...desired[0] };
  const changedRecord = {
    ...desired[1],
    name: 'Stale name',
    update: async (record) => updated.push(record),
    toJSON() {
      return { ...this };
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
    findAll: async () => [matchingRecord, changedRecord],
    create: async () => {}
  };
  const summary = await service.sync({ Template, dryRun: false });

  assert.equal(summary.unchanged, 1);
  assert.equal(summary.update, 1);
  assert.ok(summary.create > 0);
  assert.equal(updated[0].name, desired[1].name);
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
    TRUST_PROXY: '2'
  };
  const config = loadConfig({ env: base });

  assert.equal(config.port, 4100);
  assert.equal(config.database.port, 3307);
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
