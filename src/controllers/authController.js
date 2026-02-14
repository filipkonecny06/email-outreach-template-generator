const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');
const { User } = require('../models');

function renderAuthPage(req, res, type, errors = [], values = {}) {
  res.status(200).render('auth', {
    pageTitle: type === 'login' ? 'Login' : 'Register',
    type,
    errors,
    values
  });
}

exports.showLogin = (req, res) => renderAuthPage(req, res, 'login');
exports.showRegister = (req, res) => renderAuthPage(req, res, 'register');

exports.postRegister = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return renderAuthPage(req, res, 'register', errors.array(), req.body);
    }

    const { email, password } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return renderAuthPage(req, res, 'register', [{ msg: 'Email is already in use.', path: 'email' }], req.body);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, passwordHash });

    req.session.user = { id: user.id, email: user.email };
    return req.session.save(() => res.redirect('/generator'));
  } catch (error) {
    return next(error);
  }
};

exports.postLogin = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return renderAuthPage(req, res, 'login', errors.array(), req.body);
    }

    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return renderAuthPage(req, res, 'login', [{ msg: 'Invalid credentials.', path: 'email' }], req.body);
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return renderAuthPage(req, res, 'login', [{ msg: 'Invalid credentials.', path: 'password' }], req.body);
    }

    req.session.user = { id: user.id, email: user.email };
    return req.session.save(() => res.redirect('/generator'));
  } catch (error) {
    return next(error);
  }
};

exports.logout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('sid');
    return res.redirect('/');
  });
};
