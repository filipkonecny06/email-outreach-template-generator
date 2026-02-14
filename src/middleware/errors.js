const logger = require('../utils/logger');

exports.notFound = (req, res) => {
  res.status(404).render('404', { pageTitle: 'Page Not Found' });
};

exports.errorHandler = (err, req, res, next) => {
  logger.error(err.message, { stack: err.stack, path: req.path });

  if (res.headersSent) return next(err);

  const status = err.status || 500;
  if (req.path.startsWith('/api')) {
    return res.status(status).json({ message: status === 500 ? 'Server error.' : err.message });
  }

  return res.status(status).render('500', {
    pageTitle: 'Server Error',
    errorId: Date.now()
  });
};
