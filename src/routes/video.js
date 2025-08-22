const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/authmiddleware');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const upload = multer({ dest: UPLOAD_DIR });

// Upload a video file
router.post('/upload', authMiddleware, upload.single('video'), (req, res) => {
  res.json({
    message: 'File uploaded',
    filename: req.file.filename,
    originalname: req.file.originalname
  });
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