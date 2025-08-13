const { execFile } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');

function ffprobeJson(filePath) {
  return new Promise((resolve, reject) => {
    execFile('ffprobe', ['-v','error','-print_format','json','-show_format','-show_streams', filePath],
      (err, stdout) => err ? reject(err) : resolve(JSON.parse(stdout)));
  });
}
function fileSizeBytes(filePath) { return fs.existsSync(filePath) ? fs.statSync(filePath).size : null; }
function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(filePath).on('error', reject).on('data', d => h.update(d)).on('end', () => resolve(h.digest('hex')));
  });
}
module.exports = { ffprobeJson, fileSizeBytes, sha256File };
