const { Template } = require('../models');
const { renderTemplate } = require('./templateRenderer');

async function getTemplates({ category, search, userId }) {
  const where = {};
  if (category) where.category = category;
  if (search) {
    where.name = { [require('sequelize').Op.like]: `%${search}%` };
  }

  const templates = await Template.findAll({
    where,
    order: [['createdAt', 'DESC']],
    include: userId
      ? [{ association: 'TemplateFans', where: { id: userId }, required: false, attributes: ['id'] }]
      : []
  });

  return templates.map((t) => ({
    ...t.toJSON(),
    isFavorite: userId ? (t.TemplateFans || []).length > 0 : false
  }));
}

async function renderFromTemplate(templateId, payload, includeFollowUps = false) {
  const template = await Template.findByPk(templateId);
  if (!template) {
    const err = new Error('Template not found');
    err.status = 404;
    throw err;
  }

  const subject = renderTemplate(template.subjectTemplate, payload);
  const body = renderTemplate(template.bodyTemplate, payload);

  const response = {
    template,
    subject,
    body
  };

  if (includeFollowUps) {
    response.followUps = [1, 2]
      .map((n) => ({
        sequence: n,
        subject: renderTemplate(template[`followUp${n}SubjectTemplate`], payload),
        body: renderTemplate(template[`followUp${n}BodyTemplate`], payload)
      }))
      .filter((f) => f.subject || f.body);
  }

  return response;
}

module.exports = {
  getTemplates,
  renderFromTemplate
};
