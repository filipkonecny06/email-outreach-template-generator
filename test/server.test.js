const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DB_HOST = '127.0.0.1';
process.env.DB_NAME = 'outreach_test';
process.env.DB_USER = 'outreach';

const { verifyRuntimeDependencies } = require('../src/server');

test('startup verifies both database pools and the migrated session table', async () => {
  const calls = [];
  const database = {
    async authenticate() {
      calls.push('database');
    }
  };
  const sessionStore = {
    async onReady() {
      calls.push('session-ready');
    },
    async length() {
      calls.push('session-query');
      return 0;
    }
  };

  await verifyRuntimeDependencies({ database, sessionStore });

  assert.ok(calls.includes('database'));
  assert.ok(calls.includes('session-ready'));
  assert.equal(calls.at(-1), 'session-query');
});
