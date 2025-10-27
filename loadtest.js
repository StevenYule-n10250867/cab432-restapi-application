const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { performance } = require("perf_hooks");
const crypto = require("crypto");
const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} = require("@aws-sdk/client-cognito-identity-provider");

const apiEndpoint = "http://54.253.38.233:3000/jobs/load";
const cognitoRegion = "ap-southeast-2";
const clientId = "4rrngtjump7gjqc90lg46m4jnl";
const clientSecret = "hjk5dngq7uusequ06eic17c55k16uaj711hf0lg9slrrgnnqb9r";
const username = "adminuser";
const password = "TestPass123!";

// Adjust these to simulate a trickling load
const totalRequests = 24;
const delayBetweenRequests = 10000; // 3 seconds per request (adjust to trigger scale-out)

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

  async function sendTranscodeRequest(i, token) {
    const start = performance.now();
    const payload = {
    filename: "sample-30s.mp4",
    count: 1
  };

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

    if (!res.ok) {
      const text = await res.text();
      console.error(`Request ${i} failed (${res.status}): ${text}`);
    } else {
      const data = await res.json().catch(() => ({}));
      console.log(
        `Request ${i} completed in ${duration.toFixed(2)}ms | jobId: ${data.jobId}`
      );
    }
  } catch (err) {
    console.error(`Request ${i} error: ${err.message}`);
  }
}

(async () => {
  const token = await getJwtToken();
  console.log("Starting trickle load test...");

  for (let i = 0; i < totalRequests; i++) {
    sendTranscodeRequest(i + 1, token);
    await new Promise((resolve) => setTimeout(resolve, delayBetweenRequests));
  }
})();
