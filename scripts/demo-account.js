#!/usr/bin/env node

/** Idempotently provisions the public portfolio account through the ordinary User model. */
require('dotenv').config({ quiet: true });

const demoAccount = require('../src/config/demoAccount');
const { createPasswordService } = require('../src/services/passwordService');

async function syncDemoAccount({
  User,
  bcryptApi,
  credentials = demoAccount,
  passwordService
} = {}) {
  const passwords = passwordService || createPasswordService({ bcryptApi });
  const existing = await User.scope('withPassword').findOne({
    where: { email: credentials.email }
  });

  if (!existing) {
    const passwordHash = await passwords.hash(credentials.password);
    await User.create({ email: credentials.email, passwordHash });
    return { email: credentials.email, status: 'created' };
  }

  if (await passwords.compare(credentials.password, existing.passwordHash)) {
    return { email: credentials.email, status: 'unchanged' };
  }

  const passwordHash = await passwords.hash(credentials.password);
  await existing.update({ passwordHash });
  return { email: credentials.email, status: 'updated' };
}

async function main() {
  const { User, sequelize } = require('../src/models');

  try {
    await sequelize.authenticate();
    const result = await syncDemoAccount({ User });
    process.stdout.write(`Demo account ${result.status}: ${result.email}\n`);
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { main, syncDemoAccount };
