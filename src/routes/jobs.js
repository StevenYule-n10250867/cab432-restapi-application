// src/routes/jobs.js
const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const { authMiddleware } = require('../middleware/authmiddleware');
const { putJob, updateJob, getJob, listJobs } = require('../utils/dynamodb');
const { v4: uuidv4 } = require('uuid');
const { ffprobeJson, fileSizeBytes, sha256File } = require('../utils/mediaInfo');
const { uploadFile, downloadFile } = require('../utils/s3');

const allowPublicReports = process.env.ALLOW_PUBLIC_REPORTS === 'true';
const passThrough = (_req, _res, next) => next();

const router = express.Router();

// ----------------------------
// POST /jobs/transcode
// ----------------------------
router.post("/transcode", authMiddleware, async (req, res) => {
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).json({ message: "filename is required" });
  }

  const owner = req.user?.["cognito:username"] || "unknown";
  const job = {
    id: uuidv4(),
    owner,
    filename,
    status: "queued",
    createdAt: new Date().toISOString(),
  };

  await putJob(job);

  // use the PUBLIC bucket that workers can access
  const workerBucket = "n10250867-a2-media-api";
  const workerUrl = "http://n10250867-worker-alb-1006685742.ap-southeast-2.elb.amazonaws.com/transcode";

  try {
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: job.id,
        filename: filename,
        bucketName: workerBucket,
        owner: owner,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Worker rejected job:", text);
      return res.status(500).json({ message: "Worker rejected job", details: text });
    }

    console.log(`Dispatched job ${job.id} to worker via ALB`);
  } catch (err) {
    console.error("Failed to dispatch job to worker:", err.message);
    return res.status(500).json({ message: "Failed to dispatch job to worker" });
  }

  res.status(202)
    .set("Location", `/jobs/${job.id}`)
    .json({ jobId: job.id, status: job.status });
});

module.exports = router;


// ----------------------------
// POST /test/load
// ----------------------------

router.post("/load", authMiddleware, async (req, res) => {
  const { filename, count } = req.body;

  if (!filename || !count || count < 1) {
    return res.status(400).json({ message: "filename and count are required" });
  }

  const owner = req.user?.["cognito:username"] || "unknown";
  const QUEUE_URL = await getQueueUrl();

  const jobs = [];

  for (let i = 0; i < count; i++) {
    const jobId = uuidv4();
    const job = {
      id: jobId,
      owner,
      filename,
      status: "queued",
      createdAt: new Date().toISOString(),
    };

    await putJob(job); // add to DynamoDB

    const messageBody = JSON.stringify({
      jobId,
      filename,
      owner,
    });

    const command = new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: messageBody,
    });

    await sqs.send(command);
    jobs.push(jobId);
  }

  res.status(202).json({
    message: `Queued ${count} jobs for ${filename}`,
    jobIds: jobs,
  });
});

//-----------------------------
// GET /jobs/:id
// ----------------------------
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const job = await getJob(req.params.id);
    if (!job) return res.sendStatus(404);

    const currentUser = req.user?.['cognito:username'];
    const groups = req.user['cognito:groups'] || [];

    if (job.owner !== currentUser && !groups.includes('admin')) {
      return res.sendStatus(403);
    }

    res.json(job);
  } catch (err) {
    console.error('Error fetching job by ID:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ----------------------------
// GET /jobs (list jobs for user)
// ----------------------------
router.get('/', authMiddleware, async (req, res) => {
  try {
    const allJobs = await listJobs();
    const currentUser = req.user?.['cognito:username'];
    const groups = req.user['cognito:groups'] || [];

    const filtered = groups.includes('admin')
      ? allJobs
      : allJobs.filter(j => j.owner === currentUser);

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

    const currentUser = req.user?.['cognito:username'];
    const groups = req.user?.['cognito:groups'] || [];

    if (!allowPublicReports && job.owner !== currentUser && !groups.includes('admin')) {
      return res.sendStatus(403);
    }

    // return JSON if ?format=json
    if (req.query.format === 'json') {
      return res.json(job);
    }

    const formatDateTime = (iso) => {
      if (!iso) return '';
      const d = new Date(iso);
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    const esc = (s) =>
      String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const pretty = (obj) => {
      try {
        return esc(JSON.stringify(obj ?? {}, null, 2));
      } catch {
        return '{}';
      }
    };
    const has = (v) => v !== undefined && v !== null;

    const out = (Array.isArray(job.outputs) && job.outputs[0]) || {};

    res.set('Content-Type', 'text/html').send(`<!doctype html>
<html><head><meta charset="utf-8">
<title>Job ${esc(job.id)} Report</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:24px;line-height:1.45}
  code,pre{background:#f6f8fa;padding:2px 6px;border-radius:4px}
  .grid{display:grid;grid-template-columns:220px 1fr;gap:8px 16px}
  .section{margin:20px 0}
  .pill{display:inline-block;padding:6px 12px;border-radius:999px;background:#eef;border:1px solid #ccd;text-decoration:none;color:#000}
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
    <div>Path</div><div>${out.s3Uri ? `<code>${esc(out.s3Uri)}</code>` : '-'}</div>
    <div>Size</div><div>${has(out.sizeBytes) ? esc(out.sizeBytes) : '-'}</div>
    <div>SHA-256</div><div>${out.sha256 ? `<code>${esc(out.sha256)}</code>` : '-'}</div>
    <div>Format</div><div><pre>${pretty(out.meta?.format || {})}</pre></div>
    <div>Streams</div><div><pre>${pretty(out.meta?.streams || [])}</pre></div>
  </div>
</div>

${out.downloadUrl ? `
<div class="section">
  <h2>Preview</h2>
  <video src="${esc(out.downloadUrl)}" controls></video>
</div>
<div class="section">
  <h2>Download</h2>
  <a href="${esc(out.downloadUrl)}" download class="pill">⬇ Download Video</a>
</div>` : ''}

<p class="section"><a href="/jobs/${esc(job.id)}/report?format=json">View as raw JSON</a></p>
</body></html>`);
  } catch (err) {
    console.error('Error generating report:', err, { jobId: req.params.id });
    res.status(500).json({ message: 'Internal Server Error' });
  }
});



module.exports = router;
