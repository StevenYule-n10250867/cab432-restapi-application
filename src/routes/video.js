// video.js
const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/authmiddleware');

const { uploadFile, getUploadUrl, getDownloadUrl } = require('../utils/s3');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

// Upload a video file (server-mediated, not presigned)
router.post('/upload', authMiddleware, upload.single('video'), async (req, res) => {
  try {
    // Upload local file to S3
    const s3Path = await uploadFile(req.file.path, req.file.originalname);

    res.json({
      message: 'File uploaded to S3',
      s3Path,
      filename: req.file.originalname
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Upload to S3 failed', error: err.message });
  }
});

// Get presigned upload URL
router.get('/upload-url', authMiddleware, async (req, res) => {
  try {
    const { filename } = req.query;
    if (!filename) return res.status(400).json({ message: 'filename query param required' });

    const url = await getUploadUrl(`uploads/${filename}`);
    res.json({ uploadUrl: url });
  } catch (err) {
    console.error('Error generating upload URL:', err);
    res.status(500).json({ message: 'Failed to generate upload URL' });
  }
});

// Get presigned download URL
router.get('/download-url', authMiddleware, async (req, res) => {
  try {
    const { key } = req.query;
    if (!key) return res.status(400).json({ message: 'key query param required' });

    const url = await getDownloadUrl(key);
    res.json({ downloadUrl: url });
  } catch (err) {
    console.error('Error generating download URL:', err);
    res.status(500).json({ message: 'Failed to generate download URL' });
  }
});

// Transcode a video
router.post('/transcode', authMiddleware, (req, res) => {
  const { filename } = req.body;
  const inputPath = path.join(UPLOAD_DIR, filename);
  const outputName = `transcoded-${filename}.mp4`;
  const outputPath = path.join(UPLOAD_DIR, outputName);

  const command = `ffmpeg -i "${inputPath}" -vcodec libx264 -preset veryfast "${outputPath}"`;

  exec(command, (err) => {
    if (err) {
      return res.status(500).json({
        message: 'Transcoding failed',
        error: err.message
      });
    }

    res.json({
      message: 'Transcoding complete',
      output: outputName
    });
  });
});

// List all uploaded files
router.get('/files', authMiddleware, (req, res) => {
  const files = fs.readdirSync(UPLOAD_DIR).sort();
  res.json({ files });
});

module.exports = router;
