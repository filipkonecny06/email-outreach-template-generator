/** Coordinates authenticated history filtering, pagination, rendering, and deletion. */
const { GenerationHistory, Template } = require('../models');
const { HistoryService, requestedPageNumber } = require('../services/historyService');

/** Builds pagination links while retaining the active search and sort choices. */
function historyPageUrl({ page, search, order }) {
  const query = new URLSearchParams({ page: String(page), order });
  if (search) query.set('search', search);
  return `/history?${query.toString()}`;
}

class HistoryController {
  /** @param {object} dependencies - Persistence models or a fully composed history service. */
  constructor({ GenerationHistoryModel, TemplateModel, historyService }) {
    this.historyService =
      historyService || new HistoryService({ GenerationHistoryModel, TemplateModel });
    this.historyPage = this.historyPage.bind(this);
    this.deleteHistoryEntry = this.deleteHistoryEntry.bind(this);
  }

  /** Renders a bounded history page for the authenticated user and active filters. */
  async historyPage(req, res, next) {
    try {
      const search = String(req.query.search || '')
        .trim()
        .slice(0, 120);
      const order = req.query.order === 'oldest' ? 'ASC' : 'DESC';
      const orderQuery = order === 'ASC' ? 'oldest' : 'newest';
      const requestedPage = requestedPageNumber(req.query.page);
      const { entries, total, page, totalPages } = await this.historyService.listForUser({
        userId: req.session.user.id,
        search,
        requestedPage,
        order
      });

      return res.render('history', {
        pageTitle: 'Generation History',
        entries,
        search,
        order: order.toLowerCase(),
        pagination: {
          page,
          total,
          previousUrl:
            page > 1 ? historyPageUrl({ page: page - 1, search, order: orderQuery }) : null,
          nextUrl:
            page < totalPages ? historyPageUrl({ page: page + 1, search, order: orderQuery }) : null
        }
      });
    } catch (error) {
      return next(error);
    }
  }

  /** Deletes a history entry only when it belongs to the authenticated user. */
  async deleteHistoryEntry(req, res, next) {
    try {
      const entryId = Number(req.params.id);
      if (!Number.isInteger(entryId) || entryId < 1) {
        return res.status(404).render('404', { pageTitle: 'Not Found' });
      }
      const deleted = await this.historyService.deleteOwned({
        entryId,
        userId: req.session.user.id
      });
      if (!deleted) return res.status(404).render('404', { pageTitle: 'Not Found' });
      return res.redirect('/history');
    } catch (error) {
      return next(error);
    }
  }
}

const historyController = new HistoryController({
  GenerationHistoryModel: GenerationHistory,
  TemplateModel: Template
});

module.exports = {
  HistoryController,
  deleteHistoryEntry: historyController.deleteHistoryEntry,
  historyPageUrl,
  historyPage: historyController.historyPage
};
