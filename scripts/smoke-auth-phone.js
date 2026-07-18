#!/usr/bin/env node
const fs = require('node:fs');
const login = fs.readFileSync('app/auth/login.tsx', 'utf8');
const server = fs.readFileSync('apps/api/src/server.ts', 'utf8');
const schema = fs.readFileSync('apps/api/prisma/schema.prisma', 'utf8');
for (const fragment of ['continuePhone', 'handlePhoneStart', 'handleVerifyPhone', '/v1/auth/phone/start', '/v1/auth/phone/verify', 'PhoneVerification']) {
  if (!login.includes(fragment) && !server.includes(fragment) && !schema.includes(fragment)) {
    console.error(`FAIL: missing phone auth fragment ${fragment}`);
    process.exit(1);
  }
}
if (server.includes('return json(req, res, 200, { devCode: code')) {
  console.error('FAIL: phone OTP is returned directly without dev gate.');
  process.exit(1);
}
console.log('PASS: phone auth smoke contract is present.');
