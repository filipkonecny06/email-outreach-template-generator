/**
 * Process entry point: verifies infrastructure, starts HTTP traffic, and owns graceful shutdown.
 */
require('dotenv').config({ quiet: true });

const { loadConfig } = require('./config/environment');
const { createApp, createSessionStore } = require('./app');
const { sequelize } = require('./models');
const logger = require('./utils/logger');

/**
 * Fails startup before the server accepts traffic when either persistent dependency is unusable.
 *
 * @param {object} dependencies - Database and session-store adapters.
 * @returns {Promise<void>}
 */
async function verifyRuntimeDependencies({ database = sequelize, sessionStore }) {
  await Promise.all([database.authenticate(), sessionStore.onReady()]);
  await sessionStore.length();
}

/**
 * Starts the application and registers process signal handlers.
 *
 * @returns {Promise<object>} Runtime handles exposed for smoke tests and controlled shutdown.
 */
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
    // Both operating-system signals can arrive; only the first may close shared resources.
    if (shutdownStarted) return;
    shutdownStarted = true;
    logger.info('server_shutdown_started', { signal });
    // A fixed deadline prevents a stuck connection from blocking container termination forever.
    const forcedExit = setTimeout(() => process.exit(1), 10000);
    forcedExit.unref();

    try {
      // Stop accepting requests before closing the database and session connection pools.
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
