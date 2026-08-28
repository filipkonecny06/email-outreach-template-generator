/** Defines the unique user-to-template favorite relationship. */
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Favorite = sequelize.define(
    'Favorite',
    {
      UserId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      TemplateId: {
        type: DataTypes.INTEGER,
        allowNull: false
      }
    },
    {
      tableName: 'Favorites',
      // Database uniqueness prevents duplicate rows for one user-template pair.
      indexes: [{ unique: true, fields: ['UserId', 'TemplateId'] }]
    }
  );

  return Favorite;
};
