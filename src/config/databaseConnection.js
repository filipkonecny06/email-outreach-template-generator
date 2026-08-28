/**
 * Translates the shared database configuration into options for each MySQL consumer.
 */
/** Returns TLS options only when encrypted database transport is explicitly enabled. */
function createTlsOptions(database) {
  if (!database.ssl?.enabled) return undefined;

  return {
    rejectUnauthorized: database.ssl.rejectUnauthorized,
    ...(database.ssl.ca ? { ca: database.ssl.ca } : {})
  };
}

/** Builds mysql2 options for the server-side session connection pool. */
function createMySqlConnectionOptions(database) {
  const ssl = createTlsOptions(database);
  return {
    host: database.host,
    port: database.port,
    user: database.user,
    password: database.password,
    database: database.name,
    ...(ssl ? { ssl } : {})
  };
}

/** Builds options understood by sequelize-cli migrations. */
function createSequelizeCliOptions(database) {
  const ssl = createTlsOptions(database);
  return {
    host: database.host,
    port: database.port,
    dialect: 'mysql',
    logging: false,
    ...(ssl ? { dialectOptions: { ssl } } : {})
  };
}

/** Builds runtime Sequelize options while retaining the project's model naming convention. */
function createSequelizeOptions(database) {
  return {
    ...createSequelizeCliOptions(database),
    define: {
      underscored: false
    }
  };
}

module.exports = {
  createMySqlConnectionOptions,
  createSequelizeCliOptions,
  createSequelizeOptions,
  createTlsOptions
};
