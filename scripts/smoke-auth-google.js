#!/usr/bin/env node
const fs = require('node:fs');
const native = fs.readFileSync('src/services/nativeGoogleSignIn.ts', 'utf8');
const api = fs.readFileSync('src/services/api/index.ts', 'utf8');
const server = fs.readFileSync('apps/api/src/server.ts', 'utf8');
for (const fragment of ['EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID', '/v1/auth/google', 'GOOGLE_AUTH_NOT_CONFIGURED', 'verifyIdToken']) {
  if (!native.includes(fragment) && !api.includes(fragment) && !server.includes(fragment)) {
    console.error(`FAIL: missing Google auth fragment ${fragment}`);
    process.exit(1);
  }
}
console.log('PASS: Google auth smoke contract is present.');
