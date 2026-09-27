const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const auth = require('../middleware/authMiddleware');
const controller = require('../controllers/logController');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (req, file, cb) =>
    cb(null, Date.now() + '-' + crypto.randomBytes(8).toString('hex') + path.extname(file.originalname).toLowerCase())
});

const upload = multer({
  storage,
  limits: { fileSize: Number(process.env.MAX_FILE_SIZE) || 10485760 },
  fileFilter: (req, file, cb) =>
    ['.log', '.txt', '.csv'].includes(path.extname(file.originalname).toLowerCase())
      ? cb(null, true) : cb(new Error('UNSUPPORTED_TYPE'))
});

router.post('/upload', auth, upload.single('logFile'), controller.upload);
router.get('/', auth, controller.list);
router.get('/:id', auth, controller.getOne);

module.exports = router;
