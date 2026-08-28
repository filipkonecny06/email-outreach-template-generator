/** Defines user credentials while excluding password hashes from ordinary queries. */
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define(
    'User',
    {
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true }
      },
      passwordHash: {
        type: DataTypes.STRING,
        allowNull: false
      }
    },
    {
      tableName: 'Users',
      // Authentication must opt in to sensitive credential data through withPassword.
      defaultScope: {
        attributes: { exclude: ['passwordHash'] }
      },
      scopes: {
        withPassword: {
          attributes: ['id', 'email', 'passwordHash', 'createdAt', 'updatedAt']
        }
      }
    }
  );

  return User;
};
