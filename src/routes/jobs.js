const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const { authMiddleware } = require('../middleware/authmiddleware');
const authHeaderOrQuery = require('../middleware/authHeaderOrQuery');
//const { createJob, updateJobStatus, getJobById, listAllJobs } = require('../store/jobs');
const { putJob, updateJob, getJob, listJobs } = require('../utils/dynamodb');
const { v4: uuidv4 } = require('uuid');
const { ffprobeJson, fileSizeBytes, sha256File } = require('../utils/mediaInfo');
const { uploadFile, downloadFile } = require('../utils/s3');

const allowPublicReports = process.env.ALLOW_PUBLIC_REPORTS === 'true';
const passThrough = (_req, _res, next) => next();

const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const TRANSCODED_DIR = path.join(__dirname, '../transcoded');

if (!fs.existsSync(TRANSCODED_DIR)) fs.mkdirSync(TRANSCODED_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ----------------------------
// POST /jobs/transcode
// ----------------------------
router.post('/transcode', authMiddleware, async (req, res) => {
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).json({ message: 'filename is required' });
  }

  const owner = req.user?.['cognito:username'] || req.user?.username || 'unknown';
  const job = {
    id: uuidv4(),
    owner,
    filename,
    status: 'queued',
    createdAt: new Date().toISOString()
  };
  await putJob(job);

  res.status(202).set('Location', `/jobs/${job.id}`).json({ jobId: job.id, status: job.status });

  try {
    const t0 = Date.now();
    await updateJob(job.id, { status: 'processing', startedAt: new Date().toISOString() });

    const localInput = `/tmp/${filename}`;
    await downloadFile(filename, localInput);

    const baseName = path.parse(filename).name;
    const outputName = `transcoded-${baseName}.mp4`;
    const localOutput = `/tmp/${outputName}`;

    const cmd = `ffmpeg -y -i "${localInput}" -vcodec libx264 -preset veryfast "${localOutput}"`;
    await new Promise((resolve, reject) => exec(cmd, err => (err ? reject(err) : resolve())));

    const s3OutputKey = `transcoded/${outputName}`;
    await uploadFile(localOutput, s3OutputKey);

    const t1 = Date.now();
    await updateJob(job.id, {
      status: 'done',
      finishedAt: new Date().toISOString(),
      elapsedMs: t1 - t0,
      outputs: [
        { type: 'mp4', path: `s3://${process.env.AWS_S3_BUCKET}/${s3OutputKey}` }
      ]
    });
  } catch (e) {
    await updateJob(job.id, {
      status: 'failed',
      error: e.message,
      finishedAt: new Date().toISOString()
    });
  }
});

//----------------------------------------------------------------

//-----------------------------------------------------------------
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const job = await getJob(req.params.id);
    if (!job) return res.sendStatus(404);
    
    const currentUser = req.user?.['cognito:username'] || req.user?.username;

    if (job.owner !== currentUser && !(req.user['cognito:groups'] || []).includes('admin')) {
      return res.sendStatus(403);
    }

    res.json(job);
  } catch (err) {
    console.error('Error fetching job by ID:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ----------------------------
// GET /jobs (list all jobs for user)
// ----------------------------
router.get('/', authMiddleware, async (req, res) => {
  try {
    const allJobs = await listJobs();
    const filtered = allJobs.filter(j => 
      j.owner === req.user?.username || req.user?.username === 'admin'
    );
    res.json(filtered);
  } catch (err) {
    console.error('Error listing jobs:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ----------------------------
// GET /jobs/:id/report
// ----------------------------
router.get('/:id/report', allowPublicReports ? passThrough : authMiddleware, async (req, res) => {
  try {
    const job = await getJob(req.params.id);
    if (!job) return res.sendStatus(404);

    if (!allowPublicReports) {
      if (job.owner !== req.user?.username && req.user?.username !== 'admin') {
        return res.sendStatus(403);
      }
    }

    const formatDateTime = (iso) => {
      if (!iso) return '';
      const d = new Date(iso);
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const pretty = (obj) => esc(JSON.stringify(obj ?? (Array.isArray(obj) ? [] : {}), null, 2));
    const has = (v) => v !== undefined && v !== null;

    const input = job.input || {};
    const out = (job.outputs && job.outputs[0]) || {};

    res.set('Content-Type', 'text/html').send(`<!doctype html>
<html><head><meta charset="utf-8">
<title>Job ${esc(job.id)} Report</title>
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
  } catch (err) {
    console.error('Error generating report:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = router;
