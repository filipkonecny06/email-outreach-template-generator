'use strict';

/** Creates persistent express-session storage managed by express-mysql-session. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sessions', {
      session_id: { type: Sequelize.STRING(128), primaryKey: true, allowNull: false },
      expires: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      data: { type: Sequelize.TEXT('long'), allowNull: true }
    });
    // Expiration cleanup scans this column regularly and must not require a full table scan.
    await queryInterface.addIndex('sessions', ['expires']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sessions');
  }
};
