const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/dashboardController');

router.get('/summary', auth, controller.summary);
router.get('/timeline', auth, controller.timeline);
router.get('/severity', auth, controller.severity);
router.get('/top-ips', auth, controller.topIps);
router.get('/recent', auth, controller.recentIncidents);

module.exports = router;
