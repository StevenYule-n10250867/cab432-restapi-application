// src/middleware/authmiddleware.js
const jwt = require('jsonwebtoken');
const jwkToPem = require('jwk-to-pem');
const fetch = require('node-fetch');

const jwksUrl = `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`;

let pems;

async function getPems() {
  if (!pems) {
    const res = await fetch(jwksUrl);
    const { keys } = await res.json();
    pems = {};
    keys.forEach(k => {
      pems[k.kid] = jwkToPem(k);
    });
  }
  return pems;
}

// Standard authentication middleware
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.sendStatus(401);

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded) return res.sendStatus(401);

    const pems = await getPems();
    const pem = pems[decoded.header.kid];
    if (!pem) return res.sendStatus(401);

    jwt.verify(token, pem, { algorithms: ['RS256'] }, (err, decoded) => {
      if (err) return res.sendStatus(403);
      req.user = decoded;
      next();
    });
  } catch (err) {
    console.error(err);
    return res.sendStatus(401);
  }
}

// Group enforcement helper
function requireGroup(group) {
  return (req, res, next) => {
    if (!req.user) return res.sendStatus(401);
    const groups = req.user['cognito:groups'] || [];
    if (!groups.includes(group)) {
      return res.status(403).json({ error: `${group} access required` });
    }
    next();
  };
}

module.exports = { authMiddleware, requireGroup };
