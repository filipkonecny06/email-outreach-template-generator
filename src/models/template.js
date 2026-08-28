/** Defines persisted template rows, whether catalog-managed or created manually. */
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Template = sequelize.define(
    'Template',
    {
      catalogKey: { type: DataTypes.STRING(80), allowNull: true, unique: true },
      name: { type: DataTypes.STRING, allowNull: false },
      category: { type: DataTypes.STRING, allowNull: false },
      summary: { type: DataTypes.STRING(240), allowNull: true },
      subjectTemplate: { type: DataTypes.TEXT, allowNull: false },
      bodyTemplate: { type: DataTypes.TEXT, allowNull: false },
      requiredFields: { type: DataTypes.JSON, allowNull: false },
      contentConfig: { type: DataTypes.JSON, allowNull: true },
      followUp1SubjectTemplate: { type: DataTypes.TEXT, allowNull: true },
      followUp1BodyTemplate: { type: DataTypes.TEXT, allowNull: true },
      followUp2SubjectTemplate: { type: DataTypes.TEXT, allowNull: true },
      followUp2BodyTemplate: { type: DataTypes.TEXT, allowNull: true }
    },
    {
      tableName: 'Templates'
    }
  );

  return Template;
};
