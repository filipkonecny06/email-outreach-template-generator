const { validationResult } = require('express-validator');
const demoAccount = require('../config/demoAccount');
const { DEFAULT_SESSION_COOKIE_NAME } = require('../config/environment');
const { User } = require('../models');
const { INVALID_PASSWORD_HASH, passwordService } = require('../services/passwordService');

/** @typedef {{id: number, email: string}} SessionUser */

function retainedAuthValues(values = {}) {
  // Passwords and unrecognized form fields must never be reflected into an error response.
  const email = typeof values.email === 'string' ? values.email.trim().slice(0, 254) : '';
  return email ? { email } : {};
}

function renderAuthPage(
  _req,
  res,
  type,
  errors = [],
  values = {},
  status = 200,
  publicDemoAccount = demoAccount
) {
  return res.status(status).render('auth', {
    pageTitle: type === 'login' ? 'Login' : 'Register',
    type,
    errors,
    values: retainedAuthValues(values),
    demoAccount: type === 'login' ? publicDemoAccount : null
  });
}

function renderDuplicateEmail(req, res, publicDemoAccount = demoAccount) {
  return renderAuthPage(
    req,
    res,
    'register',
    [{ msg: 'Email is already in use.', path: 'email' }],
    req.body,
    409,
    publicDemoAccount
  );
}

/** Rotates the anonymous session and persists the minimum public user identity. */
function establishSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((regenerateError) => {
      if (regenerateError) return reject(regenerateError);
      req.session.user = { id: user.id, email: user.email };
      return req.session.save((saveError) => (saveError ? reject(saveError) : resolve()));
    });
  });
}

class AuthController {
  /**
   * @param {object} [dependencies]
   * @param {typeof User} [dependencies.UserModel]
   * @param {{hash(password: string): Promise<string>, compare(password: string, hash: string): Promise<boolean>}} [dependencies.passwords]
   * @param {{email: string, password: string}} [dependencies.publicDemoAccount]
   * @param {string} [dependencies.sessionCookieName]
   */
  constructor({
    UserModel = User,
    passwords = passwordService,
    publicDemoAccount = demoAccount,
    sessionCookieName = DEFAULT_SESSION_COOKIE_NAME
  } = {}) {
    this.User = UserModel;
    this.passwords = passwords;
    this.publicDemoAccount = publicDemoAccount;
    this.sessionCookieName = sessionCookieName;
    this.showLogin = this.showLogin.bind(this);
    this.showRegister = this.showRegister.bind(this);
    this.postRegister = this.postRegister.bind(this);
    this.postLogin = this.postLogin.bind(this);
    this.logout = this.logout.bind(this);
  }

  showLogin(req, res) {
    return renderAuthPage(req, res, 'login', [], {}, 200, this.publicDemoAccount);
  }

  showRegister(req, res) {
    return renderAuthPage(req, res, 'register', [], {}, 200, this.publicDemoAccount);
  }

  async postRegister(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return renderAuthPage(
          req,
          res,
          'register',
          errors.array(),
          req.body,
          422,
          this.publicDemoAccount
        );
      }

      const { email, password } = req.body;
      const existing = await this.User.findOne({ where: { email } });
      if (existing) return renderDuplicateEmail(req, res, this.publicDemoAccount);

      const passwordHash = await this.passwords.hash(password);
      const user = await this.User.create({ email, passwordHash });
      await establishSession(req, user);
      return res.redirect('/generator');
    } catch (error) {
      // The unique constraint closes the race between the lookup and concurrent inserts.
      if (error.name === 'SequelizeUniqueConstraintError') {
        return renderDuplicateEmail(req, res, this.publicDemoAccount);
      }
      return next(error);
    }
  }

  async postLogin(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return renderAuthPage(
          req,
          res,
          'login',
          errors.array(),
          req.body,
          422,
          this.publicDemoAccount
        );
      }

      const { email, password } = req.body;
      const user = await this.User.scope('withPassword').findOne({ where: { email } });
      const isValid = await this.passwords.compare(
        password,
        user?.passwordHash || INVALID_PASSWORD_HASH
      );
      if (!user || !isValid) {
        return renderAuthPage(
          req,
          res,
          'login',
          [{ msg: 'Invalid credentials.', path: 'email' }],
          req.body,
          401,
          this.publicDemoAccount
        );
      }

      await establishSession(req, user);
      return res.redirect('/generator');
    } catch (error) {
      return next(error);
    }
  }

  logout(req, res, next) {
    req.session.destroy((error) => {
      if (error) return next(error);
      res.clearCookie(this.sessionCookieName);
      return res.redirect('/');
    });
  }
}

const authController = new AuthController();

module.exports = {
  AuthController,
  establishSession,
  logout: authController.logout,
  postLogin: authController.postLogin,
  postRegister: authController.postRegister,
  renderAuthPage,
  renderDuplicateEmail,
  retainedAuthValues,
  showLogin: authController.showLogin,
  showRegister: authController.showRegister
};
