const test = require('node:test');
const assert = require('node:assert/strict');
const { validationResult } = require('express-validator');

const {
  CATALOG_FIELD_NAMES,
  LENGTH_BLOCKS,
  LENGTH_OPTIONS,
  OUTREACH_FIELDS,
  TONE_OPTIONS,
  TONE_PROFILES
} = require('../src/contracts/outreach');
const { outreachFieldRules } = require('../src/middleware/validation');
const { TemplateCatalogRepository } = require('../src/repositories/templateCatalogRepository');
const { TemplateCatalogService } = require('../src/services/templateCatalogService');

test('generator contract is the authoritative field and option registry', async () => {
  assert.equal(new Set(OUTREACH_FIELDS.map((field) => field.name)).size, OUTREACH_FIELDS.length);
  assert.deepEqual(
    CATALOG_FIELD_NAMES,
    OUTREACH_FIELDS.filter((field) => field.catalogSelectable).map((field) => field.name)
  );
  assert.deepEqual(
    Object.keys(TONE_PROFILES),
    TONE_OPTIONS.map((option) => option.value)
  );
  assert.deepEqual(
    Object.keys(LENGTH_BLOCKS),
    LENGTH_OPTIONS.map((option) => option.value)
  );

  const req = {
    body: {
      templateId: 1,
      tone: TONE_OPTIONS[0].value,
      length: LENGTH_OPTIONS[0].value,
      firstName: 'x'.repeat(OUTREACH_FIELDS[0].maxLength + 1)
    }
  };
  await Promise.all(outreachFieldRules.map((rule) => rule.run(req)));
  assert.ok(
    validationResult(req)
      .array()
      .some((error) => error.path === 'firstName')
  );
});

test('catalog semantics reject fields outside the shared generator contract', () => {
  const repository = new TemplateCatalogRepository();
  const catalog = structuredClone(repository.readCatalog());
  catalog.templates[0].requiredFields.push('futureField');
  const service = new TemplateCatalogService({
    repository: {
      readSchema: () => repository.readSchema(),
      readCatalog: () => catalog
    }
  });

  assert.throws(() => service.loadAndValidate(), /declares unsupported fields: futureField/);
});
