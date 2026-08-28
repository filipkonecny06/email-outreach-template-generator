const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OutreachTemplateRenderer,
  extractTokens,
  renderTemplate
} = require('../src/services/outreachTemplateRenderer');
const { TemplateCatalogRepository } = require('../src/repositories/templateCatalogRepository');
const { TemplateCatalogService } = require('../src/services/templateCatalogService');

test('renders plain text without leaking HTML entities into exported copy', () => {
  const result = renderTemplate('Hello {team}', { team: 'R&D <Platform>' });

  assert.equal(result, 'Hello R&D <Platform>');
  assert.equal(result.includes('&amp;'), false);
});

test('preserves unknown placeholders so incomplete campaigns remain visible', () => {
  assert.equal(
    renderTemplate('Hi {firstName}, see {missing}', { firstName: 'Ada' }),
    'Hi Ada, see {missing}'
  );
});

test('can intentionally remove unknown placeholders', () => {
  const renderer = new OutreachTemplateRenderer({ preserveUnknownTokens: false });

  assert.equal(renderer.render('{known} {unknown}', { known: 'Value' }), 'Value ');
});

test('extracts unique tokens in document order', () => {
  assert.deepEqual(extractTokens('{firstName} at {siteName}; hello {firstName}'), [
    'firstName',
    'siteName'
  ]);
});

test('user values are interpolated once and never treated as template syntax', () => {
  assert.equal(
    renderTemplate('Topic: {topic}', { topic: '{senderName}', senderName: 'Filip' }),
    'Topic: {senderName}'
  );

  const selfReferentialTopic = '{topic}{topic}'.repeat(64);
  const output = renderTemplate('Topic: {topic}', { topic: selfReferentialTopic });
  assert.equal(output, `Topic: ${selfReferentialTopic}`);
  assert.equal(output.length, 'Topic: '.length + selfReferentialTopic.length);
});

test('campaign rendering resolves trusted profile fragments without expanding user text', () => {
  const catalog = new TemplateCatalogService({
    repository: new TemplateCatalogRepository()
  }).loadAndValidate();
  const result = new OutreachTemplateRenderer().renderCampaign(
    catalog.templates[0],
    {
      firstName: 'Ada',
      siteName: 'Example Journal',
      articleUrl: 'https://example.com/article',
      yourUrl: 'https://example.org/resource',
      topic: '{senderName}',
      offerAngle: 'a measured workflow',
      specificCompliment: 'the clear methodology',
      senderName: 'Filip',
      tone: 'friendly',
      length: 'medium'
    },
    { includeFollowUps: true }
  );

  assert.match(result.subject, /Original \{senderName\} data/);
  assert.match(result.body, /article on \{senderName\}/);
  assert.match(result.followUps[0].body, /^Hi Ada,/);
  assert.match(result.followUps[0].body, /anchor the \{senderName\} article/);
  assert.match(result.followUps[0].body, /Thanks,\nFilip$/);
  assert.doesNotMatch(result.followUps[0].body, /\{(?:greeting|signoff|firstName)\}/);
});

test('every catalog follow-up resolves greeting and signoff personalization', () => {
  const catalog = new TemplateCatalogService({
    repository: new TemplateCatalogRepository()
  }).loadAndValidate();
  const renderer = new OutreachTemplateRenderer();
  const values = {
    firstName: 'Ada',
    siteName: 'Example Journal',
    articleUrl: 'https://example.com/article',
    brokenUrl: 'https://example.com/missing',
    yourUrl: 'https://example.org/resource',
    topic: 'technical SEO',
    offerAngle: 'a measured workflow',
    specificCompliment: 'the clear methodology',
    senderName: 'Filip',
    tone: 'friendly',
    length: 'medium'
  };

  for (const template of catalog.templates) {
    const result = renderer.renderCampaign(template, values, { includeFollowUps: true });
    for (const followUp of result.followUps) {
      assert.match(followUp.body, /^Hi Ada,/);
      assert.match(followUp.body, /Thanks,\nFilip$/);
      assert.doesNotMatch(followUp.body, /\{(?:firstName|senderName|greeting|signoff)\}/);
    }
  }
});
