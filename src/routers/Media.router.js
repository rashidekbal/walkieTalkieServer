const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mediaController = require('../controllers/Media.controller');

// Configure temporary storage directory for multer in public folder
const uploadDir = path.resolve(__dirname, '../../public');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100 MB maximum threshold for video uploads
  }
});

// Middleware to gracefully handle Multer limit errors and return clear JSON responses
const handleMulterUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size exceeds maximum upload limit (10 MB for images/documents, 100 MB for video).'
        });
      }
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`
      });
    } else if (err) {
      return res.status(500).json({
        success: false,
        message: err.message || 'An unexpected error occurred during upload.'
      });
    }
    next();
  });
};

router.post('/upload', handleMulterUpload, mediaController.uploadFile);
router.get('/download', mediaController.downloadFile);

module.exports = router;

