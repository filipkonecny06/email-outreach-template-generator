const VALID_ENVIRONMENTS = new Set(['development', 'test', 'production']);

function integer(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = value === undefined || value === '' ? fallback : Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : Number.NaN;
}

function parseTrustProxy(value) {
  if (value === undefined || value === '' || value === 'false') return false;
  if (value === 'true') return 1;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

function loadConfig({ env = process.env } = {}) {
  const nodeEnv = env.NODE_ENV || 'development';
  const config = {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    appName: env.APP_NAME || 'OutreachOps',
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
      max: integer(env.RATE_LIMIT_MAX, 200, { min: 1 })
    },
    database: {
      host: env.DB_HOST,
      port: integer(env.DB_PORT, 3306, { min: 1, max: 65535 }),
      name: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD || ''
    }
  };

  const errors = [];
  if (!VALID_ENVIRONMENTS.has(nodeEnv))
    errors.push('NODE_ENV must be development, test, or production.');
  if (!Number.isInteger(config.port)) errors.push('PORT must be an integer from 1 to 65535.');
  if (!Number.isInteger(config.database.port))
    errors.push('DB_PORT must be an integer from 1 to 65535.');
  if (!Number.isInteger(config.rateLimit.windowMs))
    errors.push('RATE_LIMIT_WINDOW_MS must be at least 1000.');
  if (!Number.isInteger(config.rateLimit.max))
    errors.push('RATE_LIMIT_MAX must be a positive integer.');
  if (!Number.isInteger(config.session.maxAgeMs))
    errors.push('SESSION_MAX_AGE_MS must be at least 60000.');
  for (const [name, value] of [
    ['SESSION_SECRET', config.session.secret],
    ['DB_HOST', config.database.host],
    ['DB_NAME', config.database.name],
    ['DB_USER', config.database.user]
  ]) {
    if (!value) errors.push(`${name} is required.`);
  }
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
    const error = new Error(`Invalid environment configuration:\n- ${errors.join('\n- ')}`);
    error.code = 'INVALID_CONFIGURATION';
    throw error;
  }

  return Object.freeze(config);
}

module.exports = { loadConfig, parseTrustProxy };
