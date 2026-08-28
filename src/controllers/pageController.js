const { Op } = require('sequelize');
const { Template, Favorite } = require('../models');

const categories = [
  'Guest Post',
  'Broken Link',
  'Link Reclamation',
  'Skyscraper',
  'Podcast Pitch',
  'Partnership',
  'Influencer Collab',
  'PR Mention'
];

exports.landingPage = async (req, res) => {
  res.render('landing', {
    pageTitle: 'Outreach Email Template Generator',
    categories
  });
};

exports.generatorPage = async (req, res, next) => {
  try {
    const templateId = Number(req.query.templateId || 0);
    const templates = await Template.findAll({ order: [['createdAt', 'DESC']] });
    let selectedTemplate = null;

    if (templateId) {
      selectedTemplate = templates.find((t) => t.id === templateId) || null;
    }

    const favorites = await Favorite.findAll({
      where: { UserId: req.session.user.id },
      attributes: ['TemplateId']
    });

    res.render('generator', {
      pageTitle: 'Generate Outreach Email',
      templates,
      categories,
      selectedTemplate,
      favoriteIds: favorites.map((f) => f.TemplateId)
    });
  } catch (error) {
    next(error);
  }
};

exports.templatesPage = async (req, res, next) => {
  try {
    const search = (req.query.search || '').trim();
    const category = (req.query.category || '').trim();

    const where = {};
    if (search) where.name = { [Op.like]: `%${search}%` };
    if (category) where.category = category;

    const templates = await Template.findAll({
      where,
      order: [
        ['category', 'ASC'],
        ['name', 'ASC']
      ]
    });

    res.render('templates', {
      pageTitle: 'Template Browser',
      templates,
      categories,
      selectedCategory: category,
      search
    });
  } catch (error) {
    next(error);
  }
};

exports.templateDetailPage = async (req, res, next) => {
  try {
    const template = await Template.findByPk(Number(req.params.id));
    if (!template) return res.status(404).render('404', { pageTitle: 'Not Found' });

    res.render('template-detail', {
      pageTitle: template.name,
      template
    });
  } catch (error) {
    next(error);
  }
};
