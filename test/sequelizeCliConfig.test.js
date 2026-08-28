const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

process.env.NODE_ENV = 'test';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '3306';
process.env.DB_NAME = 'ci_exact_database';
process.env.DB_USER = 'outreach';
process.env.DB_PASSWORD = 'outreach';
process.env.DB_SSL = 'false';

const cliConfig = require('../src/config/sequelize-cli');

test('sequelize CLI uses the configured database name unchanged in every environment', () => {
  assert.equal(cliConfig.development.database, 'ci_exact_database');
  assert.equal(cliConfig.test.database, 'ci_exact_database');
  assert.equal(cliConfig.production.database, 'ci_exact_database');
});

test('sequelize CLI rejects malformed database TLS booleans before creating options', () => {
  const script =
    "try { require('./src/config/sequelize-cli'); } catch (error) { " +
    "process.stderr.write(String(error.code) + '\\n' + error.message); process.exit(2); }";
  const repositoryRoot = path.join(__dirname, '..');

  for (const invalidEnvironment of [
    { DB_SSL: 'treu', DB_SSL_REJECT_UNAUTHORIZED: 'true' },
    { DB_SSL: 'true', DB_SSL_REJECT_UNAUTHORIZED: 'treu' }
  ]) {
    const result = spawnSync(process.execPath, ['-e', script], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: { ...process.env, ...invalidEnvironment }
    });

    assert.equal(result.status, 2);
    assert.match(result.stderr, /INVALID_CONFIGURATION/);
    assert.match(result.stderr, /must be true or false/);
  }
});
