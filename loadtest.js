const fetch = require("node-fetch");
const { performance } = require("perf_hooks");

const endpoint = "http://n10250867-cab432-worker-alb.ap-southeast-2.elb.amazonaws.com/transcode";
const numberOfRequests = 6;
const targetResponseTime = 1800;
const targetTimeHysteresis = 1.2;
const minTargetConcurrentRequests = 2;
const maxTargetConcurrentRequests = 8;
const rollingAveragePastWeight = 0.95;
const scaleoutTime = 10000;

const rollingAverageCurrentWeight = 1 - rollingAveragePastWeight;
let currentRequests = 0;
let targetConcurrentRequests = minTargetConcurrentRequests;
let rollingAverage = targetResponseTime;
let lastScaleoutTime = performance.now();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeRequest(requestNumber) {
  currentRequests += 1;
  return new Promise((res) => {
    const startTime = performance.now();

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: "sample-30s.mp4"
      })
    })
      .then((res) => {
        const responseTime = performance.now() - startTime;
        rollingAverage =
          rollingAverage * rollingAveragePastWeight +
          responseTime * rollingAverageCurrentWeight;

        console.log(
          `Request ${requestNumber} completed in ${responseTime.toFixed(
            2
          )}ms | rolling avg: ${rollingAverage.toFixed(2)}ms`
        );

        if (performance.now() > scaleoutTime + lastScaleoutTime) {
          if (
            currentRequests <= targetConcurrentRequests &&
            rollingAverage > targetResponseTime * targetTimeHysteresis
          ) {
            targetConcurrentRequests = Math.max(
              minTargetConcurrentRequests,
              targetConcurrentRequests - 1
            );
            lastScaleoutTime = performance.now();
          } else if (
            currentRequests >= targetConcurrentRequests &&
            rollingAverage < targetResponseTime / targetTimeHysteresis
          ) {
            targetConcurrentRequests = Math.min(
              maxTargetConcurrentRequests,
              targetConcurrentRequests + 1
            );
            lastScaleoutTime = performance.now();
          }
        }
      })
      .catch((err) => {
        console.error(`Request ${requestNumber} failed:`, err.message);
      })
      .finally(() => {
        currentRequests -= 1;
        res();
      });
  });
}

async function loadTest() {
  for (let i = 0; i < numberOfRequests; i++) {
    makeRequest(i);
    while (currentRequests >= targetConcurrentRequests) {
      await sleep(10);
    }
  }
}

loadTest();
