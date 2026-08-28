const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DB_HOST = '127.0.0.1';
process.env.DB_NAME = 'outreach_test';
process.env.DB_USER = 'outreach';

const request = require('supertest');
const session = require('express-session');
const { createApp } = require('../src/app');

function testConfig() {
  return {
    nodeEnv: 'test',
    isProduction: false,
    bodyLimit: '20kb',
    trustProxy: false,
    session: { name: 'test.sid', secret: 'a'.repeat(48), maxAgeMs: 60000 },
    rateLimit: { windowMs: 60000, max: 100 },
    database: {
      host: '127.0.0.1',
      port: 3306,
      user: 'outreach',
      password: '',
      name: 'outreach_test'
    }
  };
}

test('liveness endpoint is public and application security headers are enabled', async () => {
  const app = createApp({ config: testConfig(), sessionStore: new session.MemoryStore() });
  const response = await request(app).get('/healthz');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true, status: 'live' });
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.ok(response.headers['content-security-policy']);
  assert.ok(response.headers['x-request-id']);
});

test('unsafe requests require a session-bound CSRF token before API authentication is evaluated', async () => {
  const app = createApp({ config: testConfig(), sessionStore: new session.MemoryStore() });
  const response = await request(app).post('/api/preview').send({});

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'EBADCSRFTOKEN');
});
