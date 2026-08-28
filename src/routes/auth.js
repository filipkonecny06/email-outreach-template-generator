const express = require('express');
const authController = require('../controllers/authController');
const { AuthController } = authController;
const { registerValidation, loginValidation } = require('../middleware/validation');

function createAuthRouter({ controller, sessionCookieName } = {}) {
  const selectedController = controller || new AuthController({ sessionCookieName });
  const router = express.Router();

  router.get('/login', selectedController.showLogin);
  router.get('/register', selectedController.showRegister);
  router.post('/register', registerValidation, selectedController.postRegister);
  router.post('/login', loginValidation, selectedController.postLogin);
  router.post('/logout', selectedController.logout);
  return router;
}

const router = createAuthRouter({ controller: authController });
module.exports = router;
module.exports.createAuthRouter = createAuthRouter;
