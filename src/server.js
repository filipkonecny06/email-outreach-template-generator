require('dotenv').config({ quiet: true });

const { loadConfig } = require('./config/environment');
const { createApp, createSessionStore } = require('./app');
const { sequelize } = require('./models');
const logger = require('./utils/logger');

async function verifyRuntimeDependencies({ database = sequelize, sessionStore }) {
  await Promise.all([database.authenticate(), sessionStore.onReady()]);
  await sessionStore.length();
}

async function start() {
  const config = loadConfig();
  const sessionStore = createSessionStore(config);
  const app = createApp({ config, sessionStore });
  await verifyRuntimeDependencies({ sessionStore });
  const server = app.listen(config.port, () => {
    logger.info('server_started', {
      url: `http://localhost:${config.port}`,
      environment: config.nodeEnv
    });
  });

  let shutdownStarted = false;
  const shutdown = async (signal) => {
    if (shutdownStarted) return;
    shutdownStarted = true;
    logger.info('server_shutdown_started', { signal });
    const forcedExit = setTimeout(() => process.exit(1), 10000);
    forcedExit.unref();

    try {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      await Promise.all([sequelize.close(), sessionStore.close()]);
      clearTimeout(forcedExit);
      logger.info('server_shutdown_complete', { signal });
      process.exit(0);
    } catch (error) {
      logger.error('server_shutdown_failed', { signal, message: error.message });
      await Promise.allSettled([sequelize.close(), sessionStore.close()]);
      clearTimeout(forcedExit);
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
  return { app, server, sequelize, sessionStore };
}

if (require.main === module) {
  start().catch((error) => {
    logger.error('server_start_failed', { message: error.message, stack: error.stack });
    process.exit(1);
  });
}

module.exports = { start, verifyRuntimeDependencies };
