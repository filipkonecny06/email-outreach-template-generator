const logger = require('../utils/logger');

function wantsJson(req) {
  return req.originalUrl.startsWith('/api/');
}

exports.notFound = (req, res) => {
  if (wantsJson(req)) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'API endpoint not found.', requestId: req.id }
    });
  }
  return res.status(404).render('404', { pageTitle: 'Page Not Found' });
};

exports.errorHandler = (err, req, res, next) => {
  const status = Number(err.status || (err.code === 'EBADCSRFTOKEN' ? 403 : 500));
  logger.error(err.message, {
    stack: err.stack,
    path: req.path,
    method: req.method,
    requestId: req.id,
    status
  });

  if (res.headersSent) return next(err);

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
    pageTitle: 'Server Error',
    errorId: req.id
  });
};

exports.wantsJson = wantsJson;
