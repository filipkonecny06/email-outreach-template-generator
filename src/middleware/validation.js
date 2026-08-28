const { body } = require('express-validator');

const sanitizeText = (value) => String(value || '').trim();
const sanitizeUrl = (value) => String(value || '').trim();

function hasBcryptSafeByteLength(value) {
  return Buffer.byteLength(String(value || ''), 'utf8') <= 72;
}

function optionalText(field, maxLength) {
  return body(field)
    .optional({ checkFalsy: true })
    .customSanitizer(sanitizeText)
    .isLength({ max: maxLength })
    .withMessage(`${field} must contain at most ${maxLength} characters.`);
}

function optionalUrl(field) {
  return body(field)
    .optional({ checkFalsy: true })
    .customSanitizer(sanitizeUrl)
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage(`${field} must be a complete HTTP or HTTPS URL.`)
    .isLength({ max: 2048 })
    .withMessage(`${field} must contain at most 2048 characters.`);
}

const outreachFieldRules = [
  body('templateId').isInt({ min: 1 }).withMessage('Template is required.').toInt(),
  optionalText('firstName', 80),
  optionalText('siteName', 120),
  optionalText('topic', 150),
  optionalUrl('articleUrl'),
  optionalUrl('brokenUrl'),
  optionalUrl('yourUrl'),
  optionalText('offerAngle', 200),
  optionalText('specificCompliment', 200),
  optionalText('senderName', 80),
  body('tone').isIn(['direct', 'friendly', 'formal']).withMessage('Invalid tone.'),
  body('length').isIn(['short', 'medium', 'long']).withMessage('Invalid length.'),
  body('includeFollowUps').optional().isBoolean().toBoolean()
];

exports.registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password')
    .isLength({ min: 12 })
    .withMessage('Password must contain at least 12 characters.')
    .custom(hasBcryptSafeByteLength)
    .withMessage('Password must contain at most 72 UTF-8 bytes.')
];

exports.loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password')
    .notEmpty()
    .custom(hasBcryptSafeByteLength)
    .withMessage('Password must contain at most 72 UTF-8 bytes.')
];

exports.hasBcryptSafeByteLength = hasBcryptSafeByteLength;
exports.outreachFieldRules = outreachFieldRules;
