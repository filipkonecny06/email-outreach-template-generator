const { body } = require('express-validator');

const sanitizeText = (value) => String(value || '').trim();
const sanitizeUrl = (value) => String(value || '').trim();

const outreachFieldRules = [
  body('templateId').isInt({ min: 1 }).withMessage('Template is required.').toInt(),
  body('firstName').notEmpty().withMessage('First name is required.').customSanitizer(sanitizeText).isLength({ max: 80 }),
  body('siteName').notEmpty().withMessage('Site name is required.').customSanitizer(sanitizeText).isLength({ max: 120 }),
  body('siteUrl').notEmpty().withMessage('Site URL is required.').customSanitizer(sanitizeUrl).isURL(),
  body('topic').notEmpty().withMessage('Topic is required.').customSanitizer(sanitizeText).isLength({ max: 150 }),
  body('articleUrl').notEmpty().withMessage('Article URL is required.').customSanitizer(sanitizeUrl).isURL(),
  body('brokenUrl').optional({ checkFalsy: true }).customSanitizer(sanitizeUrl).isURL(),
  body('yourUrl').notEmpty().withMessage('Your URL is required.').customSanitizer(sanitizeUrl).isURL(),
  body('offerAngle').notEmpty().withMessage('Offer angle is required.').customSanitizer(sanitizeText).isLength({ max: 200 }),
  body('specificCompliment').notEmpty().withMessage('Specific compliment is required.').customSanitizer(sanitizeText).isLength({ max: 200 }),
  body('goal').isIn(['link', 'guest post', 'mention']).withMessage('Invalid goal.'),
  body('tone').isIn(['direct', 'friendly', 'formal']).withMessage('Invalid tone.'),
  body('length').isIn(['short', 'medium', 'long']).withMessage('Invalid length.'),
  body('includeFollowUps').optional().isBoolean().toBoolean()
];

exports.registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8, max: 64 }).withMessage('Password must be 8-64 characters long.')
];

exports.loginValidation = [body('email').isEmail().normalizeEmail(), body('password').notEmpty().isLength({ max: 64 })];

exports.outreachFieldRules = outreachFieldRules;
