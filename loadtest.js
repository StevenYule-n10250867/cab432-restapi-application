// loadtest.js
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { performance } = require("perf_hooks");

const apiEndpoint = "http://<your-api-instance-public-ip>:3000/jobs/transcode";

const numberOfRequests = 100;
const testFilename = "sample-30s.mp4";

let currentRequests = 0;
let rollingAverage = 1000;
const maxConcurrentRequests = 5;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendTranscodeRequest(i) {
  currentRequests++;
  const start = performance.now();

  const payload = { filename: testFilename };

  try {
    const res = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const duration = performance.now() - start;
    rollingAverage = rollingAverage * 0.9 + duration * 0.1;

    if (!res.ok) {
      const text = await res.text();
      console.error(`Request ${i} failed (${res.status}): ${text}`);
    } else {
      const data = await res.json().catch(() => ({}));
      console.log(
        `Request ${i} completed in ${duration.toFixed(2)}ms | rolling avg: ${rollingAverage.toFixed(2)}ms | jobId: ${data.jobId}`
      );
    }
  } catch (err) {
    console.error(`Request ${i} error: ${err.message}`);
  } finally {
    currentRequests--;
  }
}

(async () => {
  console.log(`Starting load test — sending ${numberOfRequests} requests to ${apiEndpoint}`);
  for (let i = 0; i < numberOfRequests; i++) {
    while (currentRequests >= maxConcurrentRequests) {
      await sleep(50);
    }
    sendTranscodeRequest(i);
  }
})();
