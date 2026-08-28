/**
 * Parses environment variables into the single validated runtime configuration contract.
 */
const VALID_ENVIRONMENTS = new Set(['development', 'test', 'production']);

/** Converts an optional environment value to a bounded integer or NaN when invalid. */
function integer(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = value === undefined || value === '' ? fallback : Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : Number.NaN;
}

/** Converts the supported environment spellings to a boolean without accepting ambiguous text. */
function boolean(value, fallback) {
  if (value === undefined || value === '') return fallback;
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return null;
}

function parseDatabaseConfig(env) {
  return {
    host: env.DB_HOST,
    port: integer(env.DB_PORT, 3306, { min: 1, max: 65535 }),
    name: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD || '',
    ssl: {
      enabled: boolean(env.DB_SSL, false),
      rejectUnauthorized: boolean(env.DB_SSL_REJECT_UNAUTHORIZED, true),
      ca: env.DB_SSL_CA ? env.DB_SSL_CA.replace(/\\n/g, '\n') : undefined
    }
  };
}

function databaseConfigErrors(database) {
  const errors = [];
  if (!Number.isInteger(database.port)) {
    errors.push('DB_PORT must be an integer from 1 to 65535.');
  }
  if (database.ssl.enabled === null) errors.push('DB_SSL must be true or false.');
  if (database.ssl.rejectUnauthorized === null) {
    errors.push('DB_SSL_REJECT_UNAUTHORIZED must be true or false.');
  }
  for (const [name, value] of [
    ['DB_HOST', database.host],
    ['DB_NAME', database.name],
    ['DB_USER', database.user]
  ]) {
    if (!value) errors.push(`${name} is required.`);
  }
  return errors;
}

function invalidConfiguration(errors) {
  const error = new Error(`Invalid environment configuration:\n- ${errors.join('\n- ')}`);
  error.code = 'INVALID_CONFIGURATION';
  return error;
}

/**
 * Loads only the database settings required by migrations and standalone database tools.
 *
 * @param {object} [options] - An optional environment map, primarily for tests.
 * @returns {object} Validated database settings.
 * @throws {Error} When a required value is missing or malformed.
 */
function loadValidatedDatabaseConfig({ env = process.env } = {}) {
  const database = parseDatabaseConfig(env);
  const errors = databaseConfigErrors(database);
  if (errors.length > 0) throw invalidConfiguration(errors);
  return database;
}

/** Preserves Express's supported proxy modes while normalizing common environment values. */
function parseTrustProxy(value) {
  if (value === undefined || value === '' || value === 'false') return false;
  if (value === 'true') return 1;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

/**
 * Loads HTTP process configuration and validates the required settings with defined constraints.
 * Validation is eager so malformed required values fail before request handling starts.
 *
 * @param {object} [options] - An optional environment map, primarily for tests.
 * @returns {Readonly<object>} Validated top-level application configuration.
 * @throws {Error} When one or more required settings fail validation.
 */
function loadConfig({ env = process.env } = {}) {
  const nodeEnv = env.NODE_ENV || 'development';
  const config = {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port: integer(env.PORT, 3000, { min: 1, max: 65535 }),
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    bodyLimit: env.BODY_LIMIT || '100kb',
    session: {
      name: env.SESSION_COOKIE_NAME || 'outreach.sid',
      secret: env.SESSION_SECRET,
      maxAgeMs: integer(env.SESSION_MAX_AGE_MS, 86400000, { min: 60000 })
    },
    rateLimit: {
      windowMs: integer(env.RATE_LIMIT_WINDOW_MS, 900000, { min: 1000 }),
      max: integer(env.RATE_LIMIT_MAX, 200, { min: 1 }),
      authWindowMs: integer(env.AUTH_RATE_LIMIT_WINDOW_MS, 900000, { min: 1000 }),
      authMax: integer(env.AUTH_RATE_LIMIT_MAX, 10, { min: 1 })
    },
    database: parseDatabaseConfig(env)
  };

  const errors = [];
  if (!VALID_ENVIRONMENTS.has(nodeEnv))
    errors.push('NODE_ENV must be development, test, or production.');
  if (!Number.isInteger(config.port)) errors.push('PORT must be an integer from 1 to 65535.');
  errors.push(...databaseConfigErrors(config.database));
  if (!Number.isInteger(config.rateLimit.windowMs))
    errors.push('RATE_LIMIT_WINDOW_MS must be at least 1000.');
  if (!Number.isInteger(config.rateLimit.max))
    errors.push('RATE_LIMIT_MAX must be a positive integer.');
  if (!Number.isInteger(config.rateLimit.authWindowMs))
    errors.push('AUTH_RATE_LIMIT_WINDOW_MS must be at least 1000.');
  if (!Number.isInteger(config.rateLimit.authMax))
    errors.push('AUTH_RATE_LIMIT_MAX must be a positive integer.');
  if (!Number.isInteger(config.session.maxAgeMs))
    errors.push('SESSION_MAX_AGE_MS must be at least 60000.');
  if (!config.session.secret) errors.push('SESSION_SECRET is required.');
  if (config.session.secret && config.session.secret.length < 32) {
    errors.push('SESSION_SECRET must contain at least 32 characters.');
  }
  if (
    config.session.secret &&
    /replace|change[-_ ]?me|unsafe|example/i.test(config.session.secret)
  ) {
    errors.push('SESSION_SECRET must be replaced with a unique random value.');
  }

  if (errors.length > 0) {
    throw invalidConfiguration(errors);
  }

  // Freezing the top-level object prevents accidental runtime replacement of configuration groups.
  return Object.freeze(config);
}

module.exports = { boolean, loadConfig, loadValidatedDatabaseConfig, parseTrustProxy };
