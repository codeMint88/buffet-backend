import crypto from "crypto";

export function generateCrypto(length) {
  return crypto
    .randomBytes(length)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "") // Keep only alphanumeric characters
    .slice(0, length);
}

// const ACCESS_TOKEN_SECRET = generateCrypto(70);
// const REFRESH_TOKEN_SECRET = generateCrypto(70);

// console.log("ACCESS_TOKEN_SECRET:", ACCESS_TOKEN_SECRET);
// console.log("REFRESH_TOKEN_SECRET:", REFRESH_TOKEN_SECRET);
