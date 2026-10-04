const express = require('express');
const rateLimitMiddleware = require('../Middleware/limiter');
const { registerRules, loginRules } = require('../Middleware/validators');
const authController = require('../controllers/authController');

const { loginLimiter } = rateLimitMiddleware;
const router = express.Router();

router.post('/createUser', rateLimitMiddleware, registerRules, authController.register);
router.post('/login', loginLimiter, loginRules, authController.login);

module.exports = router;
