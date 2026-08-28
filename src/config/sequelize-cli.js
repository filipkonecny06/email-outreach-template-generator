require('dotenv').config({ quiet: true });

const { loadValidatedDatabaseConfig } = require('./environment');
const { createSequelizeCliOptions } = require('./databaseConnection');

const database = loadValidatedDatabaseConfig();
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
