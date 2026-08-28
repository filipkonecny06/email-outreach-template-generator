'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('GenerationHistories', {
      deletedAt: { [Sequelize.Op.ne]: null }
    });
    await queryInterface.removeColumn('GenerationHistories', 'deletedAt');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('GenerationHistories', 'deletedAt', {
      type: Sequelize.DATE,
      allowNull: true
    });
  }
};
