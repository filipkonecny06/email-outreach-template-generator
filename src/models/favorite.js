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
      indexes: [{ unique: true, fields: ['UserId', 'TemplateId'] }]
    }
  );

  return Favorite;
};
