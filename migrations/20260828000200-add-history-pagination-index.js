'use strict';

const INDEX_NAME = 'generation_history_user_created_id';

module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex('GenerationHistories', ['UserId', 'createdAt', 'id'], {
      name: INDEX_NAME
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('GenerationHistories', INDEX_NAME);
  }
};
