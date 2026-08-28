'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Templates', 'catalogKey', {
      type: Sequelize.STRING(80),
      allowNull: true,
      unique: true
    });
    await queryInterface.addColumn('Templates', 'summary', {
      type: Sequelize.STRING(240),
      allowNull: true
    });
    await queryInterface.addColumn('Templates', 'contentConfig', {
      type: Sequelize.JSON,
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Templates', 'contentConfig');
    await queryInterface.removeColumn('Templates', 'summary');
    await queryInterface.removeColumn('Templates', 'catalogKey');
  }
};
