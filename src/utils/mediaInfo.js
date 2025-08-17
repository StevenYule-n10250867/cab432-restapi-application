const { execFile } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');

// Run ffprobe and return JSON metadata
function ffprobeJson(filePath) {
  return new Promise((resolve, reject) => {
    execFile(
      'ffprobe',
      ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath],
      (err, stdout) => (err ? reject(err) : resolve(JSON.parse(stdout)))
    );
  });
}

// Get file size in bytes (null if missing)
function fileSizeBytes(filePath) {
  return fs.existsSync(filePath) ? fs.statSync(filePath).size : null;
}

// Generate SHA-256 checksum of file contents
function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(filePath)
      .on('error', reject)
      .on('data', chunk => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')));
  });
}

module.exports = {
  ffprobeJson,
  fileSizeBytes,
  sha256File
};

