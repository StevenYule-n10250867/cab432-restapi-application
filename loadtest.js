const fs = require('fs');
const fetch = require('node-fetch');

const SERVER = 'http://localhost:3000';
const VIDEO_FILENAME = 'bbb_sunflower_1080p_60fps_normal.mp4';
const REPEAT_COUNT = 1;
const POLL_INTERVAL = 5000;

const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'adminpass'
};

// Get current CPU usage
function getCPUUsage() {
  const stat = fs.readFileSync('/proc/stat', 'utf8');
  const cpuLine = stat.split('\n')[0];
  const parts = cpuLine.trim().split(/\s+/).slice(1).map(Number);

  const idle = parts[3];
  const total = parts.reduce((acc, val) => acc + val, 0);

  return { idle, total };
}

// Sleep helper
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Authenticate and retrieve JWT token
async function getToken() {
  const res = await fetch(`${SERVER}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ADMIN_CREDENTIALS)
  });

  if (!res.ok) throw new Error(`Login failed: ${res.statusText}`);
  const data = await res.json();
  return data.token;
}

// Submit a transcode job and monitor until completion
async function sendTranscodeAndMonitor(token, filename, index) {
  const startTime = Date.now();
  let prevCPU = getCPUUsage();

  try {
    const res = await fetch(`${SERVER}/jobs/transcode`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ filename })
    });

    const text = await res.text();
    let body;

    try {
      body = JSON.parse(text);
    } catch (err) {
      console.error(`[${index + 1}]  Failed to parse /jobs/transcode response:\n${text}`);
      return;
    }

    if (!res.ok) {
      throw new Error(body.message || 'Unknown error');
    }

    const jobId = body.jobId;
    const jobUrl = `${SERVER}/jobs/${jobId}`;
    console.log(`[${index + 1}] Submitted job → ${jobUrl}`);

    let status = 'pending';

    while (status !== 'completed' && status !== 'failed') {
      await wait(POLL_INTERVAL);

      // CPU % calculation
      const currCPU = getCPUUsage();
      const idleDelta = currCPU.idle - prevCPU.idle;
      const totalDelta = currCPU.total - prevCPU.total;
      const usage = totalDelta > 0 ? 100 - (idleDelta / totalDelta * 100) : 0;
      prevCPU = currCPU;

      // Poll job status
      const pollRes = await fetch(jobUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const jobText = await pollRes.text();
      let job;
      try {
        job = JSON.parse(jobText);
      } catch (err) {
        console.error(`[${index + 1}]  Failed to parse job status response:\n${jobText}`);
        break;
      }

      status = job.status;
      const timestamp = new Date().toISOString();
      console.log(`[${index + 1}] ${timestamp} | CPU: ${usage.toFixed(1)}% used | Job status: ${status}`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[${index + 1}] Job ${status} in ${duration}s`);

  } catch (err) {
    console.error(`[${index + 1}] Failed:`, err.message);
  }
}

// === ENTRY POINT ===
(async () => {
  console.log(`[${new Date().toISOString()}] === Load test started ===`);
  const token = await getToken();

  const tasks = [];
  for (let i = 0; i < REPEAT_COUNT; i++) {
    tasks.push(sendTranscodeAndMonitor(token, VIDEO_FILENAME, i));
  }

  await Promise.all(tasks);
  console.log(`[${new Date().toISOString()}] === Load test finished ===`);
})();