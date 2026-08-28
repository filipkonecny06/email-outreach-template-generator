const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');
const { User } = require('../models');

const INVALID_PASSWORD_HASH = '$2b$12$jbQxnq8l5trJLrlr4HGWbuf/tZx1nxIiVSxG6vNZj9bIm0LT/0pV6';

function retainedAuthValues(values = {}) {
  const email = typeof values.email === 'string' ? values.email.trim().slice(0, 254) : '';
  return email ? { email } : {};
}

function renderAuthPage(_req, res, type, errors = [], values = {}, status = 200) {
  return res.status(status).render('auth', {
    pageTitle: type === 'login' ? 'Login' : 'Register',
    type,
    errors,
    values: retainedAuthValues(values)
  });
}

function renderDuplicateEmail(req, res) {
  return renderAuthPage(
    req,
    res,
    'register',
    [{ msg: 'Email is already in use.', path: 'email' }],
    req.body,
    409
  );
}

function establishSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((regenerateError) => {
      if (regenerateError) return reject(regenerateError);
      req.session.user = { id: user.id, email: user.email };
      return req.session.save((saveError) => (saveError ? reject(saveError) : resolve()));
    });
  });
}

exports.showLogin = (req, res) => renderAuthPage(req, res, 'login');
exports.showRegister = (req, res) => renderAuthPage(req, res, 'register');

exports.postRegister = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return renderAuthPage(req, res, 'register', errors.array(), req.body, 422);
    }

    const { email, password } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) return renderDuplicateEmail(req, res);

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, passwordHash });

    await establishSession(req, user);
    return res.redirect('/generator');
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return renderDuplicateEmail(req, res);
    }
    return next(error);
  }
};

exports.postLogin = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return renderAuthPage(req, res, 'login', errors.array(), req.body, 422);
    }

    const { email, password } = req.body;
    const user = await User.scope('withPassword').findOne({ where: { email } });
    const isValid = await bcrypt.compare(password, user?.passwordHash || INVALID_PASSWORD_HASH);
    if (!user || !isValid) {
      return renderAuthPage(
        req,
        res,
        'login',
        [{ msg: 'Invalid credentials.', path: 'email' }],
        req.body,
        401
      );
    }

    await establishSession(req, user);
    return res.redirect('/generator');
  } catch (error) {
    return next(error);
  }
};

exports.logout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie(process.env.SESSION_COOKIE_NAME || 'outreach.sid');
    return res.redirect('/');
  });
};

exports.establishSession = establishSession;
exports.renderAuthPage = renderAuthPage;
exports.renderDuplicateEmail = renderDuplicateEmail;
exports.retainedAuthValues = retainedAuthValues;
