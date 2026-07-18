#!/usr/bin/env node
const fs = require('node:fs');
const login = fs.readFileSync('app/auth/login.tsx', 'utf8');
const api = fs.readFileSync('src/services/api/index.ts', 'utf8');
const server = fs.readFileSync('apps/api/src/server.ts', 'utf8');
for (const fragment of ['requestRegistrationCode', 'handleVerify', '/v1/auth/register', '/v1/auth/verify-email', 'EMAIL_DELIVERY_FAILED']) {
  if (!login.includes(fragment) && !api.includes(fragment) && !server.includes(fragment)) {
    console.error(`FAIL: missing email auth fragment ${fragment}`);
    process.exit(1);
  }
}
console.log('PASS: email auth smoke contract is present.');
