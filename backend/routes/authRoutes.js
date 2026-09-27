const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');

// Login rate limit: 5 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many login attempts, try again later', errorCode: 'RATE_LIMIT' }
});

router.post('/login', loginLimiter, controller.login);
router.get('/me', auth, controller.me);

module.exports = router;
