exports.requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  return next();
};

exports.requireApiAuth = (req, res, next) => {
  if (!req.session.user) {
    const error = new Error('Authentication required.');
    error.status = 401;
    error.code = 'AUTHENTICATION_REQUIRED';
    return next(error);
  }
  return next();
};

exports.attachUser = (req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
};
