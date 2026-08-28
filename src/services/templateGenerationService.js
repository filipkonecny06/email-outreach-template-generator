/** Implements template selection, required-field policy, and campaign rendering. */
const { Template, Favorite } = require('../models');
const { TemplateRepository } = require('../repositories/templateRepository');
const { TemplateFieldService, fieldList } = require('./templateFieldService');
const { OutreachTemplateRenderer } = require('./outreachTemplateRenderer');
const { NotFoundError, ValidationError } = require('../utils/errors');

const normalizeRequiredFields = fieldList;

/** Returns declared fields whose submitted values are absent or blank. */
function missingFields(requiredFields, payload) {
  return normalizeRequiredFields(requiredFields).filter((field) => {
    const value = payload[field];
    return value === undefined || value === null || String(value).trim() === '';
  });
}

class TemplateGenerationService {
  /**
   * @param {object} [dependencies] - Query, rendering, and field-policy collaborators.
   */
  constructor({
    templateRepository = new TemplateRepository({ Template, Favorite }),
    renderer = new OutreachTemplateRenderer(),
    fieldService = new TemplateFieldService({ renderer })
  } = {}) {
    this.templateRepository = templateRepository;
    this.renderer = renderer;
    this.fieldService = fieldService;
  }

  /** Returns decorated template DTOs with an optional per-user favorite flag. */
  async getTemplates(filters) {
    const templates = await this.templateRepository.list(filters);
    return templates.map((template) => ({
      ...this.fieldService.decorate(template),
      isFavorite: filters.userId ? (template.Favorites || []).length > 0 : false
    }));
  }

  /**
   * Loads and renders one template after enforcing its context-sensitive required fields.
   *
   * @throws {NotFoundError} When the selected template no longer exists.
   * @throws {ValidationError} When a value required by the selected output is missing.
   */
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
