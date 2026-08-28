const Ajv2020 = require('ajv/dist/2020');
const { OutreachTemplateRenderer } = require('./templateRenderer');

const RESERVED_RENDER_TOKENS = new Set([
  'greeting',
  'bridge',
  'cta',
  'signoff',
  'senderName',
  'tone',
  'length'
]);

function formatAjvErrors(errors = []) {
  return errors.map((error) => `${error.instancePath || '/'} ${error.message}`.trim());
}

function contentToBodyTemplate(content, renderer = new OutreachTemplateRenderer()) {
  return renderer.composeBody(content, { tone: 'friendly', length: 'medium' });
}

class TemplateCatalogService {
  constructor({ repository, renderer = new OutreachTemplateRenderer(), validator } = {}) {
    this.repository = repository;
    this.renderer = renderer;
    this.validator = validator;
  }

  loadAndValidate() {
    const schema = this.repository.readSchema();
    const catalog = this.repository.readCatalog();
    const validate =
      this.validator || new Ajv2020({ allErrors: true, strict: true }).compile(schema);

    if (!validate(catalog)) {
      throw new Error(
        `Template catalog schema validation failed:\n- ${formatAjvErrors(validate.errors).join('\n- ')}`
      );
    }

    this.#validateSemantics(catalog.templates);
    return catalog;
  }

  list({ category } = {}) {
    const templates = this.loadAndValidate().templates;
    return category ? templates.filter((template) => template.category === category) : templates;
  }

  toDatabaseRecord(template, timestamps = {}) {
    const followUps = template.followUps || [];
    return {
      catalogKey: template.key,
      name: template.name,
      category: template.category,
      summary: template.summary,
      subjectTemplate: template.subjectTemplate,
      bodyTemplate: contentToBodyTemplate(template.content, this.renderer),
      requiredFields: template.requiredFields,
      contentConfig: template.content,
      followUp1SubjectTemplate: followUps[0]?.subjectTemplate || null,
      followUp1BodyTemplate: followUps[0]?.bodyTemplate || null,
      followUp2SubjectTemplate: followUps[1]?.subjectTemplate || null,
      followUp2BodyTemplate: followUps[1]?.bodyTemplate || null,
      ...timestamps
    };
  }

  async sync({ Template, dryRun = true, logger = { info() {} } }) {
    const desired = this.loadAndValidate().templates.map((template) =>
      this.toDatabaseRecord(template)
    );
    const existing = await Template.findAll({
      where: { catalogKey: desired.map((template) => template.catalogKey) }
    });
    const existingByKey = new Map(existing.map((template) => [template.catalogKey, template]));
    const summary = { create: 0, update: 0, unchanged: 0, dryRun };

    for (const record of desired) {
      const current = existingByKey.get(record.catalogKey);
      if (!current) {
        summary.create += 1;
        if (!dryRun) await Template.create(record);
        continue;
      }

      const currentValues = current.toJSON();
      const changed = Object.entries(record).some(
        ([key, value]) => JSON.stringify(currentValues[key]) !== JSON.stringify(value)
      );
      if (changed) {
        summary.update += 1;
        if (!dryRun) await current.update(record);
      } else {
        summary.unchanged += 1;
      }
    }

    logger.info('Catalog sync completed', summary);
    return summary;
  }

  #validateSemantics(templates) {
    const keys = new Set();
    const names = new Set();

    for (const template of templates) {
      if (keys.has(template.key)) throw new Error(`Duplicate catalog key: ${template.key}`);
      if (names.has(template.name)) throw new Error(`Duplicate template name: ${template.name}`);
      keys.add(template.key);
      names.add(template.name);

      const text = [
        template.subjectTemplate,
        ...Object.values(template.content),
        ...template.followUps.flatMap((followUp) => [
          followUp.subjectTemplate,
          followUp.bodyTemplate
        ])
      ].join('\n');
      const tokens = this.renderer
        .extractTokens(text)
        .filter((token) => !RESERVED_RENDER_TOKENS.has(token));
      const undeclared = tokens.filter((token) => !template.requiredFields.includes(token));
      if (undeclared.length > 0) {
        throw new Error(
          `${template.key} uses undeclared required fields: ${undeclared.join(', ')}`
        );
      }
    }
  }
}

module.exports = { TemplateCatalogService, contentToBodyTemplate, formatAjvErrors };
