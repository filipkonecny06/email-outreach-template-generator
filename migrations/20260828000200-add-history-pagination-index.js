'use strict';

/** Adds the composite index that matches authenticated history pagination and sort order. */
const INDEX_NAME = 'generation_history_user_created_id';
const ROLLBACK_USER_INDEX_NAME = 'generation_history_user_id_rollback';

/** Normalizes index metadata returned by different Sequelize/MySQL versions. */
function indexColumns(index) {
  return (index.fields || []).map((field) =>
    typeof field === 'string' ? field : field.attribute || field.name
  );
}

/** Finds an alternate leading UserId index that can continue supporting the foreign key. */
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
    // MySQL requires an index for the foreign key after the composite index is removed.
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
