/** Authentication boundaries for browser navigation and JSON API requests. */
/** Redirects unauthenticated page requests to the login flow. */
exports.requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  return next();
};

/** Reports missing API authentication through the centralized JSON error handler. */
exports.requireApiAuth = (req, res, next) => {
  if (!req.session.user) {
    const error = new Error('Authentication required.');
    error.status = 401;
    error.code = 'AUTHENTICATION_REQUIRED';
    return next(error);
  }
  return next();
};

/** Makes the minimal session identity available to every server-rendered view. */
exports.attachUser = (req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
};
