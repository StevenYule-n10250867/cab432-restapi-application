const fetch = require("node-fetch");
const { performance } = require("perf_hooks");

const endpoint = "http://n10250867-worker-alb-1006685742.ap-southeast-2.elb.amazonaws.com/transcode";
const numberOfRequests = 100;
const testFilename = "sample-video.mp4"; // replace with a real file in your bucket
const bucketName = "n10250867-assessment3-bucket";

let currentRequests = 0;
let rollingAverage = 1000;
const maxConcurrentRequests = 5;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendTranscodeRequest(i) {
  currentRequests++;
  const start = performance.now();
  const jobId = `test-job-${i}-${Date.now()}`;

  const payload = {
    jobId,
    filename: testFilename,
    owner: "loadtester",
    bucketName,
  };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const duration = performance.now() - start;
    rollingAverage = rollingAverage * 0.9 + duration * 0.1;

    if (!res.ok) {
      console.error(`Request ${i} failed: ${res.status}`);
    } else {
      console.log(`Request ${i} completed in ${duration.toFixed(2)}ms | rolling avg: ${rollingAverage.toFixed(2)}ms`);
    }
  } catch (err) {
    console.error(`Request ${i} error: ${err.message}`);
  } finally {
    currentRequests--;
  }
}

(async () => {
  for (let i = 0; i < numberOfRequests; i++) {
    while (currentRequests >= maxConcurrentRequests) {
      await sleep(50);
    }
    sendTranscodeRequest(i);
  }
})();
