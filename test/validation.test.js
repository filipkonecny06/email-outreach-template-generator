const test = require('node:test');
const assert = require('node:assert/strict');
const { validationResult } = require('express-validator');

const {
  hasBcryptSafeByteLength,
  loginValidation,
  registerValidation
} = require('../src/middleware/validation');

async function errorsFor(rules, body) {
  const req = { body };
  await Promise.all(rules.map((rule) => rule.run(req)));
  return validationResult(req).array();
}

test('bcrypt password limit is measured in UTF-8 bytes', () => {
  assert.equal(hasBcryptSafeByteLength('a'.repeat(72)), true);
  assert.equal(hasBcryptSafeByteLength('a'.repeat(73)), false);
  assert.equal(hasBcryptSafeByteLength('😀'.repeat(18)), true);
  assert.equal(hasBcryptSafeByteLength('😀'.repeat(19)), false);
});

test('registration and login reject passwords bcrypt would silently truncate', async () => {
  const body = { email: 'person@example.com', password: '😀'.repeat(19) };
  const registrationErrors = await errorsFor(registerValidation, body);
  const loginErrors = await errorsFor(loginValidation, body);

  assert.ok(registrationErrors.some((error) => /72 UTF-8 bytes/.test(error.msg)));
  assert.ok(loginErrors.some((error) => /72 UTF-8 bytes/.test(error.msg)));
});

test('registration accepts a valid password at the bcrypt byte boundary', async () => {
  const errors = await errorsFor(registerValidation, {
    email: 'person@example.com',
    password: 'a'.repeat(72)
  });

  assert.deepEqual(errors, []);
});
