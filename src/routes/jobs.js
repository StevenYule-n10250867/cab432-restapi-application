const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/authmiddleware');
const { createJob, updateJob, getJob, listJobs } = require('../store/jobs');
const { ffprobeJson, fileSizeBytes, sha256File } = require('../utils/mediaInfo');
const authHeaderOrQuery = require('../middleware/authHeaderOrQuery');

const allowPublicReports = process.env.ALLOW_PUBLIC_REPORTS === 'true';
const passThrough = (_req, _res, next) => next();

const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const TRANSCODED_DIR = path.join(__dirname, '../transcoded');
if (!fs.existsSync(TRANSCODED_DIR)) fs.mkdirSync(TRANSCODED_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

router.post('/transcode', authMiddleware, async (req, res) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ message: 'filename is required' });
  const inputPath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(inputPath)) return res.status(404).json({ message: 'Input file not found', filename });

  const owner = req.user?.username || 'unknown';
  const job = createJob({ owner, filename });

  res.status(202).set('Location', `/jobs/${job.id}`).json({ jobId: job.id, status: 'queued' });

  try {
    const t0 = Date.now();
    updateJob(job.id, { status: 'processing', startedAt: new Date().toISOString() });

    const inputMeta = await ffprobeJson(inputPath);
    const inputSize = fileSizeBytes(inputPath);
    const inputSha  = await sha256File(inputPath);

    const outputName = `transcoded-${filename}.mp4`;
    const outputPath = path.join(TRANSCODED_DIR, outputName);
    const cmd = `ffmpeg -y -i "${inputPath}" -vcodec libx264 -preset veryfast "${outputPath}"`;
    await new Promise((resolve, reject) => exec(cmd, (err) => err ? reject(err) : resolve()));

    const outSizeNow = fileSizeBytes(outputPath);
    if (!outSizeNow || outSizeNow <= 0) throw new Error('Transcode produced empty output (0 bytes).');

    const outputMeta = await ffprobeJson(outputPath);
    const outputSha  = await sha256File(outputPath);
    const t1 = Date.now();

    updateJob(job.id, {
      status: 'done',
      finishedAt: new Date().toISOString(),
      elapsedMs: t1 - t0,
      input:  { path: `/uploads/${filename}`,        sizeBytes: inputSize,  sha256: inputSha,  meta: inputMeta },
      outputs:[{ type: 'mp4', path: `/transcoded/${outputName}`, sizeBytes: outSizeNow, sha256: outputSha, meta: outputMeta }],
    });
  } catch (e) {
    updateJob(job.id, { status: 'failed', error: e.message, finishedAt: new Date().toISOString() });
  }
});

router.get('/:id', authMiddleware, (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.sendStatus(404);
  if (job.owner !== req.user?.username && req.user?.username !== 'admin') return res.sendStatus(403);
  res.json(job);
});

router.get('/', authMiddleware, (req, res) => {
  const { status, page = '1', pageSize = '20' } = req.query;
  const out = listJobs({ owner: req.user?.username, status, page: parseInt(page,10), pageSize: parseInt(pageSize,10) });
  res.json(out);
});

// in src/routes/jobs.js
router.get('/:id/report', allowPublicReports ? passThrough : authMiddleware, (req, res) => {
  const job = getJob(req.params.id);

  const formatDateTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  if (!job) return res.sendStatus(404);

  // only enforce owner/admin when NOT allowing public reports
  if (!allowPublicReports) {
    if (job.owner !== req.user?.username && req.user?.username !== 'admin') {
      return res.sendStatus(403);
    }
  }

  // JSON view
  if ((req.query.format || '').toLowerCase() === 'json') {
    return res.json(job);
  }

  // Safe helpers
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const pretty = (obj) => esc(JSON.stringify(obj ?? (Array.isArray(obj) ? [] : {}), null, 2));
  const has = (v) => v !== undefined && v !== null;

  const input = job.input || {};
  const out = (job.outputs && job.outputs[0]) || {};
  const thumbs = [];

  res.set('Content-Type', 'text/html').send(`<!doctype html>
<html><head><meta charset="utf-8">
<title>Job ${esc(job.id)} Report</title>
<p class="pill">User Role: <code>${esc(req.user?.role || 'unknown')}</code></p>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:24px;line-height:1.45}
  code,pre{background:#f6f8fa;padding:2px 6px;border-radius:4px}
  .grid{display:grid;grid-template-columns:220px 1fr;gap:8px 16px}
  .section{margin:20px 0}
  .pill{display:inline-block;padding:2px 8px;border-radius:999px;background:#eef;border:1px solid #ccd}
  video{max-width:720px;width:100%;border:1px solid #ddd;border-radius:8px}
</style>
</head>
<body>
<h1>Video Transcode Report</h1>
<p class="pill">Job ID: <code>${esc(job.id)}</code></p>
<p>Status: <b>${esc(job.status)}</b>
 &middot; Started: ${esc(formatDateTime(job.startedAt))}
&middot; Finished: ${esc(formatDateTime(job.finishedAt))}
 &middot; Elapsed: ${esc(has(job.elapsedMs) ? (job.elapsedMs / 1000).toFixed(2) : '')} seconds</p>

<div class="section">
  <h2>Input</h2>
  <div class="grid">
    <div>Path</div><div>${input.path ? `<a href="${esc(input.path)}">${esc(input.path)}</a>` : '-'}</div>
    <div>Size</div><div>${esc(has(input.sizeBytes)?input.sizeBytes:'-')} bytes</div>
    <div>SHA-256</div><div>${input.sha256 ? `<code>${esc(input.sha256)}</code>` : '-'}</div>
    <div>Format</div><div><pre>${pretty(input.meta?.format)}</pre></div>
    <div>Streams</div><div><pre>${pretty(input.meta?.streams)}</pre></div>
  </div>
</div>

<div class="section">
  <h2>Output</h2>
  <div class="grid">
    <div>Path</div><div>${out.path ? `<a href="${esc(out.path)}">${esc(out.path)}</a>` : '-'}</div>
    <div>Size</div><div>${esc(has(out.sizeBytes)?out.sizeBytes:'-')} bytes</div>
    <div>SHA-256</div><div>${out.sha256 ? `<code>${esc(out.sha256)}</code>` : '-'}</div>
    <div>Format</div><div><pre>${pretty(out.meta?.format)}</pre></div>
    <div>Streams</div><div><pre>${pretty(out.meta?.streams)}</pre></div>
  </div>
</div>

${out.path ? `<div class="section"><h2>Preview</h2><video src="${esc(out.path)}" controls></video></div>` : ''}

<p class="section"><a href="/jobs/${esc(job.id)}/report?format=json">View as raw JSON</a></p>
</body></html>`);
});


module.exports = router;