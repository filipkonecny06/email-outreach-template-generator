const express = require('express');
const pageController = require('../controllers/pageController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', pageController.landingPage);
router.get('/generator', requireAuth, pageController.generatorPage);
router.get('/templates', pageController.templatesPage);
router.get('/templates/:id', pageController.templateDetailPage);

module.exports = router;
