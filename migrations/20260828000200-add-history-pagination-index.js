'use strict';

const INDEX_NAME = 'generation_history_user_created_id';
const ROLLBACK_USER_INDEX_NAME = 'generation_history_user_id_rollback';

function indexColumns(index) {
  return (index.fields || []).map((field) =>
    typeof field === 'string' ? field : field.attribute || field.name
  );
}

function supportsUserForeignKey(index) {
  return index.name !== INDEX_NAME && indexColumns(index)[0] === 'UserId';
}

module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex('GenerationHistories', ['UserId', 'createdAt', 'id'], {
      name: INDEX_NAME
    });

    const indexes = await queryInterface.showIndex('GenerationHistories');
    if (indexes.some((index) => index.name === ROLLBACK_USER_INDEX_NAME)) {
      await queryInterface.removeIndex('GenerationHistories', ROLLBACK_USER_INDEX_NAME);
    }
  },

  async down(queryInterface) {
    const indexes = await queryInterface.showIndex('GenerationHistories');
    if (!indexes.some(supportsUserForeignKey)) {
      await queryInterface.addIndex('GenerationHistories', ['UserId'], {
        name: ROLLBACK_USER_INDEX_NAME
      });
    }
    await queryInterface.removeIndex('GenerationHistories', INDEX_NAME);
  },

  INDEX_NAME,
  ROLLBACK_USER_INDEX_NAME,
  indexColumns,
  supportsUserForeignKey
};
