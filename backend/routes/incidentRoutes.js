const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/incidentController');

router.get('/', auth, controller.list);
router.get('/:id', auth, controller.getOne);
router.patch('/:id/status', auth, controller.updateStatus);

module.exports = router;
