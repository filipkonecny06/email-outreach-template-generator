// The parent router requires authentication; controller queries still scope records to that user.
const express = require('express');
const historyController = require('../controllers/historyController');

const router = express.Router();

router.get('/', historyController.historyPage);
router.delete('/:id', historyController.deleteHistoryEntry);

module.exports = router;
