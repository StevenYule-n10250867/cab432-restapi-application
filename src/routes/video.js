const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/authmiddleware');

const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const upload = multer({ dest: UPLOAD_DIR });

router.post('/upload', authMiddleware, upload.single('video'), (req, res) => {
  res.json({ message: 'File uploaded', filename: req.file.filename, originalname: req.file.originalname });
});

router.post('/transcode', authMiddleware, (req, res) => {
  const { filename } = req.body;
  const inputPath = path.join(UPLOAD_DIR, filename);
  const outputPath = path.join(UPLOAD_DIR, `transcoded-${filename}.mp4`);

  const command = `ffmpeg -i "${inputPath}" -vcodec libx264 -preset veryfast "${outputPath}"`;

  exec(command, (err) => {
    if (err) {
      return res.status(500).json({ message: 'Transcoding failed', error: err.message });
    }
    res.json({ message: 'Transcoding complete', output: `transcoded-${filename}.mp4` });
  });
});


router.get('/files', authMiddleware, (req, res) => {
  const files = fs.readdirSync(UPLOAD_DIR).sort();
  res.json({ files });
});

module.exports = router;
