const express = require('express');
const {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand
} = require('@aws-sdk/client-cognito-identity-provider');
const crypto = require('crypto');

const router = express.Router();

const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
const ClientId = process.env.COGNITO_CLIENT_ID;
const ClientSecret = process.env.COGNITO_CLIENT_SECRET;

// helper to generate Cognito secret hash
function generateSecretHash(username) {
  return crypto
    .createHmac('SHA256', ClientSecret)
    .update(username + ClientId)
    .digest('base64');
}

// -----------------------------
// Register new user
// -----------------------------
router.post('/register', async (req, res) => {
  const { username, password, email } = req.body;
  try {
    const command = new SignUpCommand({
      ClientId,
      Username: username,
      Password: password,
      SecretHash: generateSecretHash(username),
      UserAttributes: [{ Name: 'email', Value: email }]
    });
    const response = await client.send(command);
    res.json({ message: 'User registered, check email for confirmation code', data: response });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

// -----------------------------
// Confirm user registration
// -----------------------------
router.post('/confirm', async (req, res) => {
  const { username, code } = req.body;
  try {
    const command = new ConfirmSignUpCommand({
      ClientId,
      Username: username,
      ConfirmationCode: code,
      SecretHash: generateSecretHash(username)
    });
    await client.send(command);
    res.json({ message: 'User confirmed successfully' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

// -----------------------------
// Login
// -----------------------------
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
        SECRET_HASH: generateSecretHash(username)
      }
    });
    const response = await client.send(command);
    res.json({ token: response.AuthenticationResult.IdToken });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
