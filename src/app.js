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
const authRoutes = require('./routes/auth');
const historyRoutes = require('./routes/history');
const apiRoutes = require('./routes/api');

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

function createApp({
  config = loadConfig(),
  sessionStore = createSessionStore(config),
  appLogger = logger
} = {}) {
  const app = express();
  const { csrfSynchronisedProtection, generateToken } = csrfSync({
    getTokenFromRequest: (req) =>
      req.is('application/x-www-form-urlencoded') ? req.body._csrf : req.get('x-csrf-token')
  });

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.set('layout', 'layout');

  app.use((req, res, next) => {
    req.id = req.get('x-request-id') || randomUUID();
    res.setHeader('x-request-id', req.id);
    res.locals.csrfToken = '';
    res.locals.currentUser = null;
    res.locals.requestId = req.id;
    next();
  });
  app.use(expressLayouts);
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
  app.get('/healthz', (_req, res) =>
    res.set('Cache-Control', 'no-store').status(200).json({ ok: true, status: 'live' })
  );
  app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0, etag: true }));
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(
    rateLimit({
      windowMs: config.rateLimit.windowMs,
      limit: config.rateLimit.max,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, _res, next) =>
        next(
          new AppError('Too many requests. Please try again later.', {
            status: 429,
            code: 'RATE_LIMITED'
          })
        )
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
  app.use(csrfSynchronisedProtection);
  app.use(attachUser);
  app.use((req, res, next) => {
    res.locals.csrfToken = generateToken(req);
    res.locals.requestId = req.id;
    next();
  });

  const authLimiter = rateLimit({
    windowMs: config.rateLimit.authWindowMs,
    limit: config.rateLimit.authMax,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(
        new AppError('Too many authentication attempts. Please try again later.', {
          status: 429,
          code: 'RATE_LIMITED'
        })
      )
  });
  app.post(['/auth/login', '/auth/register'], authLimiter);

  app.use('/', pageRoutes);
  app.use('/auth', authRoutes);
  app.use('/history', requireAuth, historyRoutes);
  app.use('/api', apiRoutes);
  app.use(notFound);
  app.use(createErrorHandler({ appLogger }));

  return app;
}

module.exports = { createApp, createSessionStore };
