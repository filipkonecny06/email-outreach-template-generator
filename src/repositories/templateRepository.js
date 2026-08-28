const { Op } = require('sequelize');

class TemplateRepository {
  constructor({ Template, Favorite }) {
    this.Template = Template;
    this.Favorite = Favorite;
  }

  findById(id) {
    return this.Template.findByPk(id);
  }

  list({ category = '', search = '', userId, onlyFavorites = false } = {}) {
    const where = {};
    if (category) where.category = category;
    if (search) where.name = { [Op.like]: `%${search}%` };
    const include = userId
      ? [
          {
            model: this.Favorite,
            required: onlyFavorites,
            where: { UserId: userId },
            attributes: ['TemplateId']
          }
        ]
      : [];

    return this.Template.findAll({
      where,
      include,
      order: [
        ['category', 'ASC'],
        ['name', 'ASC']
      ]
    });
  }

  async listFavoriteIds(userId) {
    const favorites = await this.Favorite.findAll({
      where: { UserId: userId },
      attributes: ['TemplateId']
    });
    return favorites.map((favorite) => favorite.TemplateId);
  }
}

module.exports = { TemplateRepository };
