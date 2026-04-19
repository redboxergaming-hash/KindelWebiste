const crypto = require("crypto");

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function normalizePrivateKey(privateKey) {
  return String(privateKey || "").replace(/\\n/g, "\n").trim();
}

function buildServiceAccountJwt({ clientEmail, privateKey, scope, nowEpochSec }) {
  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const payload = {
    iss: clientEmail,
    scope,
    aud: GOOGLE_TOKEN_URL,
    iat: nowEpochSec,
    exp: nowEpochSec + 3600
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();

  const signature = signer
    .sign(normalizePrivateKey(privateKey), "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${unsignedToken}.${signature}`;
}

async function requestServiceAccountAccessToken({ clientEmail, privateKey, scope, fetchImpl }) {
  const nowEpochSec = Math.floor(Date.now() / 1000);
  let assertion;

  try {
    assertion = buildServiceAccountJwt({
      clientEmail,
      privateKey,
      scope,
      nowEpochSec
    });
  } catch (error) {
    throw new Error("GOOGLE_TOKEN_SIGN_FAILED");
  }

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion
  });

  const response = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error("GOOGLE_TOKEN_REQUEST_FAILED");
  }

  const payload = await response.json();
  if (!payload || !payload.access_token) {
    throw new Error("GOOGLE_TOKEN_INVALID_RESPONSE");
  }

  return payload.access_token;
}

module.exports = {
  requestServiceAccountAccessToken,
  normalizePrivateKey
};
