const { Op } = require('sequelize');
const { validationResult, matchedData } = require('express-validator');
const { Template, Favorite, GenerationHistory } = require('../models');
const { renderFromTemplate } = require('../services/templateService');

function validationFailure(res, errors) {
  return res.status(422).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Review the highlighted fields and try again.',
      details: errors.array().map((error) => ({ field: error.path, message: error.msg }))
    }
  });
}

function stringQuery(value, maxLength = 120) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

exports.preview = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationFailure(res, errors);
    }

    const data = matchedData(req, { locations: ['body'] });
    const templateId = Number(data.templateId);
    const includeFollowUps = Boolean(data.includeFollowUps);

    const rendered = await renderFromTemplate(templateId, data, includeFollowUps);

    return res.json({
      subject: rendered.subject,
      body: rendered.body,
      followUps: rendered.followUps || []
    });
  } catch (error) {
    return next(error);
  }
};

exports.toggleFavorite = async (req, res, next) => {
  try {
    const templateId = Number(req.params.templateId);
    const template = Number.isInteger(templateId) ? await Template.findByPk(templateId) : null;
    if (!template) return res.status(404).json({ message: 'Template not found.' });

    const where = { UserId: req.session.user.id, TemplateId: templateId };
    const [favorite, created] = await Favorite.findOrCreate({ where, defaults: where });

    if (!created) {
      await favorite.destroy();
      return res.json({ favorited: false });
    }

    await Favorite.create(where);
    return res.json({ favorited: true });
  } catch (error) {
    return next(error);
  }
};

exports.saveHistory = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationFailure(res, errors);
    }

    const payload = matchedData(req, { locations: ['body'] });
    const templateId = Number(payload.templateId);

    const template = await Template.findByPk(templateId);
    if (!template) return res.status(404).json({ message: 'Template not found.' });

    const rendered = await renderFromTemplate(
      templateId,
      payload,
      Boolean(payload.includeFollowUps)
    );

    const entry = await GenerationHistory.create({
      UserId: req.session.user.id,
      TemplateId: template.id,
      subject: rendered.subject,
      body: rendered.body,
      payload,
      deletedAt: null
    });

    return res.status(201).json({ id: entry.id, message: 'Saved to history.' });
  } catch (error) {
    return next(error);
  }
};

exports.getTemplates = async (req, res, next) => {
  try {
    const search = stringQuery(req.query.search);
    const category = stringQuery(req.query.category, 80);
    const onlyFavorites = req.query.favorites === 'true';

    const where = {};
    if (category) where.category = category;
    if (search) where.name = { [Op.like]: `%${search}%` };

    const include = [];
    if (req.session.user) {
      include.push({
        model: Favorite,
        required: onlyFavorites,
        where: { UserId: req.session.user.id },
        attributes: ['TemplateId']
      });
    }

    const templates = await Template.findAll({
      where,
      include,
      order: [
        ['category', 'ASC'],
        ['name', 'ASC']
      ]
    });

    return res.json(
      templates.map((template) => ({
        id: template.id,
        name: template.name,
        category: template.category,
        requiredFields: template.requiredFields,
        ...(req.session.user ? { isFavorite: (template.Favorites || []).length > 0 } : {})
      }))
    );
  } catch (error) {
    return next(error);
  }
};

exports.validationFailure = validationFailure;
