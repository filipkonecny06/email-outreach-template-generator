/** Encapsulates generation-history persistence and ownership-scoped lookups. */
class HistoryRepository {
  /** @param {{GenerationHistory: object, Template: object}} models */
  constructor({ GenerationHistory, Template }) {
    this.GenerationHistory = GenerationHistory;
    this.Template = Template;
  }

  count(where) {
    return this.GenerationHistory.count({ where });
  }

  findPage({ where, order, limit, offset }) {
    return this.GenerationHistory.findAll({
      where,
      include: [{ model: this.Template, attributes: ['id', 'name', 'category'] }],
      order: [
        ['createdAt', order],
        ['id', order]
      ],
      limit,
      offset
    });
  }

  create(record) {
    return this.GenerationHistory.create(record);
  }

  findOwnedById(id, userId) {
    return this.GenerationHistory.findOne({ where: { id, UserId: userId } });
  }
}

module.exports = { HistoryRepository };
