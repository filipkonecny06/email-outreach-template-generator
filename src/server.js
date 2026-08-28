require('dotenv').config();

const { loadConfig } = require('./config/environment');
const { createApp } = require('./app');
const { sequelize } = require('./models');
const logger = require('./utils/logger');

async function start() {
  const config = loadConfig();
  await sequelize.authenticate();

  const app = createApp({ config });
  const server = app.listen(config.port, () => {
    logger.info('server_started', {
      url: `http://localhost:${config.port}`,
      environment: config.nodeEnv
    });
  });

  const shutdown = async (signal) => {
    logger.info('server_shutdown_started', { signal });
    server.close(async () => {
      await sequelize.close();
      logger.info('server_shutdown_complete', { signal });
      process.exit(0);
    });
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
  return server;
}

if (require.main === module) {
  start().catch((error) => {
    logger.error('server_start_failed', { message: error.message, stack: error.stack });
    process.exit(1);
  });
}

module.exports = { start };
