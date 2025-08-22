const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

async function generateThumbnails(inputPath, outDirWebRoot, filenameBase, count = 3) {
  if (!fs.existsSync(outDirWebRoot)) fs.mkdirSync(outDirWebRoot, { recursive: true });
  await new Promise((resolve, reject) => {
    execFile('ffmpeg', ['-y','-i', inputPath, '-vf','fps=1/10', path.join(outDirWebRoot, `${filenameBase}-thumb-%02d.jpg`)],
      (err) => err ? reject(err) : resolve());
  });
  const files = fs.readdirSync(outDirWebRoot)
    .filter(f => f.startsWith(filenameBase + '-thumb-') && f.endsWith('.jpg'))
    .sort().slice(0, count);
  return files.map(f => `/${path.basename(outDirWebRoot)}/${f}`);
}
module.exports = { generateThumbnails };