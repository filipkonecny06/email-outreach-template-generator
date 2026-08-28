/**
 * @typedef {'text' | 'url'} OutreachFieldType
 *
 * @typedef {object} OutreachFieldDefinition
 * @property {string} name - Form, API, and template-token key.
 * @property {string} label - Human-readable label rendered beside the input.
 * @property {OutreachFieldType} type - Validation and HTML input type.
 * @property {number} maxLength - Maximum accepted character count.
 * @property {boolean} catalogSelectable - Whether catalogs may declare the field as required.
 * @property {string} [autocomplete] - Optional HTML autocomplete hint.
 *
 * @typedef {object} ToneDefinition
 * @property {string} value
 * @property {string} label
 * @property {{greeting: string, bridge: string, cta: string, signoff: string}} profile
 *
 * @typedef {object} LengthDefinition
 * @property {string} value
 * @property {string} label
 * @property {readonly string[]} blocks
 */

/** @type {readonly OutreachFieldDefinition[]} */
const OUTREACH_FIELDS = Object.freeze([
  Object.freeze({
    name: 'firstName',
    label: 'First Name',
    type: 'text',
    maxLength: 80,
    catalogSelectable: true,
    autocomplete: 'given-name'
  }),
  Object.freeze({
    name: 'siteName',
    label: 'Site Name',
    type: 'text',
    maxLength: 120,
    catalogSelectable: true
  }),
  Object.freeze({
    name: 'topic',
    label: 'Topic',
    type: 'text',
    maxLength: 150,
    catalogSelectable: true
  }),
  Object.freeze({
    name: 'articleUrl',
    label: 'Article URL',
    type: 'url',
    maxLength: 2048,
    catalogSelectable: true
  }),
  Object.freeze({
    name: 'brokenUrl',
    label: 'Broken URL',
    type: 'url',
    maxLength: 2048,
    catalogSelectable: true
  }),
  Object.freeze({
    name: 'yourUrl',
    label: 'Your URL',
    type: 'url',
    maxLength: 2048,
    catalogSelectable: true
  }),
  Object.freeze({
    name: 'offerAngle',
    label: 'Offer Angle',
    type: 'text',
    maxLength: 200,
    catalogSelectable: true
  }),
  Object.freeze({
    name: 'specificCompliment',
    label: 'Specific Compliment',
    type: 'text',
    maxLength: 200,
    catalogSelectable: true
  }),
  Object.freeze({
    name: 'senderName',
    label: 'Sender Name',
    type: 'text',
    maxLength: 80,
    catalogSelectable: false,
    autocomplete: 'name'
  })
]);

/** @type {readonly ToneDefinition[]} */
const TONE_OPTIONS = Object.freeze([
  Object.freeze({
    value: 'direct',
    label: 'Direct',
    profile: Object.freeze({
      greeting: 'Hi {firstName},',
      bridge: 'Here is the relevant part:',
      cta: 'Is this worth a quick look?',
      signoff: 'Best,\n{senderName}'
    })
  }),
  Object.freeze({
    value: 'friendly',
    label: 'Friendly',
    profile: Object.freeze({
      greeting: 'Hi {firstName},',
      bridge: 'I thought this might be genuinely useful for your readers:',
      cta: 'Would you be open to taking a look?',
      signoff: 'Thanks,\n{senderName}'
    })
  }),
  Object.freeze({
    value: 'formal',
    label: 'Formal',
    profile: Object.freeze({
      greeting: 'Hello {firstName},',
      bridge: 'I am writing to share the following relevant context:',
      cta: 'Would you be willing to consider it?',
      signoff: 'Kind regards,\n{senderName}'
    })
  })
]);

/** @type {readonly LengthDefinition[]} */
const LENGTH_OPTIONS = Object.freeze([
  Object.freeze({
    value: 'short',
    label: 'Short',
    blocks: Object.freeze(['opener', 'value', 'close'])
  }),
  Object.freeze({
    value: 'medium',
    label: 'Medium',
    blocks: Object.freeze(['opener', 'value', 'proof', 'close'])
  }),
  Object.freeze({
    value: 'long',
    label: 'Long',
    blocks: Object.freeze(['opener', 'value', 'proof', 'detail', 'close'])
  })
]);

const CATALOG_FIELD_NAMES = Object.freeze(
  OUTREACH_FIELDS.filter((field) => field.catalogSelectable).map((field) => field.name)
);
const TONE_VALUES = Object.freeze(TONE_OPTIONS.map((option) => option.value));
const LENGTH_VALUES = Object.freeze(LENGTH_OPTIONS.map((option) => option.value));
const TONE_PROFILES = Object.freeze(
  Object.fromEntries(TONE_OPTIONS.map((option) => [option.value, option.profile]))
);
const LENGTH_BLOCKS = Object.freeze(
  Object.fromEntries(LENGTH_OPTIONS.map((option) => [option.value, option.blocks]))
);

module.exports = {
  CATALOG_FIELD_NAMES,
  LENGTH_BLOCKS,
  LENGTH_OPTIONS,
  LENGTH_VALUES,
  OUTREACH_FIELDS,
  TONE_OPTIONS,
  TONE_PROFILES,
  TONE_VALUES
};
