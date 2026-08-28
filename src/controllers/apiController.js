const { validationResult, matchedData } = require('express-validator');
const { Template, Favorite, GenerationHistory } = require('../models');
const templateService = require('../services/templateService');
const { NotFoundError } = require('../utils/errors');

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

function stringQuery(value, maxLength = 120) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

class ApiController {
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

  async preview(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return validationFailure(req, res, errors);

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

  async toggleFavorite(req, res, next) {
    try {
      const templateId = Number(req.params.templateId);
      const template = Number.isInteger(templateId)
        ? await this.Template.findByPk(templateId)
        : null;
      if (!template) throw new NotFoundError('Template');

      const where = { UserId: req.session.user.id, TemplateId: templateId };
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

  async saveHistory(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return validationFailure(req, res, errors);

      const payload = matchedData(req, { locations: ['body'] });
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
