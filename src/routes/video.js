// src/routes/video.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/authmiddleware');
const { uploadFile, getUploadUrl, getDownloadUrl } = require('../utils/s3');

const router = express.Router();

// Temp upload dir (just used before uploading to S3)
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer setup for direct uploads (Swagger/file form POST)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

// -----------------------------
// Upload a video file (EC2 → S3)
// -----------------------------

router.post('/upload', authMiddleware, upload.single('video'), async (req, res) => {
  try {
    const s3Key = `uploads/${req.file.originalname}`;
    const s3Path = await uploadFile(req.file.path, s3Key);

    res.json({
      message: 'File uploaded successfully',
      filename: req.file.originalname,
      s3Path
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Upload failed', error: err.message });
  }
});

//-----------------------------
//Get pre-signed upload URL (direct to S3)
// -----------------------------
router.get('/upload-url', authMiddleware, async (req, res) => {
  try {
    const { filename } = req.query;
    if (!filename) {
      return res.status(400).json({ message: 'filename query param required' });
    }
    const url = await getUploadUrl(`uploads/${filename}`);
    res.json({ uploadUrl: url });
  } catch (err) {
    console.error('Error generating upload URL:', err);
    res.status(500).json({ message: 'Failed to generate upload URL' });
  }
});

// -----------------------------
// Get pre-signed download URL (direct from S3)
// -----------------------------
router.get('/download-url', authMiddleware, async (req, res) => {
  try {
    const { key } = req.query;
    if (!key) {
      return res.status(400).json({ message: 'key query param required' });
    }
    const url = await getDownloadUrl(key);
    res.json({ downloadUrl: url });
  } catch (err) {
    console.error('Error generating download URL:', err);
    res.status(500).json({ message: 'Failed to generate download URL' });
  }
});

module.exports = router;
