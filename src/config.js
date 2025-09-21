// src/config.js
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

const region = process.env.AWS_REGION || "ap-southeast-2";

// Clients
const ssmClient = new SSMClient({ region });
const secretsClient = new SecretsManagerClient({ region });

// --- Helpers ---
async function getParam(name, withDecryption = false) {
  try {
    const res = await ssmClient.send(
      new GetParameterCommand({ Name: name, WithDecryption: withDecryption })
    );
    return res.Parameter.Value;
  } catch (err) {
    console.warn(`Failed to fetch ${name} from SSM, falling back: ${err.message}`);
    return null;
  }
}

async function getSecret(name) {
  try {
    const res = await secretsClient.send(new GetSecretValueCommand({ SecretId: name }));
    if (res.SecretString) {
      return res.SecretString;
    }
    return null;
  } catch (err) {
    console.warn(`Failed to fetch ${name} from Secrets Manager, falling back: ${err.message}`);
    return null;
  }
}

// --- Loader ---
async function loadConfig() {
  return {
    AWS_REGION:
      (await getParam("/n10250867/AWS_REGION")) ||
      process.env.AWS_REGION,

    AWS_S3_BUCKET:
      (await getParam("/n10250867/AWS_S3_BUCKET")) ||
      process.env.AWS_S3_BUCKET,

    COGNITO_USER_POOL_ID:
      (await getParam("/n10250867/COGNITO_USER_POOL_ID")) ||
      process.env.COGNITO_USER_POOL_ID,

    COGNITO_CLIENT_ID:
      (await getParam("/n10250867/COGNITO_CLIENT_ID")) ||
      process.env.COGNITO_CLIENT_ID,

    COGNITO_CLIENT_SECRET:
      (await getParam("/n10250867/COGNITO_CLIENT_SECRET", true)) ||
      process.env.COGNITO_CLIENT_SECRET,

    JWT_SECRET:
      (await getSecret("/n10250867/JWT_SECRET")) ||
      process.env.JWT_SECRET
  };

  if (config.COGNITO_CLIENT_SECRET === process.env.COGNITO_CLIENT_SECRET) {
    console.log("Using COGNITO_CLIENT_SECRET from .env fallback");
  }
  if (config.JWT_SECRET === process.env.JWT_SECRET) {
    console.log("Using JWT_SECRET from .env fallback");
  }

  return config;
}

module.exports = { loadConfig };
