/** Provides bounded offset pagination with deterministic ordering for saved history. */
const HISTORY_PAGE_SIZE = 25;

/** Parses a positive page number without accepting decimals or unsafe integers. */
function requestedPageNumber(value) {
  const text = String(value ?? '1');
  if (!/^[1-9]\d*$/.test(text)) return 1;
  const page = Number(text);
  return Number.isSafeInteger(page) ? page : Number.MAX_SAFE_INTEGER;
}

/** Clamps a requested page to the available range and calculates its query offset. */
function pageForCount(requestedPage, total, pageSize = HISTORY_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  return { page, totalPages, offset: (page - 1) * pageSize };
}

class HistoryService {
  /** @param {object} dependencies - History model, template model, and optional page size. */
  constructor({ GenerationHistoryModel, TemplateModel, pageSize = HISTORY_PAGE_SIZE }) {
    this.GenerationHistory = GenerationHistoryModel;
    this.Template = TemplateModel;
    this.pageSize = pageSize;
  }

  /** Returns one page plus count metadata for an already ownership-scoped query. */
  async listPage({ where, requestedPage, order }) {
    const total = Number(await this.GenerationHistory.count({ where }));
    const pagination = pageForCount(requestedPage, total, this.pageSize);
    const entries =
      total === 0
        ? []
        : await this.GenerationHistory.findAll({
            where,
            include: [{ model: this.Template, attributes: ['id', 'name', 'category'] }],
            // The ID makes equal timestamps deterministic; offset pages may still shift after writes.
            order: [
              ['createdAt', order],
              ['id', order]
            ],
            limit: this.pageSize,
            offset: pagination.offset
          });

    return { entries, total, ...pagination };
  }
}

module.exports = {
  HISTORY_PAGE_SIZE,
  HistoryService,
  pageForCount,
  requestedPageNumber
};
