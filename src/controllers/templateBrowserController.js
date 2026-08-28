class TemplateBrowserController {
  constructor({ templateRepository, categories }) {
    this.templateRepository = templateRepository;
    this.categories = categories;
    this.generatorPage = this.generatorPage.bind(this);
    this.templatesPage = this.templatesPage.bind(this);
    this.templateDetailPage = this.templateDetailPage.bind(this);
  }

  async generatorPage(req, res, next) {
    try {
      const templateId = Number(req.query.templateId || 0);
      const templates = await this.templateRepository.list();
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
      const templates = await this.templateRepository.list({ search, category });

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
      const template = await this.templateRepository.findById(Number(req.params.id));
      if (!template) return res.status(404).render('404', { pageTitle: 'Not Found' });
      return res.render('template-detail', { pageTitle: template.name, template });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = { TemplateBrowserController };
