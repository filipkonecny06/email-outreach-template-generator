/**
 * Adapts JSON API requests to template-generation and persistence operations.
 */
const { validationResult, matchedData } = require('express-validator');
const { Template, Favorite, GenerationHistory } = require('../models');
const templateService = require('../services/templateService');
const { NotFoundError } = require('../utils/errors');

/** Sends the API's stable field-validation envelope with the current request ID. */
function validationFailure(req, res, errors) {
  return res.status(422).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Review the highlighted fields and try again.',
      details: errors.array().map((error) => ({ field: error.path, message: error.msg })),
      requestId: req.id
    }
  });
}

/** Normalizes an optional query-string value to a bounded, trimmed string. */
function stringQuery(value, maxLength = 120) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

class ApiController {
  /**
   * @param {object} dependencies - Models and generation service required by API operations.
   */
  constructor({
    TemplateModel,
    FavoriteModel,
    GenerationHistoryModel,
    generationService = templateService
  }) {
    this.Template = TemplateModel;
    this.Favorite = FavoriteModel;
    this.GenerationHistory = GenerationHistoryModel;
    this.generationService = generationService;
    this.preview = this.preview.bind(this);
    this.toggleFavorite = this.toggleFavorite.bind(this);
    this.saveHistory = this.saveHistory.bind(this);
    this.getTemplates = this.getTemplates.bind(this);
  }

  /** Validates browser input and returns generated plain-text fields as JSON. */
  async preview(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return validationFailure(req, res, errors);

      // matchedData is an allowlist: unexpected body properties never enter domain rendering.
      const data = matchedData(req, { locations: ['body'] });
      const rendered = await this.generationService.renderFromTemplate(
        Number(data.templateId),
        data,
        Boolean(data.includeFollowUps)
      );

      return res.json({
        subject: rendered.subject,
        body: rendered.body,
        followUps: rendered.followUps || []
      });
    } catch (error) {
      return next(error);
    }
  }

  /** Creates or removes the current user's favorite relationship for one template. */
  async toggleFavorite(req, res, next) {
    try {
      const templateId = Number(req.params.templateId);
      const template = Number.isInteger(templateId)
        ? await this.Template.findByPk(templateId)
        : null;
      if (!template) throw new NotFoundError('Template');

      const where = { UserId: req.session.user.id, TemplateId: templateId };
      // The unique index prevents duplicate rows for the same user-template relationship.
      const [favorite, created] = await this.Favorite.findOrCreate({ where, defaults: where });

      if (!created) {
        await favorite.destroy();
        return res.json({ favorited: false });
      }

      return res.json({ favorited: true });
    } catch (error) {
      return next(error);
    }
  }

  /** Re-renders validated inputs and stores the server-derived result in user history. */
  async saveHistory(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return validationFailure(req, res, errors);

      const payload = matchedData(req, { locations: ['body'] });
      // Render again so saved output comes from validated inputs, not client-submitted output text.
      const rendered = await this.generationService.renderFromTemplate(
        Number(payload.templateId),
        payload,
        Boolean(payload.includeFollowUps)
      );

      const entry = await this.GenerationHistory.create({
        UserId: req.session.user.id,
        TemplateId: rendered.template.id,
        subject: rendered.subject,
        body: rendered.body,
        payload
      });

      return res.status(201).json({ id: entry.id, message: 'Saved to history.' });
    } catch (error) {
      return next(error);
    }
  }

  /** Returns public template metadata for normalized browser filters. */
  async getTemplates(req, res, next) {
    try {
      const search = stringQuery(req.query.search);
      const category = stringQuery(req.query.category, 80);
      const userId = req.session.user?.id;
      const onlyFavorites = Boolean(userId && req.query.favorites === 'true');
      const templates = await this.generationService.getTemplates({
        search,
        category,
        userId,
        onlyFavorites
      });

      // Return a deliberately small DTO rather than leaking Sequelize records to the browser.
      return res.json(
        templates.map((template) => ({
          id: template.id,
          name: template.name,
          category: template.category,
          requiredFields: template.requiredFields,
          followUpRequiredFields: template.followUpRequiredFields,
          ...(userId ? { isFavorite: template.isFavorite } : {})
        }))
      );
    } catch (error) {
      return next(error);
    }
  }
}

const apiController = new ApiController({
  TemplateModel: Template,
  FavoriteModel: Favorite,
  GenerationHistoryModel: GenerationHistory
});

module.exports = {
  ApiController,
  getTemplates: apiController.getTemplates,
  preview: apiController.preview,
  saveHistory: apiController.saveHistory,
  stringQuery,
  toggleFavorite: apiController.toggleFavorite,
  validationFailure
};
