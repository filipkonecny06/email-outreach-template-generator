const test = require('node:test');
const assert = require('node:assert/strict');

const { attachUser, requireApiAuth, requireAuth } = require('../src/middleware/auth');

test('requireAuth redirects anonymous requests and advances authenticated requests', () => {
  let redirectedTo;
  let nextCalls = 0;

  requireAuth(
    { session: {} },
    {
      redirect(location) {
        redirectedTo = location;
      }
    },
    () => {
      nextCalls += 1;
    }
  );
  requireAuth({ session: { user: { id: 7 } } }, {}, () => {
    nextCalls += 1;
  });

  assert.equal(redirectedTo, '/auth/login');
  assert.equal(nextCalls, 1);
});

test('requireApiAuth returns a typed 401 error only for anonymous requests', () => {
  const nextArguments = [];
  const next = (error) => nextArguments.push(error);

  requireApiAuth({ session: {} }, {}, next);
  requireApiAuth({ session: { user: { id: 7 } } }, {}, next);

  assert.equal(nextArguments.length, 2);
  assert.equal(nextArguments[0].message, 'Authentication required.');
  assert.equal(nextArguments[0].status, 401);
  assert.equal(nextArguments[0].code, 'AUTHENTICATION_REQUIRED');
  assert.equal(nextArguments[1], undefined);
});

test('attachUser exposes either the session user or null', () => {
  const user = { id: 7, email: 'person@example.com' };
  const authenticatedResponse = { locals: {} };
  const anonymousResponse = { locals: {} };
  let nextCalls = 0;

  attachUser({ session: { user } }, authenticatedResponse, () => {
    nextCalls += 1;
  });
  attachUser({ session: {} }, anonymousResponse, () => {
    nextCalls += 1;
  });

  assert.equal(authenticatedResponse.locals.currentUser, user);
  assert.equal(anonymousResponse.locals.currentUser, null);
  assert.equal(nextCalls, 2);
});
