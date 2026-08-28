const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DB_HOST = '127.0.0.1';
process.env.DB_NAME = 'outreach_test';
process.env.DB_USER = 'outreach';

const request = require('supertest');
const session = require('express-session');
const { createApp, createSessionStore } = require('../src/app');
const bcrypt = require('bcrypt');
const { User, Template, Favorite, GenerationHistory } = require('../src/models');
const templateGenerationService = require('../src/services/templateGenerationService');

const silentLogger = { info() {}, warn() {}, error() {} };

function testConfig() {
  return {
    nodeEnv: 'test',
    isProduction: false,
    bodyLimit: '20kb',
    trustProxy: false,
    session: { name: 'test.sid', secret: 'a'.repeat(48), maxAgeMs: 60000 },
    rateLimit: { windowMs: 60000, max: 100, authWindowMs: 60000, authMax: 5 },
    database: {
      host: '127.0.0.1',
      port: 3306,
      user: 'outreach',
      password: '',
      name: 'outreach_test',
      ssl: { enabled: false, rejectUnauthorized: true }
    }
  };
}

function extractCsrfToken(response) {
  const token = response.text.match(/name="csrf-token" content="([^"]+)"/)?.[1];
  assert.ok(token, 'rendered page must contain a synchronizer token');
  return token;
}

test('liveness endpoint is independent of the session store and sends no session cookie', async () => {
  class UnavailableStore extends session.Store {
    get() {
      throw new Error('the health check must not read sessions');
    }

    set() {
      throw new Error('the health check must not write sessions');
    }

    touch() {
      throw new Error('the health check must not touch sessions');
    }
  }

  const app = createApp({
    config: testConfig(),
    sessionStore: new UnavailableStore(),
    appLogger: silentLogger
  });
  const response = await request(app).get('/healthz');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true, status: 'live' });
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.ok(response.headers['content-security-policy']);
  assert.ok(response.headers['x-request-id']);
  assert.equal(response.headers['set-cookie'], undefined);
});

test('expected client errors use the API envelope without logging a stack trace', async () => {
  const warnings = [];
  const appLogger = {
    ...silentLogger,
    warn(message, metadata) {
      warnings.push({ message, metadata });
    }
  };
  const app = createApp({
    config: testConfig(),
    sessionStore: new session.MemoryStore(),
    appLogger
  });
  const response = await request(app).post('/api/preview').send({});

  assert.equal(response.status, 403);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.body.error.code, 'EBADCSRFTOKEN');
  assert.equal(typeof response.body.error.requestId, 'string');
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].metadata.status, 403);
  assert.equal('stack' in warnings[0].metadata, false);
});

test('browser API mutations require the canonical X-CSRF-Token session contract', async () => {
  const originals = [];
  const replace = (target, property, value) => {
    originals.push([target, property, target[property]]);
    target[property] = value;
  };

  replace(bcrypt, 'hash', async () => 'test-password-hash');
  replace(User, 'findOne', async () => null);
  replace(User, 'create', async ({ email }) => ({ id: 42, email }));
  replace(Template, 'findByPk', async (id) => ({ id }));
  replace(Template, 'findAll', async () => []);
  replace(Favorite, 'findOrCreate', async () => [{ destroy: async () => {} }, true]);
  replace(Favorite, 'findAll', async () => []);
  replace(GenerationHistory, 'create', async () => ({ id: 99 }));
  replace(templateGenerationService, 'renderFromTemplate', async (templateId) => ({
    template: { id: templateId },
    subject: 'Rendered subject',
    body: 'Rendered body',
    followUps: []
  }));

  try {
    const app = createApp({
      config: testConfig(),
      sessionStore: new session.MemoryStore(),
      appLogger: silentLogger
    });
    const agent = request.agent(app);
    const registrationPage = await agent.get('/auth/register');
    assert.equal(registrationPage.headers['cache-control'], 'no-store');
    const registrationToken = extractCsrfToken(registrationPage);
    const registration = await agent.post('/auth/register').type('form').send({
      _csrf: registrationToken,
      email: 'csrf-test@example.com',
      password: 'valid-password-value'
    });
    assert.equal(registration.status, 302);
    assert.equal(registration.headers.location, '/generator');
    assert.equal(registration.headers['cache-control'], 'no-store');

    const authenticatedPage = await agent.get('/generator');
    assert.equal(authenticatedPage.status, 200);
    assert.equal(authenticatedPage.headers['cache-control'], 'no-store');
    const token = extractCsrfToken(authenticatedPage);
    const outreachPayload = {
      templateId: 7,
      tone: 'direct',
      length: 'short',
      includeFollowUps: false
    };
    const mutations = [
      { path: '/api/preview', payload: outreachPayload, status: 200 },
      { path: '/api/favorite/7', payload: {}, status: 200 },
      { path: '/api/history', payload: outreachPayload, status: 201 }
    ];

    for (const mutation of mutations) {
      const accepted = await agent
        .post(mutation.path)
        .set('X-CSRF-Token', token)
        .send(mutation.payload);
      assert.equal(
        accepted.status,
        mutation.status,
        `${mutation.path} must accept the browser header`
      );
      assert.equal(accepted.headers['cache-control'], 'no-store');

      const missing = await agent.post(mutation.path).send(mutation.payload);
      assert.equal(missing.status, 403, `${mutation.path} must reject a missing token`);
      assert.equal(missing.body.error.code, 'EBADCSRFTOKEN');

      const incorrect = await agent
        .post(mutation.path)
        .set('X-CSRF-Token', 'incorrect-token')
        .send(mutation.payload);
      assert.equal(incorrect.status, 403, `${mutation.path} must reject an incorrect token`);
      assert.equal(incorrect.body.error.code, 'EBADCSRFTOKEN');
    }

    const legacyHeader = await agent
      .post('/api/preview')
      .set('CSRF-Token', token)
      .send(outreachPayload);
    assert.equal(legacyHeader.status, 403);
    assert.equal(legacyHeader.body.error.code, 'EBADCSRFTOKEN');
  } finally {
    for (const [target, property, original] of originals.reverse()) {
      target[property] = original;
    }
  }
});

test('bare API paths use the JSON not-found envelope', async () => {
  const app = createApp({
    config: testConfig(),
    sessionStore: new session.MemoryStore(),
    appLogger: silentLogger
  });
  const response = await request(app).get('/api');

  assert.equal(response.status, 404);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.body.error.code, 'NOT_FOUND');
  assert.equal(typeof response.body.error.requestId, 'string');
});

test('pre-session global rate-limit errors render the HTML error page safely', async () => {
  const config = testConfig();
  config.rateLimit.max = 1;
  const app = createApp({
    config,
    sessionStore: new session.MemoryStore(),
    appLogger: silentLogger
  });

  await request(app).get('/');
  const response = await request(app).get('/');

  assert.equal(response.status, 429);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.match(response.headers['content-type'], /text\/html/);
  assert.match(response.text, /Too many requests/);
  assert.doesNotMatch(response.text, /ReferenceError/);
});

test('HTML CSRF and body-parser errors render before authenticated locals exist', async () => {
  const csrfApp = createApp({
    config: testConfig(),
    sessionStore: new session.MemoryStore(),
    appLogger: silentLogger
  });
  const csrfResponse = await request(csrfApp)
    .post('/auth/login')
    .type('form')
    .send({ email: 'person@example.com', password: 'valid-password-value' });

  assert.equal(csrfResponse.status, 403);
  assert.equal(csrfResponse.headers['cache-control'], 'no-store');
  assert.match(csrfResponse.headers['content-type'], /text\/html/);
  assert.match(csrfResponse.text, /<h1>403<\/h1>/);
  assert.doesNotMatch(csrfResponse.text, /ReferenceError/);

  const bodyConfig = testConfig();
  bodyConfig.bodyLimit = '20b';
  const bodyApp = createApp({
    config: bodyConfig,
    sessionStore: new session.MemoryStore(),
    appLogger: silentLogger
  });
  const bodyResponse = await request(bodyApp)
    .post('/auth/login')
    .set('content-type', 'application/json')
    .send({ value: 'x'.repeat(100) });

  assert.equal(bodyResponse.status, 413);
  assert.equal(bodyResponse.headers['cache-control'], 'no-store');
  assert.match(bodyResponse.headers['content-type'], /text\/html/);
  assert.match(bodyResponse.text, /<h1>413<\/h1>/);
  assert.doesNotMatch(bodyResponse.text, /ReferenceError/);
});

test('landing markup contains no inline script blocked by the application CSP', async () => {
  const app = createApp({
    config: testConfig(),
    sessionStore: new session.MemoryStore(),
    appLogger: silentLogger
  });
  const response = await request(app).get('/');

  assert.equal(response.status, 200);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.doesNotMatch(response.text, /application\/ld\+json/i);
  assert.doesNotMatch(response.text, /<script(?![^>]+\bsrc=)[^>]*>/i);
});

test('login page visibly documents the public portfolio credentials', async () => {
  const app = createApp({
    config: testConfig(),
    sessionStore: new session.MemoryStore(),
    appLogger: silentLogger
  });
  const response = await request(app).get('/auth/login');

  assert.equal(response.status, 200);
  assert.match(response.text, /Portfolio demo account/);
  assert.match(response.text, /demo@example\.com/);
  assert.match(response.text, /OutreachOps-Portfolio-2026!/);
  assert.match(response.text, /ordinary, shared account/);
});

test('static assets revalidate and bypass quotas while credential submissions use a stricter limit', async () => {
  const config = testConfig();
  config.rateLimit.authMax = 1;
  const app = createApp({
    config,
    sessionStore: new session.MemoryStore(),
    appLogger: silentLogger
  });

  const assetResponse = await request(app).get('/css/styles.css');
  assert.equal(assetResponse.status, 200);
  assert.match(assetResponse.headers['cache-control'], /public/);
  assert.match(assetResponse.headers['cache-control'], /max-age=0/);
  assert.ok(assetResponse.headers.etag);
  assert.equal(assetResponse.headers.ratelimit, undefined);
  assert.equal(assetResponse.headers['ratelimit-policy'], undefined);

  const revalidatedAsset = await request(app)
    .get('/css/styles.css')
    .set('If-None-Match', assetResponse.headers.etag);
  assert.equal(revalidatedAsset.status, 304);
  assert.match(revalidatedAsset.headers['cache-control'], /max-age=0/);

  const agent = request.agent(app);
  const loginPage = await agent.get('/auth/login');
  const csrfToken = loginPage.text.match(/name="csrf-token" content="([^"]+)"/)?.[1];
  assert.ok(csrfToken);

  const credentials = { _csrf: csrfToken, email: 'invalid', password: 'short' };
  const firstAttempt = await agent.post('/auth/login').type('form').send(credentials);
  const secondAttempt = await agent.post('/auth/login').type('form').send(credentials);

  assert.equal(firstAttempt.status, 422);
  assert.equal(secondAttempt.status, 429);
  assert.match(secondAttempt.text, /Too many authentication attempts/);
});

test('session storage receives the same verified TLS settings as the application database', async () => {
  const config = testConfig();
  config.database.ssl = {
    enabled: true,
    rejectUnauthorized: true,
    ca: 'test certificate'
  };
  let poolOptions;

  class Store {
    constructor(options, connection) {
      this.options = options;
      this.connection = connection;
    }

    async close() {
      this.closed = true;
    }
  }

  const pool = { id: 'session-pool' };
  const store = createSessionStore(config, {
    Store,
    createPool(options) {
      poolOptions = options;
      return pool;
    }
  });

  assert.deepEqual(poolOptions.ssl, {
    rejectUnauthorized: true,
    ca: 'test certificate'
  });
  assert.equal(poolOptions.database, 'outreach_test');
  assert.equal(store.connection, pool);
  assert.equal(store.options.endConnectionOnClose, true);
  await store.close();
  assert.equal(store.closed, true);
});
