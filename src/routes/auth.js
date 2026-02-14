const express = require('express');
const authController = require('../controllers/authController');
const { registerValidation, loginValidation } = require('../middleware/validation');

const router = express.Router();

router.get('/login', authController.showLogin);
router.get('/register', authController.showRegister);
router.post('/register', registerValidation, authController.postRegister);
router.post('/login', loginValidation, authController.postLogin);
router.post('/logout', authController.logout);

module.exports = router;
