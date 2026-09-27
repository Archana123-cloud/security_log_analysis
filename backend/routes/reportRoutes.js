const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/reportController');

router.get('/incidents.csv', auth, controller.downloadCsv);

module.exports = router;
