const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BCRYPT_COST,
  BCRYPT_MAX_PASSWORD_BYTES,
  createPasswordService,
  hasBcryptSafeByteLength
} = require('../src/services/passwordService');

test('password service applies one hashing policy to every caller', async () => {
  const calls = [];
  const service = createPasswordService({
    bcryptApi: {
      hash: async (...args) => {
        calls.push(['hash', ...args]);
        return 'hash';
      },
      compare: async (...args) => {
        calls.push(['compare', ...args]);
        return true;
      }
    }
  });

  assert.equal(await service.hash('password'), 'hash');
  assert.equal(await service.compare('password', 'hash'), true);
  assert.deepEqual(calls, [
    ['hash', 'password', BCRYPT_COST],
    ['compare', 'password', 'hash']
  ]);
  assert.equal(hasBcryptSafeByteLength('a'.repeat(BCRYPT_MAX_PASSWORD_BYTES)), true);
  assert.equal(hasBcryptSafeByteLength('a'.repeat(BCRYPT_MAX_PASSWORD_BYTES + 1)), false);
});
