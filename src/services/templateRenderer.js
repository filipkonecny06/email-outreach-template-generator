/** Converts template records and form values into plain-text outreach copy. */
const TOKEN_PATTERN = /\{([a-zA-Z0-9_]+)\}/g;

const TONE_PROFILES = Object.freeze({
  direct: Object.freeze({
    greeting: 'Hi {firstName},',
    bridge: 'Here is the relevant part:',
    cta: 'Is this worth a quick look?',
    signoff: 'Best,\n{senderName}'
  }),
  friendly: Object.freeze({
    greeting: 'Hi {firstName},',
    bridge: 'I thought this might be genuinely useful for your readers:',
    cta: 'Would you be open to taking a look?',
    signoff: 'Thanks,\n{senderName}'
  }),
  formal: Object.freeze({
    greeting: 'Hello {firstName},',
    bridge: 'I am writing to share the following relevant context:',
    cta: 'Would you be willing to consider it?',
    signoff: 'Kind regards,\n{senderName}'
  })
});

const LENGTH_BLOCKS = Object.freeze({
  short: Object.freeze(['opener', 'value', 'close']),
  medium: Object.freeze(['opener', 'value', 'proof', 'close']),
  long: Object.freeze(['opener', 'value', 'proof', 'detail', 'close'])
});

function normalizeChoice(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

/**
 * Renders outreach copy as plain text.
 *
 * Escaping belongs at the HTML boundary (EJS or the browser), not in the
 * domain layer. Keeping this renderer output-format agnostic prevents HTML
 * entities from leaking into clipboard, CSV, downloads, and saved history.
 */
class OutreachTemplateRenderer {
  /** @param {object} [options] - Unknown-token behavior for incomplete previews. */
  constructor({ preserveUnknownTokens = true } = {}) {
    this.preserveUnknownTokens = preserveUnknownTokens;
  }

  /**
   * Performs one substitution pass over a template.
   * A single pass prevents token-like user input from being interpreted as template syntax.
   */
  render(template, values = {}) {
    if (!template) return '';
    return String(template).replace(TOKEN_PATTERN, (placeholder, token) => {
      const value = values[token];
      if (value === undefined || value === null || value === '') {
        return this.preserveUnknownTokens ? placeholder : '';
      }
      return String(value);
    });
  }

  /** Returns unique token names in first-appearance order. */
  extractTokens(template) {
    const tokens = new Set();
    for (const match of String(template || '').matchAll(TOKEN_PATTERN)) {
      tokens.add(match[1]);
    }
    return [...tokens];
  }

  /** Composes the catalog's content blocks according to a supported tone and length profile. */
  composeBody(content, { tone = 'friendly', length = 'medium' } = {}) {
    const selectedTone = normalizeChoice(tone, Object.keys(TONE_PROFILES), 'friendly');
    const selectedLength = normalizeChoice(length, Object.keys(LENGTH_BLOCKS), 'medium');
    const profile = TONE_PROFILES[selectedTone];
    const blocks = LENGTH_BLOCKS[selectedLength].map((key) => content?.[key]).filter(Boolean);

    if (blocks.length === 0) return '';

    const paragraphs = [profile.greeting];
    if (selectedLength !== 'short') paragraphs.push(profile.bridge);
    paragraphs.push(...blocks.slice(0, -1));
    paragraphs.push(`${blocks.at(-1)} ${profile.cta}`);
    paragraphs.push(profile.signoff);
    return paragraphs.join('\n\n');
  }

  /**
   * Renders the primary message and, when requested, its configured follow-up sequence.
   */
  renderCampaign(template, values = {}, { includeFollowUps = false } = {}) {
    const tone = normalizeChoice(values.tone, Object.keys(TONE_PROFILES), 'friendly');
    const length = normalizeChoice(values.length, Object.keys(LENGTH_BLOCKS), 'medium');
    const profile = TONE_PROFILES[tone];
    const userValues = { senderName: 'Your Name', ...values };
    // Tone fragments are application-owned. Resolve their direct personalization
    // before inserting them into follow-ups; render() never rescans user values.
    const resolvedProfile = Object.fromEntries(
      Object.entries(profile).map(([key, fragment]) => [key, this.render(fragment, userValues)])
    );
    const renderingValues = { ...userValues, ...resolvedProfile };
    const content = template.contentConfig || template.content;
    const bodyTemplate = content
      ? this.composeBody(content, { tone, length })
      : template.bodyTemplate;
    const result = {
      subject: this.render(template.subjectTemplate, renderingValues),
      body: this.render(bodyTemplate, renderingValues)
    };

    if (includeFollowUps) {
      const configuredFollowUps = Array.isArray(template.followUps)
        ? template.followUps
        : [1, 2].map((sequence) => ({
            sequence,
            subjectTemplate: template[`followUp${sequence}SubjectTemplate`],
            bodyTemplate: template[`followUp${sequence}BodyTemplate`]
          }));

      result.followUps = configuredFollowUps
        .map((followUp, index) => ({
          sequence: followUp.sequence || index + 1,
          subject: this.render(followUp.subjectTemplate, renderingValues),
          body: this.render(followUp.bodyTemplate, renderingValues)
        }))
        .filter((followUp) => followUp.subject || followUp.body);
    }

    return result;
  }
}

const defaultRenderer = new OutreachTemplateRenderer();

module.exports = {
  LENGTH_BLOCKS,
  OutreachTemplateRenderer,
  TONE_PROFILES,
  extractTokens: (template) => defaultRenderer.extractTokens(template),
  renderTemplate: (template, values) => defaultRenderer.render(template, values)
};
