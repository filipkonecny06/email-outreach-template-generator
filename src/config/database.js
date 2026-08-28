const { Sequelize } = require('sequelize');
const { createSequelizeOptions } = require('./databaseConnection');
const { loadValidatedDatabaseConfig } = require('./environment');

const database = loadValidatedDatabaseConfig();
const sequelize = new Sequelize(
  database.name,
  database.user,
  database.password,
  createSequelizeOptions(database)
);

module.exports = sequelize;
