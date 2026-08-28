const test = require('node:test');
const assert = require('node:assert/strict');

const { TemplateCatalogRepository } = require('../src/repositories/templateCatalogRepository');
const { TemplateCatalogService } = require('../src/services/templateCatalogService');
const { TemplateGenerationService } = require('../src/services/templateService');

function makeRepository(template) {
  return {
    findById: async (id) => (id === 7 ? template : null),
    list: async () => [
      {
        toJSON: () => ({ id: 7, name: template.name, Favorites: [{ TemplateId: 7 }] }),
        Favorites: [{ TemplateId: 7 }]
      }
    ]
  };
}

function validPayload() {
  return {
    firstName: 'Ada',
    siteName: 'Example Journal',
    articleUrl: 'https://example.com/article',
    yourUrl: 'https://example.org/resource',
    topic: 'technical SEO',
    offerAngle: 'a reproducible research workflow',
    specificCompliment: 'the clear explanation of trade-offs',
    senderName: 'Filip',
    tone: 'friendly',
    length: 'medium'
  };
}

test('generation service validates the selected template fields and derives output server-side', async () => {
  const template = new TemplateCatalogService({
    repository: new TemplateCatalogRepository()
  }).loadAndValidate().templates[0];
  const service = new TemplateGenerationService({ templateRepository: makeRepository(template) });

  await assert.rejects(
    service.renderFromTemplate(7, { tone: 'friendly', length: 'medium' }),
    (error) => error.code === 'VALIDATION_ERROR' && error.details.fields.length > 0
  );

  const result = await service.renderFromTemplate(7, validPayload(), true);
  assert.match(result.subject, /technical SEO/);
  assert.match(result.body, /reproducible research workflow/);
  assert.equal(result.followUps.length, 2);
});

test('generation service returns a not-found error and exposes favorite state for the current user', async () => {
  const template = new TemplateCatalogService({
    repository: new TemplateCatalogRepository()
  }).loadAndValidate().templates[0];
  const service = new TemplateGenerationService({ templateRepository: makeRepository(template) });

  await assert.rejects(
    service.renderFromTemplate(99, validPayload()),
    (error) => error.code === 'NOT_FOUND'
  );
  const templates = await service.getTemplates({ userId: 42 });
  assert.equal(templates[0].isFavorite, true);
});
