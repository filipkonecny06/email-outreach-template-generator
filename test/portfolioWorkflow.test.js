const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DB_HOST = '127.0.0.1';
process.env.DB_NAME = 'outreach_test';
process.env.DB_USER = 'outreach';

const bcrypt = require('bcrypt');
const request = require('supertest');
const session = require('express-session');
const { createApp } = require('../src/app');
const { LENGTH_OPTIONS, OUTREACH_FIELDS, TONE_OPTIONS } = require('../src/contracts/outreach');
const { Favorite, GenerationHistory, Template, User } = require('../src/models');

const silentLogger = { info() {}, warn() {}, error() {} };

function workflowConfig() {
  return {
    nodeEnv: 'test',
    isProduction: false,
    port: 3000,
    trustProxy: false,
    bodyLimit: '100kb',
    session: { name: 'workflow.sid', secret: 'x'.repeat(48), maxAgeMs: 60000 },
    rateLimit: { windowMs: 60000, max: 1000, authWindowMs: 60000, authMax: 100 },
    database: {
      host: '127.0.0.1',
      port: 3306,
      name: 'outreach_test',
      user: 'outreach',
      password: '',
      ssl: { enabled: false, rejectUnauthorized: true }
    }
  };
}

function csrfToken(response) {
  return response.text.match(/name="csrf-token" content="([^"]+)"/)?.[1];
}

test('portfolio browser journey crosses rendered pages, API generation, favorites, and history', async () => {
  const template = {
    id: 7,
    name: 'Research introduction',
    category: 'PR Mention',
    requiredFields: ['firstName', 'topic'],
    subjectTemplate: '{topic} for {firstName}',
    bodyTemplate: 'Hi {firstName},\n\nA concise note about {topic}.',
    followUp1SubjectTemplate: null,
    followUp1BodyTemplate: null,
    followUp2SubjectTemplate: null,
    followUp2BodyTemplate: null
  };
  const savedEntries = [];
  let deleted = false;
  const originals = [];
  const replace = (target, property, value) => {
    originals.push([target, property, target[property]]);
    target[property] = value;
  };

  replace(bcrypt, 'hash', async () => 'workflow-password-hash');
  replace(User, 'findOne', async () => null);
  replace(User, 'create', async ({ email }) => ({ id: 42, email }));
  replace(Template, 'findAll', async () => [template]);
  replace(Template, 'findByPk', async (id) => (Number(id) === template.id ? template : null));
  replace(Favorite, 'findAll', async () => []);
  replace(Favorite, 'findOrCreate', async () => [{ destroy: async () => {} }, true]);
  replace(GenerationHistory, 'create', async (record) => {
    const entry = {
      ...record,
      id: savedEntries.length + 1,
      createdAt: new Date('2026-08-28T12:00:00Z'),
      Template: template,
      async destroy() {
        deleted = true;
      }
    };
    savedEntries.push(entry);
    return entry;
  });
  replace(GenerationHistory, 'count', async () => savedEntries.length);
  replace(GenerationHistory, 'findAll', async () => savedEntries);
  replace(GenerationHistory, 'findOne', async ({ where }) =>
    savedEntries.find((entry) => entry.id === where.id && entry.UserId === where.UserId)
  );

  try {
    const app = createApp({
      config: workflowConfig(),
      sessionStore: new session.MemoryStore(),
      appLogger: silentLogger
    });
    const browser = request.agent(app);

    const registrationPage = await browser.get('/auth/register');
    const registration = await browser
      .post('/auth/register')
      .type('form')
      .send({
        _csrf: csrfToken(registrationPage),
        email: 'reviewer@example.com',
        password: 'valid-password-value'
      });
    assert.equal(registration.status, 302);

    const generatorPage = await browser.get('/generator?templateId=7');
    assert.equal(generatorPage.status, 200);
    for (const field of OUTREACH_FIELDS) {
      assert.match(
        generatorPage.text,
        new RegExp(`<input[^>]*name="${field.name}"[^>]*maxlength="${field.maxLength}"[^>]*>`)
      );
    }
    for (const option of [...TONE_OPTIONS, ...LENGTH_OPTIONS]) {
      assert.match(
        generatorPage.text,
        new RegExp(`<option value="${option.value}">${option.label}<\\/option>`)
      );
    }
    const token = csrfToken(generatorPage);
    const payload = {
      templateId: 7,
      firstName: 'Ada',
      topic: 'technical SEO',
      tone: 'direct',
      length: 'short',
      includeFollowUps: false
    };

    const preview = await browser.post('/api/preview').set('X-CSRF-Token', token).send(payload);
    assert.equal(preview.status, 200);
    assert.deepEqual(preview.body, {
      subject: 'technical SEO for Ada',
      body: 'Hi Ada,\n\nA concise note about technical SEO.',
      followUps: []
    });

    const favorite = await browser.post('/api/favorite/7').set('X-CSRF-Token', token).send({});
    assert.deepEqual(favorite.body, { favorited: true });

    const save = await browser.post('/api/history').set('X-CSRF-Token', token).send(payload);
    assert.equal(save.status, 201);
    assert.equal(savedEntries[0].subject, preview.body.subject);

    const historyPage = await browser.get('/history');
    assert.equal(historyPage.status, 200);
    assert.match(historyPage.text, /technical SEO for Ada/);
    assert.match(historyPage.text, /A concise note about technical SEO\./);

    const deletion = await browser
      .post('/history/1?_method=DELETE')
      .type('form')
      .send({
        _csrf: csrfToken(historyPage)
      });
    assert.equal(deletion.status, 302);
    assert.equal(deletion.headers.location, '/history');
    assert.equal(deleted, true);

    const authenticatedPage = await browser.get('/generator');
    const logout = await browser
      .post('/auth/logout')
      .type('form')
      .send({
        _csrf: csrfToken(authenticatedPage)
      });
    assert.equal(logout.status, 302);
    assert.ok(logout.headers['set-cookie'].some((cookie) => cookie.startsWith('workflow.sid=')));
    assert.equal(
      logout.headers['set-cookie'].some((cookie) => cookie.startsWith('outreach.sid=')),
      false
    );
  } finally {
    for (const [target, property, original] of originals.reverse()) target[property] = original;
  }
});
