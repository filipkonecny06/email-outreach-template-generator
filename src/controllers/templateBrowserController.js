const { TemplateFieldService } = require('../services/templateFieldService');

class TemplateBrowserController {
  constructor({ templateRepository, categories, fieldService = new TemplateFieldService() }) {
    this.templateRepository = templateRepository;
    this.categories = categories;
    this.fieldService = fieldService;
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
      const selectedTemplate = templates.find((template) => template.id === templateId) || null;
      const favoriteIds = await this.templateRepository.listFavoriteIds(req.session.user.id);

      return res.render('generator', {
        pageTitle: 'Generate Outreach Email',
        templates,
        categories: this.categories,
        selectedTemplate,
        favoriteIds
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
