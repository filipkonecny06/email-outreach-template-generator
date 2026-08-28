/** Defines stored snapshots of generated subjects, bodies, and source payloads. */
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
        // Historical copy remains useful if its source template is later removed.
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
        // Keeping normalized inputs beside the rendered output supports later auditing.
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
