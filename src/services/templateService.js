const { Template, Favorite } = require('../models');
const { TemplateRepository } = require('../repositories/templateRepository');
const { TemplateFieldService, fieldList } = require('./templateFieldService');
const { OutreachTemplateRenderer } = require('./templateRenderer');
const { NotFoundError, ValidationError } = require('../utils/errors');

const normalizeRequiredFields = fieldList;

function missingFields(requiredFields, payload) {
  return normalizeRequiredFields(requiredFields).filter((field) => {
    const value = payload[field];
    return value === undefined || value === null || String(value).trim() === '';
  });
}

class TemplateGenerationService {
  constructor({
    templateRepository = new TemplateRepository({ Template, Favorite }),
    renderer = new OutreachTemplateRenderer(),
    fieldService = new TemplateFieldService({ renderer })
  } = {}) {
    this.templateRepository = templateRepository;
    this.renderer = renderer;
    this.fieldService = fieldService;
  }

  async getTemplates(filters) {
    const templates = await this.templateRepository.list(filters);
    return templates.map((template) => ({
      ...this.fieldService.decorate(template),
      isFavorite: filters.userId ? (template.Favorites || []).length > 0 : false
    }));
  }

  async renderFromTemplate(templateId, payload, includeFollowUps = false) {
    const template = await this.templateRepository.findById(templateId);
    if (!template) throw new NotFoundError('Template');

    const requiredFields = this.fieldService.fieldsFor(template, { includeFollowUps });
    const missing = missingFields(requiredFields, payload);
    if (missing.length > 0) {
      throw new ValidationError(
        'Complete the fields required by this template.',
        missing.map((field) => ({
          field,
          message: 'This field is required by the selected template.'
        }))
      );
    }

    return {
      template,
      ...this.renderer.renderCampaign(template, payload, { includeFollowUps })
    };
  }
}

const defaultService = new TemplateGenerationService();

module.exports = {
  TemplateGenerationService,
  missingFields,
  normalizeRequiredFields,
  getTemplates: (filters) => defaultService.getTemplates(filters),
  renderFromTemplate: (templateId, payload, includeFollowUps) =>
    defaultService.renderFromTemplate(templateId, payload, includeFollowUps)
};
