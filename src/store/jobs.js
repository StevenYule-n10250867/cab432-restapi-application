const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(JOBS_FILE)) {
  fs.writeFileSync(JOBS_FILE, JSON.stringify({ jobs: [] }, null, 2));
}

// Read all jobs from JSON file
function read() {
  try {
    const raw = fs.readFileSync(JOBS_FILE, 'utf8');
    const parsed = JSON.parse(raw);

    // Ensure it always returns { jobs: [] }
    if (!parsed || !Array.isArray(parsed.jobs)) {
      return { jobs: [] };
    }

    return parsed;
  } catch (err) {
    console.warn('[WARN] Could not read jobs file:', err.message);
    return { jobs: [] };
  }
}

//Overwrite the jobs file
function write(data) {
  fs.writeFileSync(JOBS_FILE, JSON.stringify(data, null, 2));
}

// Create a new job entry
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

// Update an existing job by ID
function updateJob(id, patch) {
  const db = read();
  const job = db.jobs.find(j => j.id === id);
  if (!job) return null;

  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  write(db);

  return job;
}

// Retrieve a job by ID
function getJob(id) {
  const db = read();
  return db.jobs.find(j => j.id === id) || null;
}

// List jobs with optional filtering and pagination
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

// Generate a short, URL-safe ID
function cryptoRandomId() {
  return require('crypto').randomBytes(9).toString('base64url');
}

module.exports = { createJob, updateJob, getJob, listJobs };