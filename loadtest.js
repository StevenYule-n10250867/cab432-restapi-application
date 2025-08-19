const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

const SERVER = 'http://3.26.163.135:3000';
const UPLOAD_DIR = path.join(__dirname, 'uploads');

const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'adminpass'
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getToken() {
  const res = await fetch(`${SERVER}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ADMIN_CREDENTIALS)
  });

  if (!res.ok) {
    throw new Error(`Login failed: ${res.statusText}`);
  }

  const data = await res.json();
  return data.token;
}

async function sendTranscode(token, filename) {
  try {
    const res = await fetch(`${SERVER}/jobs/transcode`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filename }),
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.message || 'Unknown error');
    }

    const jobUrl = `${SERVER}/jobs/${body.jobId}/report`;
    console.log(`Started job for ${filename} → ${jobUrl}`);

  } catch (err) {
    console.error(`Failed for ${filename}:`, err.message);
  }
}

(async () => {
  const token = await getToken();
  const files = fs.readdirSync(UPLOAD_DIR).filter(f => f.endsWith('.mp4'));

  const startTime = Date.now();
  const durationMinutes = 5;

  while ((Date.now() - startTime) < durationMinutes * 60 * 1000) {
    const batch = [];

    // Launch up to 3 parallel jobs per file
    for (const file of files) {
      for (let i = 0; i < 3; i++) {
        batch.push(sendTranscode(token, file));
      }
    }

    await Promise.all(batch);
    await delay(3000); // Small pause between waves
  }

  console.log('Load test complete.');
})();
