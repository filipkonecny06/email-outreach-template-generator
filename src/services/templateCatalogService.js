/** Validates the version-controlled template catalog and synchronizes catalog-managed rows. */
const Ajv2020 = require('ajv/dist/2020');
const { Op } = require('sequelize');
const { CATALOG_FIELD_NAMES } = require('../contracts/outreach');
const { OutreachTemplateRenderer } = require('./outreachTemplateRenderer');

const RESERVED_RENDER_TOKENS = new Set([
  'greeting',
  'bridge',
  'cta',
  'signoff',
  'senderName',
  'tone',
  'length'
]);
const IMPLICIT_RENDER_FIELDS = new Set(['firstName']);
const CATALOG_FIELDS = new Set(CATALOG_FIELD_NAMES);

/** Converts AJV's structured failures into readable CLI/startup diagnostics. */
function formatAjvErrors(errors = []) {
  return errors.map((error) => `${error.instancePath || '/'} ${error.message}`.trim());
}

/** Produces the default database body used by views that do not select tone or length. */
function contentToBodyTemplate(content, renderer = new OutreachTemplateRenderer()) {
  return renderer.composeBody(content, { tone: 'friendly', length: 'medium' });
}

/** Recursively sorts object keys so semantic JSON comparisons ignore key insertion order. */
function stableJsonValue(value) {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableJsonValue(value[key])])
    );
  }
  return value;
}

/** Compares JSON-compatible values after canonicalizing object key order. */
function valuesDiffer(left, right) {
  return JSON.stringify(stableJsonValue(left)) !== JSON.stringify(stableJsonValue(right));
}

class TemplateCatalogService {
  /** @param {object} dependencies - Catalog reader plus optional renderer and schema validator. */
  constructor({ repository, renderer = new OutreachTemplateRenderer(), validator } = {}) {
    this.repository = repository;
    this.renderer = renderer;
    this.validator = validator;
  }

  /**
   * Validates both the JSON shape and cross-field business rules before returning the catalog.
   *
   * @throws {Error} With actionable schema or semantic validation details.
   */
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

  /** Returns validated catalog templates, optionally limited to one category. */
  list({ category } = {}) {
    const templates = this.loadAndValidate().templates;
    return category ? templates.filter((template) => template.category === category) : templates;
  }

  /** Maps one catalog entry onto the database projection used by Sequelize. */
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

  /**
   * Reconciles catalog-owned rows and returns a change summary.
   * Apply mode is transactional so creates, updates, and stale-row deletes commit together.
   */
  async sync({ Template, dryRun = true, logger = { info() {} } }) {
    const desired = this.loadAndValidate().templates.map((template) =>
      this.toDatabaseRecord(template)
    );
    const desiredKeys = new Set(desired.map((template) => template.catalogKey));

    const synchronize = async (transaction) => {
      const existing = await Template.findAll({
        where: { catalogKey: { [Op.ne]: null } },
        ...(transaction ? { transaction } : {})
      });
      const existingByKey = new Map(existing.map((template) => [template.catalogKey, template]));
      // Only rows with catalog keys are managed; manually created rows remain untouched.
      const staleTemplates = existing.filter(
        (template) => template.catalogKey && !desiredKeys.has(template.catalogKey)
      );
      const staleKeys = staleTemplates.map((template) => template.catalogKey).sort();
      const summary = {
        create: 0,
        update: 0,
        unchanged: 0,
        stale: staleKeys.length,
        deleted: 0,
        staleKeys,
        dryRun
      };

      for (const record of desired) {
        const current = existingByKey.get(record.catalogKey);
        if (!current) {
          summary.create += 1;
          if (!dryRun) await Template.create(record, { transaction });
          continue;
        }

        const currentValues = current.toJSON();
        const changed = Object.entries(record).some(([key, value]) =>
          valuesDiffer(currentValues[key], value)
        );
        if (changed) {
          summary.update += 1;
          if (!dryRun) await current.update(record, { transaction });
        } else {
          summary.unchanged += 1;
        }
      }

      if (!dryRun) {
        for (const template of staleTemplates) {
          await template.destroy({ transaction });
          summary.deleted += 1;
        }
      }

      return summary;
    };

    let summary;
    if (dryRun) {
      // Dry runs read and compare database rows but never write; the summary may still be logged.
      summary = await synchronize();
    } else {
      if (!Template.sequelize?.transaction) {
        throw new TypeError('Catalog apply requires a Sequelize transaction provider.');
      }
      summary = await Template.sequelize.transaction(synchronize);
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

      const unsupported = template.requiredFields.filter((field) => !CATALOG_FIELDS.has(field));
      if (unsupported.length > 0) {
        throw new Error(`${template.key} declares unsupported fields: ${unsupported.join(', ')}`);
      }

      const text = [
        template.subjectTemplate,
        ...Object.values(template.content),
        ...template.followUps.flatMap((followUp) => [
          followUp.subjectTemplate,
          followUp.bodyTemplate
        ])
      ].join('\n');
      const extractedTokens = this.renderer.extractTokens(text);
      const tokens = extractedTokens.filter((token) => !RESERVED_RENDER_TOKENS.has(token));
      const undeclared = tokens.filter((token) => !template.requiredFields.includes(token));
      if (undeclared.length > 0) {
        throw new Error(
          `${template.key} uses undeclared required fields: ${undeclared.join(', ')}`
        );
      }

      const usedFields = new Set([...tokens, ...IMPLICIT_RENDER_FIELDS]);
      const unused = template.requiredFields.filter((field) => !usedFields.has(field));
      if (unused.length > 0) {
        throw new Error(`${template.key} declares unused required fields: ${unused.join(', ')}`);
      }
    }
  }
}

module.exports = {
  TemplateCatalogService,
  IMPLICIT_RENDER_FIELDS,
  contentToBodyTemplate,
  formatAjvErrors,
  stableJsonValue,
  valuesDiffer
};
