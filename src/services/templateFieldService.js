/** Derives the input fields needed by a template's main message and follow-ups. */
const { OutreachTemplateRenderer } = require('./outreachTemplateRenderer');

function fieldList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function plainTemplate(template) {
  return typeof template?.toJSON === 'function' ? template.toJSON() : template || {};
}

class TemplateFieldService {
  /** @param {object} [dependencies] - Token renderer used for requirement analysis. */
  constructor({ renderer = new OutreachTemplateRenderer() } = {}) {
    this.renderer = renderer;
  }

  /**
   * Splits declared fields between the main message and follow-up-only content.
   * Already-decorated records provide this split; raw model or catalog records derive it.
   */
  requirementsFor(template) {
    const record = plainTemplate(template);
    if (Object.prototype.hasOwnProperty.call(record, 'followUpRequiredFields')) {
      return {
        requiredFields: fieldList(record.requiredFields),
        followUpRequiredFields: fieldList(record.followUpRequiredFields)
      };
    }
    const declaredFields = fieldList(record.requiredFields);
    const content = record.contentConfig || record.content;
    const mainText = [
      record.subjectTemplate,
      record.bodyTemplate,
      ...(content && typeof content === 'object' ? Object.values(content) : [])
    ].join('\n');
    const followUpText = Array.isArray(record.followUps)
      ? record.followUps
          .flatMap((followUp) => [followUp.subjectTemplate, followUp.bodyTemplate])
          .join('\n')
      : [
          record.followUp1SubjectTemplate,
          record.followUp1BodyTemplate,
          record.followUp2SubjectTemplate,
          record.followUp2BodyTemplate
        ].join('\n');
    const mainTokens = new Set(this.renderer.extractTokens(mainText));
    const followUpTokens = new Set(this.renderer.extractTokens(followUpText));
    const followUpRequiredFields = declaredFields.filter(
      (field) => !mainTokens.has(field) && followUpTokens.has(field)
    );
    const followUpOnly = new Set(followUpRequiredFields);

    return {
      requiredFields: declaredFields.filter((field) => !followUpOnly.has(field)),
      followUpRequiredFields
    };
  }

  fieldsFor(template, { includeFollowUps = false } = {}) {
    const requirements = this.requirementsFor(template);
    return includeFollowUps
      ? [...requirements.requiredFields, ...requirements.followUpRequiredFields]
      : requirements.requiredFields;
  }

  decorate(template) {
    return { ...plainTemplate(template), ...this.requirementsFor(template) };
  }
}

module.exports = { TemplateFieldService, fieldList, plainTemplate };
