'use strict';

/** Removes unused soft-delete state so history deletion has one unambiguous behavior. */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Purge previously soft-deleted rows before dropping the only marker that identifies them.
    await queryInterface.bulkDelete('GenerationHistories', {
      deletedAt: { [Sequelize.Op.ne]: null }
    });
    await queryInterface.removeColumn('GenerationHistories', 'deletedAt');
  },

  async down(queryInterface, Sequelize) {
    // Rollback restores schema compatibility but cannot reconstruct purged row contents.
    await queryInterface.addColumn('GenerationHistories', 'deletedAt', {
      type: Sequelize.DATE,
      allowNull: true
    });
  }
};
