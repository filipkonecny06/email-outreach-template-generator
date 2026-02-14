const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Template = sequelize.define(
    'Template',
    {
      name: { type: DataTypes.STRING, allowNull: false },
      category: { type: DataTypes.STRING, allowNull: false },
      subjectTemplate: { type: DataTypes.TEXT, allowNull: false },
      bodyTemplate: { type: DataTypes.TEXT, allowNull: false },
      requiredFields: { type: DataTypes.JSON, allowNull: false },
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
