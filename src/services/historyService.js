const HISTORY_PAGE_SIZE = 25;

function requestedPageNumber(value) {
  const text = String(value ?? '1');
  if (!/^[1-9]\d*$/.test(text)) return 1;
  const page = Number(text);
  return Number.isSafeInteger(page) ? page : Number.MAX_SAFE_INTEGER;
}

function pageForCount(requestedPage, total, pageSize = HISTORY_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  return { page, totalPages, offset: (page - 1) * pageSize };
}

class HistoryService {
  constructor({ GenerationHistoryModel, TemplateModel, pageSize = HISTORY_PAGE_SIZE }) {
    this.GenerationHistory = GenerationHistoryModel;
    this.Template = TemplateModel;
    this.pageSize = pageSize;
  }

  async listPage({ where, requestedPage, order }) {
    const total = Number(await this.GenerationHistory.count({ where }));
    const pagination = pageForCount(requestedPage, total, this.pageSize);
    const entries =
      total === 0
        ? []
        : await this.GenerationHistory.findAll({
            where,
            include: [{ model: this.Template, attributes: ['id', 'name', 'category'] }],
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
