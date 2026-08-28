/** Centralizes path-based error formats, safe responses, and structured failure logging. */
const logger = require('../utils/logger');

/** Uses the API path boundary to select the JSON error contract. */
function wantsJson(req) {
  const requestPath = req.path || String(req.originalUrl || '').split('?')[0];
  return requestPath === '/api' || requestPath.startsWith('/api/');
}

/** Sends the correct not-found representation for API and browser routes. */
exports.notFound = (req, res) => {
  if (wantsJson(req)) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'API endpoint not found.', requestId: req.id }
    });
  }
  return res.status(404).render('404', { pageTitle: 'Page Not Found' });
};

/** Creates the final Express error handler with an injectable structured logger. */
function createErrorHandler({ appLogger = logger } = {}) {
  return (err, req, res, next) => {
    const status = Number(err.status || (err.code === 'EBADCSRFTOKEN' ? 403 : 500));
    const metadata = {
      path: req.path,
      method: req.method,
      requestId: req.id,
      status,
      ...(status >= 500 ? { stack: err.stack } : {})
    };

    // Stack traces are operational details: log them for server errors, never send them to users.
    if (status >= 500) appLogger.error(err.message, metadata);
    else appLogger.warn(err.message, metadata);

    // Express must finish a response already in progress; sending again would corrupt it.
    if (res.headersSent) return next(err);

    res.locals.csrfToken ??= '';
    res.locals.currentUser ??= null;
    res.locals.requestId ??= req.id;

    if (wantsJson(req)) {
      const safeMessage = status >= 500 ? 'An unexpected server error occurred.' : err.message;
      return res.status(status).json({
        error: {
          code: status >= 500 ? 'INTERNAL_ERROR' : err.code || 'REQUEST_FAILED',
          message: safeMessage,
          ...(err.details ? { details: err.details } : {}),
          requestId: req.id
        }
      });
    }

    return res.status(status).render('500', {
      pageTitle: status >= 500 ? 'Server Error' : 'Request Error',
      errorId: req.id,
      status,
      message: status >= 500 ? 'Something failed on our side.' : err.message
    });
  };
}

exports.createErrorHandler = createErrorHandler;
exports.wantsJson = wantsJson;
