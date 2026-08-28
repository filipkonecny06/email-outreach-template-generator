/** Declares validation and normalization rules at the HTTP request boundary. */
const { body } = require('express-validator');
const { LENGTH_VALUES, OUTREACH_FIELDS, TONE_VALUES } = require('../contracts/outreach');
const {
  BCRYPT_MAX_PASSWORD_BYTES,
  hasBcryptSafeByteLength
} = require('../services/passwordService');

const sanitizeText = (value) => String(value || '').trim();
const sanitizeUrl = (value) => String(value || '').trim();

function optionalText(field, maxLength) {
  return body(field)
    .optional({ checkFalsy: true })
    .customSanitizer(sanitizeText)
    .isLength({ max: maxLength })
    .withMessage(`${field} must contain at most ${maxLength} characters.`);
}

function optionalUrl(field, maxLength) {
  return body(field)
    .optional({ checkFalsy: true })
    .customSanitizer(sanitizeUrl)
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage(`${field} must be a complete HTTP or HTTPS URL.`)
    .isLength({ max: maxLength })
    .withMessage(`${field} must contain at most ${maxLength} characters.`);
}

// These names form the allowlist later enforced by express-validator's matchedData().
const outreachFieldRules = [
  body('templateId').isInt({ min: 1 }).withMessage('Template is required.').toInt(),
  ...OUTREACH_FIELDS.map((field) =>
    field.type === 'url'
      ? optionalUrl(field.name, field.maxLength)
      : optionalText(field.name, field.maxLength)
  ),
  body('tone').isIn(TONE_VALUES).withMessage('Invalid tone.'),
  body('length').isIn(LENGTH_VALUES).withMessage('Invalid length.'),
  body('includeFollowUps').optional().isBoolean().toBoolean()
];

exports.registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password')
    .isLength({ min: 12 })
    .withMessage('Password must contain at least 12 characters.')
    .custom(hasBcryptSafeByteLength)
    .withMessage(`Password must contain at most ${BCRYPT_MAX_PASSWORD_BYTES} UTF-8 bytes.`)
];

exports.loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password')
    .notEmpty()
    .custom(hasBcryptSafeByteLength)
    .withMessage(`Password must contain at most ${BCRYPT_MAX_PASSWORD_BYTES} UTF-8 bytes.`)
];

exports.hasBcryptSafeByteLength = hasBcryptSafeByteLength;
exports.outreachFieldRules = outreachFieldRules;
