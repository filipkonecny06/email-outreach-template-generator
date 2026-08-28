'use strict';

/** Creates the original relational schema in foreign-key dependency order. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Users', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      passwordHash: { type: Sequelize.STRING, allowNull: false },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE }
    });

    await queryInterface.createTable('Templates', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      name: { type: Sequelize.STRING, allowNull: false },
      category: { type: Sequelize.STRING, allowNull: false },
      subjectTemplate: { type: Sequelize.TEXT, allowNull: false },
      bodyTemplate: { type: Sequelize.TEXT, allowNull: false },
      requiredFields: { type: Sequelize.JSON, allowNull: false },
      followUp1SubjectTemplate: { type: Sequelize.TEXT, allowNull: true },
      followUp1BodyTemplate: { type: Sequelize.TEXT, allowNull: true },
      followUp2SubjectTemplate: { type: Sequelize.TEXT, allowNull: true },
      followUp2BodyTemplate: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE }
    });

    await queryInterface.createTable('Favorites', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      UserId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE'
      },
      TemplateId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Templates', key: 'id' },
        onDelete: 'CASCADE'
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE }
    });

    // A database constraint, not only application logic, prevents duplicate favorites.
    await queryInterface.addConstraint('Favorites', {
      fields: ['UserId', 'TemplateId'],
      type: 'unique',
      name: 'favorites_user_template_unique'
    });

    await queryInterface.createTable('GenerationHistories', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      UserId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE'
      },
      TemplateId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Templates', key: 'id' },
        // Saved copy remains readable when a catalog template is removed.
        onDelete: 'SET NULL'
      },
      subject: { type: Sequelize.TEXT, allowNull: false },
      body: { type: Sequelize.TEXT, allowNull: false },
      payload: { type: Sequelize.JSON, allowNull: false },
      deletedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE }
    });
  },

  async down(queryInterface) {
    // Reverse dependency order keeps foreign-key teardown valid.
    await queryInterface.dropTable('GenerationHistories');
    await queryInterface.dropTable('Favorites');
    await queryInterface.dropTable('Templates');
    await queryInterface.dropTable('Users');
  }
};
