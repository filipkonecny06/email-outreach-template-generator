const { Op } = require('sequelize');
const { GenerationHistory, Template } = require('../models');

exports.historyPage = async (req, res, next) => {
  try {
    const search = (req.query.search || '').trim();
    const order = req.query.order === 'oldest' ? 'ASC' : 'DESC';

    const where = {
      UserId: req.session.user.id,
      deletedAt: null
    };

    if (search) {
      where[Op.or] = [
        { subject: { [Op.like]: `%${search}%` } },
        { body: { [Op.like]: `%${search}%` } }
      ];
    }

    const entries = await GenerationHistory.findAll({
      where,
      include: [{ model: Template, attributes: ['id', 'name', 'category'] }],
      order: [['createdAt', order]]
    });

    res.render('history', {
      pageTitle: 'Generation History',
      entries,
      search,
      order: order.toLowerCase()
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteHistoryEntry = async (req, res, next) => {
  try {
    const entry = await GenerationHistory.findOne({
      where: {
        id: Number(req.params.id),
        UserId: req.session.user.id,
        deletedAt: null
      }
    });

    if (!entry) return res.status(404).render('404', { pageTitle: 'Not Found' });

    await entry.update({ deletedAt: new Date() });
    return res.redirect('/history');
  } catch (error) {
    return next(error);
  }
};
