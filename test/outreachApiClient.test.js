const test = require('node:test');
const assert = require('node:assert/strict');

const { OutreachApiClient } = require('../src/public/js/outreach-api-client');

test('API client builds query, JSON, CSRF, and abort-aware requests', async () => {
  const requests = [];
  const client = new OutreachApiClient({
    csrfToken: 'csrf-token',
    fetchImpl: async (path, options) => {
      requests.push({ path, options });
      return { ok: true, json: async () => ({ path }) };
    }
  });
  const signal = new AbortController().signal;

  await client.listTemplates(
    { search: 'link audit', category: 'PR Mention', favorites: true },
    { signal }
  );
  await client.preview({ templateId: '7' }, { signal });
  await client.toggleFavorite('7');
  await client.saveHistory({ templateId: '7' });

  assert.equal(
    requests[0].path,
    '/api/templates?search=link+audit&category=PR+Mention&favorites=true'
  );
  assert.deepEqual(requests[0].options, { method: 'GET', headers: {}, signal });
  assert.deepEqual(requests[1], {
    path: '/api/preview',
    options: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'csrf-token' },
      body: '{"templateId":"7"}',
      signal
    }
  });
  assert.equal(requests[2].path, '/api/favorite/7');
  assert.deepEqual(requests[2].options.headers, { 'X-CSRF-Token': 'csrf-token' });
  assert.equal(requests[3].path, '/api/history');
  assert.equal(requests[3].options.body, '{"templateId":"7"}');
});

test('API client extracts field and envelope errors without leaking response parsing failures', async () => {
  const responses = [
    {
      ok: false,
      json: async () => ({ error: { details: { fields: [{ message: 'Topic is required.' }] } } })
    },
    {
      ok: false,
      json: async () => ({ error: { details: [{ msg: 'URL is invalid.' }] } })
    },
    { ok: false, json: async () => ({ error: { message: 'Unavailable.' } }) },
    { ok: false, json: async () => ({ message: 'Try later.' }) },
    {
      ok: false,
      json: async () => {
        throw new SyntaxError('invalid JSON');
      }
    }
  ];
  const client = new OutreachApiClient({ fetchImpl: async () => responses.shift() });

  await assert.rejects(client.preview({}), { message: 'Topic is required.' });
  await assert.rejects(client.preview({}), { message: 'URL is invalid.' });
  await assert.rejects(client.preview({}), { message: 'Unavailable.' });
  await assert.rejects(client.preview({}), { message: 'Try later.' });
  await assert.rejects(client.preview({}), { message: 'Failed to generate preview.' });
});

test('API client ignores empty field errors and supports false favorite filters', async () => {
  let requestedPath;
  const client = new OutreachApiClient({
    fetchImpl: async (path) => {
      requestedPath = path;
      return {
        ok: false,
        json: async () => ({ error: { details: [null, { message: '' }] } })
      };
    }
  });

  await assert.rejects(client.listTemplates({ search: '', category: '', favorites: false }), {
    message: 'Failed to refresh templates.'
  });
  assert.equal(requestedPath, '/api/templates?search=&category=&favorites=false');
});
