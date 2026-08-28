/** Prepares template records for the generator, browser, and detail page views. */
const { LENGTH_OPTIONS, OUTREACH_FIELDS, TONE_OPTIONS } = require('../contracts/outreach');
const { TemplateFieldService } = require('../services/templateFieldService');

class TemplateBrowserController {
  /** @param {object} dependencies - Template query adapter, catalog categories, and field policy. */
  constructor({
    templateRepository,
    categories,
    fieldService = new TemplateFieldService(),
    generatorContract = {
      outreachFields: OUTREACH_FIELDS,
      toneOptions: TONE_OPTIONS,
      lengthOptions: LENGTH_OPTIONS
    }
  }) {
    this.templateRepository = templateRepository;
    this.categories = categories;
    this.fieldService = fieldService;
    this.generatorContract = generatorContract;
    this.generatorPage = this.generatorPage.bind(this);
    this.templatesPage = this.templatesPage.bind(this);
    this.templateDetailPage = this.templateDetailPage.bind(this);
  }

  async generatorPage(req, res, next) {
    try {
      const templateId = Number(req.query.templateId || 0);
      const templates = (await this.templateRepository.list()).map((template) =>
        this.fieldService.decorate(template)
      );
      // Selection is limited to the loaded collection; arbitrary query IDs are never trusted.
      const selectedTemplate = templates.find((template) => template.id === templateId) || null;
      const favoriteIds = await this.templateRepository.listFavoriteIds(req.session.user.id);

      return res.render('generator', {
        pageTitle: 'Generate Outreach Email',
        templates,
        categories: this.categories,
        selectedTemplate,
        favoriteIds,
        ...this.generatorContract
      });
    } catch (error) {
      return next(error);
    }
  }

  async templatesPage(req, res, next) {
    try {
      const search = String(req.query.search || '')
        .trim()
        .slice(0, 120);
      const category = String(req.query.category || '').trim();
      const templates = (await this.templateRepository.list({ search, category })).map((template) =>
        this.fieldService.decorate(template)
      );

      return res.render('templates', {
        pageTitle: 'Template Browser',
        templates,
        categories: this.categories,
        selectedCategory: category,
        search
      });
    } catch (error) {
      return next(error);
    }
  }

  async templateDetailPage(req, res, next) {
    try {
      const templateId = Number(req.params.id);
      if (!Number.isInteger(templateId) || templateId < 1) {
        return res.status(404).render('404', { pageTitle: 'Not Found' });
      }
      const template = await this.templateRepository.findById(templateId);
      if (!template) return res.status(404).render('404', { pageTitle: 'Not Found' });
      const viewTemplate = this.fieldService.decorate(template);
      return res.render('template-detail', {
        pageTitle: viewTemplate.name,
        template: viewTemplate
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = { TemplateBrowserController };
