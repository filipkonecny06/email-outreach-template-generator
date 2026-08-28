const test = require('node:test');
const assert = require('node:assert/strict');

const { TemplateCatalogRepository } = require('../src/repositories/templateCatalogRepository');
const { TemplateCatalogService } = require('../src/services/templateCatalogService');
const { TemplateFieldService } = require('../src/services/templateFieldService');

test('catalog field metadata identifies exactly the six follow-up-only requirements', () => {
  const templates = new TemplateCatalogService({
    repository: new TemplateCatalogRepository()
  }).loadAndValidate().templates;
  const fieldService = new TemplateFieldService();
  const followUpOnly = Object.fromEntries(
    templates
      .map((template) => [
        template.key,
        fieldService.requirementsFor(template).followUpRequiredFields
      ])
      .filter(([, fields]) => fields.length > 0)
  );

  assert.deepEqual(followUpOnly, {
    'guest-post-counterpoint': ['siteName'],
    'broken-link-resource-replacement': ['siteName'],
    'reclamation-original-image': ['siteName'],
    'reclamation-expert-quote': ['siteName'],
    'partnership-co-marketing-research': ['yourUrl'],
    'influencer-educational-live': ['siteName']
  });
});

test('field metadata supports database JSON strings and legacy follow-up columns', () => {
  const fieldService = new TemplateFieldService();
  const template = {
    requiredFields: JSON.stringify(['firstName', 'topic', 'siteName']),
    subjectTemplate: '{topic}',
    bodyTemplate: 'Hi {firstName}',
    followUp1BodyTemplate: 'For {siteName}'
  };
  const requirements = fieldService.requirementsFor(template);

  assert.deepEqual(requirements, {
    requiredFields: ['firstName', 'topic'],
    followUpRequiredFields: ['siteName']
  });
  assert.deepEqual(fieldService.decorate(fieldService.decorate(template)), {
    ...template,
    ...requirements
  });
});
