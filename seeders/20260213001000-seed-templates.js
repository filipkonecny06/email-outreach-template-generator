'use strict';

const { Op } = require('sequelize');
const { TemplateCatalogRepository } = require('../src/repositories/templateCatalogRepository');
const { TemplateCatalogService } = require('../src/services/templateCatalogService');

function createCatalogService() {
  return new TemplateCatalogService({ repository: new TemplateCatalogRepository() });
}

module.exports = {
  async up(queryInterface) {
    const service = createCatalogService();
    const now = new Date();
    const templates = service.loadAndValidate().templates.map((template) => {
      const record = service.toDatabaseRecord(template, { createdAt: now, updatedAt: now });
      return {
        ...record,
        requiredFields: JSON.stringify(record.requiredFields),
        contentConfig: JSON.stringify(record.contentConfig)
      };
    });

    await queryInterface.bulkInsert('Templates', templates, {
      updateOnDuplicate: [
        'name',
        'category',
        'summary',
        'subjectTemplate',
        'bodyTemplate',
        'requiredFields',
        'contentConfig',
        'followUp1SubjectTemplate',
        'followUp1BodyTemplate',
        'followUp2SubjectTemplate',
        'followUp2BodyTemplate',
        'updatedAt'
      ]
    });
  },

  async down(queryInterface) {
    const keys = createCatalogService()
      .loadAndValidate()
      .templates.map((template) => template.key);
    await queryInterface.bulkDelete('Templates', { catalogKey: { [Op.in]: keys } });
  }
};
