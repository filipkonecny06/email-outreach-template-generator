/** Supplies sequelize-cli with the same validated connection policy used at runtime. */
require('dotenv').config({ quiet: true });

const { loadValidatedDatabaseConfig } = require('./environment');
const { createSequelizeCliOptions } = require('./databaseConnection');

const database = loadValidatedDatabaseConfig();
// All environments are selected through environment variables, not duplicated config blocks.
const common = {
  ...createSequelizeCliOptions(database),
  username: database.user,
  password: database.password,
  database: database.name
};

module.exports = {
  development: { ...common },
  test: { ...common },
  production: { ...common }
};
