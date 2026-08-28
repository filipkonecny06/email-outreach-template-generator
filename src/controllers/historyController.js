/** Coordinates authenticated history filtering, pagination, rendering, and deletion. */
const { Op } = require('sequelize');
const { GenerationHistory, Template } = require('../models');
const {
  HISTORY_PAGE_SIZE,
  HistoryService,
  requestedPageNumber
} = require('../services/historyService');

/** Builds pagination links while retaining the active search and sort choices. */
function historyPageUrl({ page, search, order }) {
  const query = new URLSearchParams({ page: String(page), order });
  if (search) query.set('search', search);
  return `/history?${query.toString()}`;
}

class HistoryController {
  /** @param {object} dependencies - Persistence models and an optional test service. */
  constructor({ GenerationHistoryModel, TemplateModel, historyService }) {
    this.GenerationHistory = GenerationHistoryModel;
    this.Template = TemplateModel;
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
      // Ownership is part of every query, rather than being checked after records are loaded.
      const where = { UserId: req.session.user.id };

      if (search) {
        where[Op.or] = [
          { subject: { [Op.like]: `%${search}%` } },
          { body: { [Op.like]: `%${search}%` } }
        ];
      }

      const { entries, total, page } = await this.historyService.listPage({
        where,
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
            page * HISTORY_PAGE_SIZE < total
              ? historyPageUrl({ page: page + 1, search, order: orderQuery })
              : null
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
      // Combining the entry and user IDs prevents deleting another user's saved draft.
      const entry = await this.GenerationHistory.findOne({
        where: {
          id: entryId,
          UserId: req.session.user.id
        }
      });

      if (!entry) return res.status(404).render('404', { pageTitle: 'Not Found' });

      await entry.destroy();
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
  HISTORY_PAGE_SIZE,
  HistoryController,
  deleteHistoryEntry: historyController.deleteHistoryEntry,
  historyPageUrl,
  historyPage: historyController.historyPage
};
