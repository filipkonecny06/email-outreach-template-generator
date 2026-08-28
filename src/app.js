const path = require('node:path');
const { randomUUID } = require('node:crypto');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const { csrfSync } = require('csrf-sync');
const helmet = require('helmet');
const methodOverride = require('method-override');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { loadConfig } = require('./config/environment');
const logger = require('./utils/logger');
const { attachUser, requireAuth } = require('./middleware/auth');
const { errorHandler, notFound } = require('./middleware/errors');
const pageRoutes = require('./routes/pages');
const authRoutes = require('./routes/auth');
const historyRoutes = require('./routes/history');
const apiRoutes = require('./routes/api');

function createSessionStore(config) {
  return new MySQLStore({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.name,
    createDatabaseTable: false,
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: config.session.maxAgeMs
  });
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
  app.use(
    rateLimit({
      windowMs: config.rateLimit.windowMs,
      limit: config.rateLimit.max,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' }
      }
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
  app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', etag: true }));
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

  app.get('/healthz', (_req, res) => res.status(200).json({ ok: true, status: 'live' }));
  app.use('/', pageRoutes);
  app.use('/auth', authRoutes);
  app.use('/history', requireAuth, historyRoutes);
  app.use('/api', apiRoutes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp, createSessionStore };
