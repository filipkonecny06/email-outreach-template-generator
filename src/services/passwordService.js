const bcrypt = require('bcrypt');

const BCRYPT_COST = 12;
const BCRYPT_MAX_PASSWORD_BYTES = 72;
// A real hash keeps unknown-email logins on the same expensive comparison path.
const INVALID_PASSWORD_HASH = '$2b$12$jbQxnq8l5trJLrlr4HGWbuf/tZx1nxIiVSxG6vNZj9bIm0LT/0pV6';

/** Returns whether bcrypt can consume the complete UTF-8 password without truncation. */
function hasBcryptSafeByteLength(value) {
  return Buffer.byteLength(String(value || ''), 'utf8') <= BCRYPT_MAX_PASSWORD_BYTES;
}

/**
 * Creates the password adapter shared by registration, login, and demo provisioning.
 *
 * @param {{bcryptApi?: typeof bcrypt, cost?: number}} [options]
 */
function createPasswordService({ bcryptApi = bcrypt, cost = BCRYPT_COST } = {}) {
  return Object.freeze({
    cost,
    hash: (password) => bcryptApi.hash(password, cost),
    compare: (password, passwordHash) => bcryptApi.compare(password, passwordHash)
  });
}

const passwordService = createPasswordService();

module.exports = {
  BCRYPT_COST,
  BCRYPT_MAX_PASSWORD_BYTES,
  INVALID_PASSWORD_HASH,
  createPasswordService,
  hasBcryptSafeByteLength,
  passwordService
};
