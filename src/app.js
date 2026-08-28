/**
 * Builds the Express application and its MySQL-backed session store.
 * Middleware is registered here so HTTP security policy and route boundaries stay reviewable.
 */
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const mysql = require('mysql2/promise');
const { csrfSync } = require('csrf-sync');
const helmet = require('helmet');
const methodOverride = require('method-override');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { loadConfig } = require('./config/environment');
const { createMySqlConnectionOptions } = require('./config/databaseConnection');
const logger = require('./utils/logger');
const { attachUser, requireAuth } = require('./middleware/auth');
const { createErrorHandler, notFound } = require('./middleware/errors');
const { AppError } = require('./utils/errors');
const pageRoutes = require('./routes/pages');
const { createAuthRouter } = require('./routes/auth');
const historyRoutes = require('./routes/history');
const apiRoutes = require('./routes/api');

/**
 * @typedef {object} ApplicationConfig
 * @property {string} nodeEnv
 * @property {boolean} isProduction
 * @property {number} port
 * @property {boolean | number | string} trustProxy
 * @property {string} bodyLimit
 * @property {{name: string, secret: string, maxAgeMs: number}} session
 * @property {{windowMs: number, max: number, authWindowMs: number, authMax: number}} rateLimit
 * @property {{host: string, port: number, name: string, user: string, password: string, ssl: object}} database
 */

/**
 * Creates the persistent session adapter used by Express.
 * Keeping sessions in MySQL avoids losing logins when the Node.js process restarts.
 *
 * @param {ApplicationConfig} config - Validated application configuration.
 * @param {object} [dependencies] - Optional adapters used by tests.
 * @returns {object} An express-session compatible store.
 */
function createSessionStore(config, { Store = MySQLStore, createPool = mysql.createPool } = {}) {
  const connection = createPool({
    ...createMySqlConnectionOptions(config.database),
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    idleTimeout: 60000,
    queueLimit: 0
  });

  return new Store(
    {
      createDatabaseTable: false,
      clearExpired: true,
      checkExpirationInterval: 15 * 60 * 1000,
      expiration: config.session.maxAgeMs,
      endConnectionOnClose: true
    },
    connection
  );
}

/** Builds a rate limiter that forwards failures through the shared error contract. */
function createRequestLimiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new AppError(message, { status: 429, code: 'RATE_LIMITED' }))
  });
}

/**
 * Composes the HTTP application without opening a network port.
 * Dependency parameters keep integration tests isolated from real infrastructure.
 *
 * @param {{config?: ApplicationConfig, sessionStore?: object, appLogger?: object}} [options]
 * @returns {import('express').Express} A configured Express application.
 */
function createApp({
  config = loadConfig(),
  sessionStore = createSessionStore(config),
  appLogger = logger
} = {}) {
  const app = express();
  const { csrfSynchronisedProtection, generateToken } = csrfSync({
    // Browser forms submit the token in the body; JSON clients use a request header.
    getTokenFromRequest: (req) =>
      req.is('application/x-www-form-urlencoded') ? req.body._csrf : req.get('x-csrf-token')
  });

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.set('layout', 'layout');

  // The same request ID is returned to clients and included in error logs for correlation.
  app.use((req, res, next) => {
    req.id = req.get('x-request-id') || randomUUID();
    res.setHeader('x-request-id', req.id);
    res.locals.csrfToken = '';
    res.locals.currentUser = null;
    res.locals.requestId = req.id;
    next();
  });
  app.use(expressLayouts);
  // The application deliberately serves scripts and styles from its own origin only.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          fontSrc: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          imgSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          upgradeInsecureRequests: config.isProduction ? [] : null
        }
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    })
  );
  // Liveness stays independent of sessions, CSRF, and authentication for container probes.
  app.get('/healthz', (_req, res) =>
    res.set('Cache-Control', 'no-store').status(200).json({ ok: true, status: 'live' })
  );
  app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0, etag: true }));
  // Personalized and token-bearing HTML/API responses must not be cached by shared clients.
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(
    createRequestLimiter({
      windowMs: config.rateLimit.windowMs,
      limit: config.rateLimit.max,
      message: 'Too many requests. Please try again later.'
    })
  );
  app.use(
    morgan('combined', {
      stream: { write: (message) => appLogger.info('http_request', { line: message.trim() }) }
    })
  );
  app.use(express.urlencoded({ extended: false, limit: config.bodyLimit }));
  app.use(express.json({ limit: config.bodyLimit }));
  app.use(methodOverride('_method'));
  // The signed cookie holds only the session ID; session data remains in MySQL.
  app.use(
    session({
      name: config.session.name,
      secret: config.session.secret,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.isProduction,
        maxAge: config.session.maxAgeMs
      }
    })
  );
  // Synchronizer tokens depend on the session, so CSRF protection must follow session setup.
  app.use(csrfSynchronisedProtection);
  app.use(attachUser);
  app.use((req, res, next) => {
    res.locals.csrfToken = generateToken(req);
    res.locals.requestId = req.id;
    next();
  });

  // Authentication gets a tighter limit than ordinary application traffic.
  const authLimiter = createRequestLimiter({
    windowMs: config.rateLimit.authWindowMs,
    limit: config.rateLimit.authMax,
    message: 'Too many authentication attempts. Please try again later.'
  });
  app.post(['/auth/login', '/auth/register'], authLimiter);

  app.use('/', pageRoutes);
  app.use('/auth', createAuthRouter({ sessionCookieName: config.session.name }));
  app.use('/history', requireAuth, historyRoutes);
  app.use('/api', apiRoutes);
  app.use(notFound);
  app.use(createErrorHandler({ appLogger }));

  return app;
}

module.exports = { createApp, createRequestLimiter, createSessionStore };
