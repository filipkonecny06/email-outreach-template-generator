const express = require('express');
const apiController = require('../controllers/apiController');
const { requireApiAuth } = require('../middleware/auth');
const { outreachFieldRules } = require('../middleware/validation');

const router = express.Router();

router.get('/templates', apiController.getTemplates);
router.post('/preview', requireApiAuth, outreachFieldRules, apiController.preview);
router.post('/favorite/:templateId', requireApiAuth, apiController.toggleFavorite);
router.post('/history', requireApiAuth, outreachFieldRules, apiController.saveHistory);

module.exports = router;
