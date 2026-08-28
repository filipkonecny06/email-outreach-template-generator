/** Composes server-rendered page controllers and their catalog-backed dependencies. */
const { Template, Favorite } = require('../models');
const { TemplateCatalogRepository } = require('../repositories/templateCatalogRepository');
const { TemplateRepository } = require('../repositories/templateRepository');
const { TemplateCatalogService } = require('../services/templateCatalogService');
const { TemplateBrowserController } = require('./templateBrowserController');

// Fail startup if the version-controlled catalog violates its schema or business rules.
const catalog = new TemplateCatalogService({
  repository: new TemplateCatalogRepository()
}).loadAndValidate();
// The catalog is authoritative for filter choices, while database rows supply runtime IDs.
const categories = [...new Set(catalog.templates.map((template) => template.category))];
const catalogStats = Object.freeze({
  templateCount: catalog.templates.length,
  categoryCount: categories.length
});
const templateRepository = new TemplateRepository({ Template, Favorite });
const templateBrowserController = new TemplateBrowserController({
  templateRepository,
  categories
});

/** Renders the public catalog summary without querying user-specific data. */
exports.landingPage = (_req, res) => {
  return res.render('landing', {
    pageTitle: 'Outreach Email Template Generator',
    catalogStats
  });
};

exports.generatorPage = templateBrowserController.generatorPage;
exports.templatesPage = templateBrowserController.templatesPage;
exports.templateDetailPage = templateBrowserController.templateDetailPage;

exports.catalogStats = catalogStats;
exports.categories = categories;
