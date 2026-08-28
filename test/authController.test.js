const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DB_HOST = '127.0.0.1';
process.env.DB_NAME = 'outreach_test';
process.env.DB_USER = 'outreach';

const bcrypt = require('bcrypt');
const { loginValidation, registerValidation } = require('../src/middleware/validation');
const authController = require('../src/controllers/authController');
const demoAccount = require('../src/config/demoAccount');
const { User } = require('../src/models');

function responseRecorder() {
  return {
    statusCode: 200,
    view: undefined,
    locals: undefined,
    redirectLocation: undefined,
    clearedCookies: [],
    status(code) {
      this.statusCode = code;
      return this;
    },
    render(view, locals) {
      this.view = view;
      this.locals = locals;
      return this;
    },
    redirect(location) {
      this.redirectLocation = location;
      return this;
    },
    clearCookie(name) {
      this.clearedCookies.push(name);
      return this;
    }
  };
}

async function runRules(rules, req) {
  await Promise.all(rules.map((rule) => rule.run(req)));
}

test('login exposes the documented demo account while registration does not', () => {
  const loginResponse = responseRecorder();
  const registerResponse = responseRecorder();

  authController.showLogin({}, loginResponse);
  authController.showRegister({}, registerResponse);

  assert.equal(loginResponse.locals.demoAccount, demoAccount);
  assert.equal(registerResponse.locals.demoAccount, null);
});

test('invalid authentication input returns 422 and never retains the password', async () => {
  const req = {
    body: { email: 'invalid@example', password: 'plain-text-password' }
  };
  await runRules(loginValidation, req);
  const res = responseRecorder();

  await authController.postLogin(req, res, assert.fail);

  assert.equal(res.statusCode, 422);
  assert.equal(res.view, 'auth');
  assert.deepEqual(res.locals.values, { email: 'invalid@example' });
  assert.equal('password' in res.locals.values, false);
});

test('invalid credentials return 401 through the explicit password scope', async (context) => {
  const originalScope = User.scope;
  const originalCompare = bcrypt.compare;
  let requestedScope;
  const comparedValues = [];
  context.after(() => {
    User.scope = originalScope;
    bcrypt.compare = originalCompare;
  });
  User.scope = (scope) => {
    requestedScope = scope;
    return { findOne: async () => null };
  };
  bcrypt.compare = async (...values) => {
    comparedValues.push(values);
    return false;
  };
  const req = {
    body: { email: 'person@example.com', password: 'valid-password-value' }
  };
  await runRules(loginValidation, req);
  const res = responseRecorder();

  await authController.postLogin(req, res, assert.fail);

  assert.equal(requestedScope, 'withPassword');
  assert.equal(comparedValues.length, 1);
  assert.equal(comparedValues[0][0], 'valid-password-value');
  assert.match(comparedValues[0][1], /^\$2b\$12\$/);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.locals.errors, [{ msg: 'Invalid credentials.', path: 'email' }]);
  assert.deepEqual(res.locals.values, { email: 'person@example.com' });
  assert.equal('password' in res.locals.values, false);
});

test('an incorrect password is compared and returns the same safe credential error', async (context) => {
  const originalScope = User.scope;
  const originalCompare = bcrypt.compare;
  const comparedValues = [];
  context.after(() => {
    User.scope = originalScope;
    bcrypt.compare = originalCompare;
  });
  User.scope = () => ({
    findOne: async () => ({
      id: 7,
      email: 'person@example.com',
      passwordHash: 'stored-password-hash'
    })
  });
  bcrypt.compare = async (...values) => {
    comparedValues.push(values);
    return false;
  };
  const req = {
    body: { email: 'person@example.com', password: 'valid-password-value' }
  };
  await runRules(loginValidation, req);
  const res = responseRecorder();

  await authController.postLogin(req, res, assert.fail);

  assert.deepEqual(comparedValues, [['valid-password-value', 'stored-password-hash']]);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.locals.errors, [{ msg: 'Invalid credentials.', path: 'email' }]);
  assert.deepEqual(res.locals.values, { email: 'person@example.com' });
  assert.equal('password' in res.locals.values, false);
});

test('successful login rotates and saves the session before redirecting', async (context) => {
  const originalScope = User.scope;
  const originalCompare = bcrypt.compare;
  const calls = [];
  context.after(() => {
    User.scope = originalScope;
    bcrypt.compare = originalCompare;
  });
  User.scope = (scope) => {
    assert.equal(scope, 'withPassword');
    return {
      findOne: async () => ({
        id: 42,
        email: 'person@example.com',
        passwordHash: 'stored-password-hash'
      })
    };
  };
  bcrypt.compare = async (password, passwordHash) => {
    assert.equal(password, 'valid-password-value');
    assert.equal(passwordHash, 'stored-password-hash');
    return true;
  };
  const req = {
    body: { email: 'person@example.com', password: 'valid-password-value' },
    session: {
      regenerate(callback) {
        calls.push('regenerate');
        callback();
      },
      save(callback) {
        calls.push('save');
        callback();
      }
    }
  };
  await runRules(loginValidation, req);
  const res = responseRecorder();

  await authController.postLogin(req, res, assert.fail);

  assert.deepEqual(calls, ['regenerate', 'save']);
  assert.deepEqual(req.session.user, { id: 42, email: 'person@example.com' });
  assert.equal('passwordHash' in req.session.user, false);
  assert.equal(res.redirectLocation, '/generator');
});

test('login forwards unexpected password comparison failures', async (context) => {
  const originalScope = User.scope;
  const originalCompare = bcrypt.compare;
  const failure = new Error('password comparison failed');
  let forwarded;
  context.after(() => {
    User.scope = originalScope;
    bcrypt.compare = originalCompare;
  });
  User.scope = () => ({
    findOne: async () => ({
      id: 7,
      email: 'person@example.com',
      passwordHash: 'stored-password-hash'
    })
  });
  bcrypt.compare = async () => {
    throw failure;
  };
  const req = {
    body: { email: 'person@example.com', password: 'valid-password-value' }
  };
  await runRules(loginValidation, req);

  await authController.postLogin(req, responseRecorder(), (error) => {
    forwarded = error;
  });

  assert.equal(forwarded, failure);
});

test('duplicate registration returns 409 without retaining password material', async (context) => {
  const originalFindOne = User.findOne;
  context.after(() => {
    User.findOne = originalFindOne;
  });
  User.findOne = async () => ({ id: 7 });
  const req = {
    body: { email: 'person@example.com', password: 'valid-password-value' }
  };
  await runRules(registerValidation, req);
  const res = responseRecorder();

  await authController.postRegister(req, res, assert.fail);

  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.locals.values, { email: 'person@example.com' });
  assert.equal('password' in res.locals.values, false);
});

test('a concurrent duplicate registration maps the database constraint to 409', async (context) => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;
  const originalHash = bcrypt.hash;
  context.after(() => {
    User.findOne = originalFindOne;
    User.create = originalCreate;
    bcrypt.hash = originalHash;
  });
  User.findOne = async () => null;
  User.create = async () => {
    const error = new Error('duplicate email');
    error.name = 'SequelizeUniqueConstraintError';
    throw error;
  };
  bcrypt.hash = async () => 'test-password-hash';
  const req = {
    body: { email: 'person@example.com', password: 'valid-password-value' }
  };
  await runRules(registerValidation, req);
  const res = responseRecorder();

  await authController.postRegister(req, res, assert.fail);

  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.locals.values, { email: 'person@example.com' });
});

test('authentication rotates the session and stores only the public user identity', async () => {
  const calls = [];
  const req = {
    session: {
      regenerate(callback) {
        calls.push('regenerate');
        callback();
      },
      save(callback) {
        calls.push('save');
        callback();
      }
    }
  };

  await authController.establishSession(req, {
    id: 42,
    email: 'person@example.com',
    passwordHash: 'must-not-enter-the-session'
  });

  assert.deepEqual(calls, ['regenerate', 'save']);
  assert.deepEqual(req.session.user, { id: 42, email: 'person@example.com' });
});

test('logout destroys the session, clears the injected cookie, and redirects', (_context, done) => {
  const controller = new authController.AuthController({ sessionCookieName: 'custom.sid' });
  const calls = [];
  const req = {
    session: {
      destroy(callback) {
        calls.push('destroy');
        callback();
      }
    }
  };
  const res = responseRecorder();

  controller.logout(req, res, done);

  assert.deepEqual(calls, ['destroy']);
  assert.deepEqual(res.clearedCookies, ['custom.sid']);
  assert.equal(res.redirectLocation, '/');
  done();
});

test('logout forwards session destruction failures without clearing the cookie', (context, done) => {
  const failure = new Error('session store unavailable');
  const req = {
    session: {
      destroy(callback) {
        callback(failure);
      }
    }
  };
  const res = responseRecorder();

  authController.logout(req, res, (error) => {
    assert.equal(error, failure);
    assert.deepEqual(res.clearedCookies, []);
    assert.equal(res.redirectLocation, undefined);
    done();
  });
});
