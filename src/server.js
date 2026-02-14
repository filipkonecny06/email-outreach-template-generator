require('dotenv').config();

const app = require('./app');
const { sequelize } = require('./models');
const logger = require('./utils/logger');

const port = Number(process.env.PORT || 3000);

(async () => {
  try {
    await sequelize.authenticate();
    app.listen(port, () => {
      logger.info(`Server listening on http://localhost:${port}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { message: error.message });
    process.exit(1);
  }
})();
