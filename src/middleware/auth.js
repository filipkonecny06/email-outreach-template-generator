exports.requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  return next();
};

exports.attachUser = (req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
};
