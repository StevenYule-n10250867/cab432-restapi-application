const { v4: uuidv4 } = require('uuid');
const { putJob, getJob, updateJob, listJobs } = require('../utils/dynamodb');

// Create a new job entry in DynamoDB
async function createJob({ owner, filename }) {
  const job = {
    id: uuidv4().slice(0, 12),       // shorter ID, similar to cryptoRandomId
    owner,
    filename,
    status: 'queued',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    outputs: [],
    error: null
  };

  await putJob(job);
  return job;
}

// Update an existing job
async function updateJobStatus(id, patch) {
  patch.updatedAt = new Date().toISOString();
  await updateJob(id, patch);

  // Return updated job
  return await getJob(id);
}

// Retrieve a job by ID
async function getJobById(id) {
  return await getJob(id);
}

// List jobs
async function listAllJobs() {
  return await listJobs();
}

module.exports = { createJob, updateJobStatus, getJobById, listAllJobs };
