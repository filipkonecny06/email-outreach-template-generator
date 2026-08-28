/** Provides bounded offset pagination with deterministic ordering for saved history. */
const { Op } = require('sequelize');
const { HistoryRepository } = require('../repositories/historyRepository');

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
  /**
   * @param {object} dependencies
   * @param {object} [dependencies.GenerationHistoryModel]
   * @param {object} [dependencies.TemplateModel]
   * @param {HistoryRepository} [dependencies.historyRepository]
   * @param {number} [dependencies.pageSize]
   */
  constructor({
    GenerationHistoryModel,
    TemplateModel,
    historyRepository,
    pageSize = HISTORY_PAGE_SIZE
  }) {
    this.historyRepository =
      historyRepository ||
      new HistoryRepository({
        GenerationHistory: GenerationHistoryModel,
        Template: TemplateModel
      });
    this.pageSize = pageSize;
  }

  async listPage({ where, requestedPage, order }) {
    const total = Number(await this.historyRepository.count(where));
    const pagination = pageForCount(requestedPage, total, this.pageSize);
    const entries =
      total === 0
        ? []
        : await this.historyRepository.findPage({
            where,
            order,
            limit: this.pageSize,
            offset: pagination.offset
          });

    return { entries, total, ...pagination };
  }

  /** Builds the ownership-scoped search query before delegating pagination. */
  listForUser({ userId, search, requestedPage, order }) {
    const where = { UserId: userId };
    if (search) {
      where[Op.or] = [
        { subject: { [Op.like]: `%${search}%` } },
        { body: { [Op.like]: `%${search}%` } }
      ];
    }
    return this.listPage({ where, requestedPage, order });
  }

  saveSnapshot({ userId, rendered, payload }) {
    return this.historyRepository.create({
      UserId: userId,
      TemplateId: rendered.template.id,
      subject: rendered.subject,
      body: rendered.body,
      payload
    });
  }

  async deleteOwned({ entryId, userId }) {
    const entry = await this.historyRepository.findOwnedById(entryId, userId);
    if (!entry) return false;
    await entry.destroy();
    return true;
  }
}

module.exports = {
  HISTORY_PAGE_SIZE,
  HistoryService,
  pageForCount,
  requestedPageNumber
};
