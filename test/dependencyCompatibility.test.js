const test = require('node:test');
const assert = require('node:assert/strict');

const { DataTypes, Utils } = require('sequelize');

test('the resolved UUID package remains compatible with Sequelize UUIDV4 defaults', () => {
  const generated = Utils.toDefaultValue(DataTypes.UUIDV4());

  assert.match(generated, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(DataTypes.UUID.prototype.validate(generated), true);
});
