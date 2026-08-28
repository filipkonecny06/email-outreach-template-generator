const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OutreachTemplateRenderer,
  extractTokens,
  renderTemplate
} = require('../src/services/templateRenderer');

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
