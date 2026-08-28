function createTlsOptions(database) {
  if (!database.ssl?.enabled) return undefined;

  return {
    rejectUnauthorized: database.ssl.rejectUnauthorized,
    ...(database.ssl.ca ? { ca: database.ssl.ca } : {})
  };
}

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
