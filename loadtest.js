// loadtest.js
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { performance } = require("perf_hooks");
const crypto = require("crypto");
const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} = require("@aws-sdk/client-cognito-identity-provider");

const apiEndpoint = "http://<your-api-public-ip>:3000/jobs/transcode";
const cognitoRegion = "ap-southeast-2";
const clientId = "4rrngtjump7gjqc90lg46m4jnl";
const clientSecret = "hjk5dngq7uusequ06eic17c55k16uaj711hf0lg9slrrgnnqb9r";
const username = "adminuser";
const password = "<your-password>";

const numberOfRequests = 25;
const maxConcurrentRequests = 5;
const testFilename = "sample-30s.mp4";

let currentRequests = 0;
let rollingAverage = 1000;

function generateSecretHash(username) {
  return crypto.createHmac("SHA256", clientSecret).update(username + clientId).digest("base64");
}

async function getJwtToken() {
  const client = new CognitoIdentityProviderClient({ region: cognitoRegion });
  const command = new InitiateAuthCommand({
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: clientId,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
      SECRET_HASH: generateSecretHash(username),
    },
  });
  const response = await client.send(command);
  return response.AuthenticationResult.IdToken;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendTranscodeRequest(i, token) {
  currentRequests++;
  const start = performance.now();
  const payload = { filename: testFilename };

  try {
    const res = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
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
        `Request ${i} completed in ${duration.toFixed(2)}ms | rolling avg: ${rollingAverage.toFixed(
          2
        )}ms | jobId: ${data.jobId}`
      );
    }
  } catch (err) {
    console.error(`Request ${i} error: ${err.message}`);
  } finally {
    currentRequests--;
  }
}

(async () => {
  const token = await getJwtToken();
  console.log("JWT token obtained");
  console.log(`Sending ${numberOfRequests} requests to ${apiEndpoint}`);

  for (let i = 0; i < numberOfRequests; i++) {
    while (currentRequests >= maxConcurrentRequests) {
      await sleep(50);
    }
    sendTranscodeRequest(i, token);
  }
})();
