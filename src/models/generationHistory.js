const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const GenerationHistory = sequelize.define(
    'GenerationHistory',
    {
      UserId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      TemplateId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      subject: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      payload: {
        type: DataTypes.JSON,
        allowNull: false
      }
    },
    {
      tableName: 'GenerationHistories'
    }
  );

  return GenerationHistory;
};
