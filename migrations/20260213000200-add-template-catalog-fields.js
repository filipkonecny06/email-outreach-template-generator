'use strict';

/** Adds stable catalog identity and structured content without invalidating existing rows. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Templates', 'catalogKey', {
      type: Sequelize.STRING(80),
      // Nullable allows legacy/manual templates to remain outside catalog ownership.
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
    // Remove in reverse creation order to keep rollback intent easy to audit.
    await queryInterface.removeColumn('Templates', 'contentConfig');
    await queryInterface.removeColumn('Templates', 'summary');
    await queryInterface.removeColumn('Templates', 'catalogKey');
  }
};
