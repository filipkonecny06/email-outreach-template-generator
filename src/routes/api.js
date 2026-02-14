const express = require('express');
const apiController = require('../controllers/apiController');
const { outreachFieldRules } = require('../middleware/validation');

const router = express.Router();

router.get('/templates', apiController.getTemplates);
router.post('/preview', outreachFieldRules, apiController.preview);
router.post('/favorite/:templateId', apiController.toggleFavorite);
router.post('/history', outreachFieldRules, apiController.saveHistory);

module.exports = router;
