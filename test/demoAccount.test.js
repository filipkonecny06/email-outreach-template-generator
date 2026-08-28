const test = require('node:test');
const assert = require('node:assert/strict');

const demoAccount = require('../src/config/demoAccount');
const { syncDemoAccount } = require('../scripts/demo-account');

test('demo credentials are valid public login inputs', () => {
  assert.equal(demoAccount.email, 'demo@example.com');
  assert.ok(demoAccount.password.length >= 12);
  assert.ok(Buffer.byteLength(demoAccount.password, 'utf8') <= 72);
});

test('demo account provisioning creates an ordinary user with a bcrypt cost of 12', async () => {
  const calls = [];
  const User = {
    scope(scope) {
      assert.equal(scope, 'withPassword');
      return { findOne: async () => null };
    },
    async create(values) {
      calls.push(['create', values]);
    }
  };
  const bcryptApi = {
    async hash(password, cost) {
      calls.push(['hash', password, cost]);
      return 'portfolio-password-hash';
    }
  };

  const result = await syncDemoAccount({ User, bcryptApi });

  assert.deepEqual(result, { email: demoAccount.email, status: 'created' });
  assert.deepEqual(calls, [
    ['hash', demoAccount.password, 12],
    ['create', { email: demoAccount.email, passwordHash: 'portfolio-password-hash' }]
  ]);
  assert.equal('role' in calls[1][1], false);
  assert.equal('isAdmin' in calls[1][1], false);
});

test('demo account provisioning is idempotent when the credentials already match', async () => {
  let compared;
  const existing = {
    passwordHash: 'existing-password-hash',
    update: async () => assert.fail('an unchanged account must not be updated')
  };
  const User = {
    scope: () => ({ findOne: async () => existing }),
    create: async () => assert.fail('an existing account must not be recreated')
  };
  const bcryptApi = {
    async compare(password, passwordHash) {
      compared = [password, passwordHash];
      return true;
    },
    hash: async () => assert.fail('an unchanged password must not be rehashed')
  };

  const result = await syncDemoAccount({ User, bcryptApi });

  assert.deepEqual(result, { email: demoAccount.email, status: 'unchanged' });
  assert.deepEqual(compared, [demoAccount.password, 'existing-password-hash']);
});

test('demo account provisioning repairs a drifted password without changing identity', async () => {
  let updated;
  const existing = {
    passwordHash: 'old-password-hash',
    async update(values) {
      updated = values;
    }
  };
  const User = {
    scope: () => ({ findOne: async () => existing }),
    create: async () => assert.fail('an existing account must not be recreated')
  };
  const bcryptApi = {
    compare: async () => false,
    async hash(password, cost) {
      assert.equal(password, demoAccount.password);
      assert.equal(cost, 12);
      return 'restored-password-hash';
    }
  };

  const result = await syncDemoAccount({ User, bcryptApi });

  assert.deepEqual(result, { email: demoAccount.email, status: 'updated' });
  assert.deepEqual(updated, { passwordHash: 'restored-password-hash' });
});
