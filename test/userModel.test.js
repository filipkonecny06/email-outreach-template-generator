const test = require('node:test');
const assert = require('node:assert/strict');

const UserFactory = require('../src/models/user');

test('ordinary user queries exclude password hashes and login opts into them explicitly', () => {
  let options;
  const sequelize = {
    define(_name, _attributes, modelOptions) {
      options = modelOptions;
      return {};
    }
  };

  UserFactory(sequelize);

  assert.deepEqual(options.defaultScope.attributes.exclude, ['passwordHash']);
  assert.deepEqual(options.scopes.withPassword.attributes, [
    'id',
    'email',
    'passwordHash',
    'createdAt',
    'updatedAt'
  ]);
});
