
const fs = require('fs');
const path = require('path');
const DATA_DIR = path.join(__dirname, '../../data');
const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(JOBS_FILE)) fs.writeFileSync(JOBS_FILE, JSON.stringify({ jobs: [] }, null, 2));

function read() {
  return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8'));
}
function write(data) {
  fs.writeFileSync(JOBS_FILE, JSON.stringify(data, null, 2));
}

function createJob({ owner, filename }) {
  const db = read();
  const job = {
    id: cryptoRandomId(),
    owner,
    filename,
    status: 'queued',     
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    outputs: [],
    error: null
  };
  db.jobs.push(job);
  write(db);
  return job;
}

function updateJob(id, patch) {
  const db = read();
  const job = db.jobs.find(j => j.id === id);
  if (!job) return null;
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  write(db);
  return job;
}

function getJob(id) {
  const db = read();
  return db.jobs.find(j => j.id === id) || null;
}

function listJobs({ owner, status, page = 1, pageSize = 20 }) {
  const db = read();
  let items = db.jobs;
  if (owner) items = items.filter(j => j.owner === owner);
  if (status) items = items.filter(j => j.status === status);
  const total = items.length;
  const start = (page - 1) * pageSize;
  const results = items.slice(start, start + pageSize);
  return { total, page, pageSize, results };
}

function cryptoRandomId() {
  // compact URL-safe id
  return require('crypto').randomBytes(9).toString('base64url');
}

module.exports = { createJob, updateJob, getJob, listJobs };
