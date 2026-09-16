const express = require('express');
const router = express.Router();
const multer = require('multer');
const mediaController = require('../controllers/Media.controller');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024
  }
});

router.post('/upload', upload.single('file'), mediaController.uploadFile);

module.exports = router;
