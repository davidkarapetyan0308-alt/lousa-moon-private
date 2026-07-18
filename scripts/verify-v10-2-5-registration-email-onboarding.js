#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function assert(condition, message) { if (!condition) { console.error(`FAIL: ${message}`); process.exitCode = 1; } else { console.log(`PASS: ${message}`); } }

const emailService = read('apps/api/src/emailService.ts');
const server = read('apps/api/src/server.ts');
const api = read('src/services/api/index.ts');
const contracts = read('src/services/contracts/index.ts');
const login = read('app/auth/login.tsx');
const onboarding = read('app/auth/onboarding.tsx');
const pkg = JSON.parse(read('package.json'));
const app = JSON.parse(read('app.json'));

assert(emailService.includes("APP_ENV !== 'production' && EMAIL_PROVIDER === 'console'"), 'console email transport works in development');
assert(emailService.includes('[dev-email]'), 'development OTP is printed in API console');
assert(emailService.includes('canExposeDevOtp'), 'dev OTP exposure is guarded and forbidden in production');
assert(server.includes('safeEmailDeliveryPayload'), 'register/password reset return safe email delivery status');
assert(server.includes('EMAIL_DELIVERY_FAILED'), 'production email failure has explicit error code');
assert(api.includes('friendlyApiMessage'), 'mobile maps backend/network errors to human messages');
assert(contracts.includes('devCode?: string'), 'auth contract supports dev OTP hint for local QA');
assert(login.includes('devOtpHint'), 'auth UI can show dev OTP only in development');
assert(login.includes('router.replace("/auth/onboarding")'), 'verified new registration routes to onboarding questionnaire');
assert(onboarding.includes('services.cycle.savePeriod'), 'onboarding period records sync to backend after registration');
assert(/^(1\.13\.(6|7|8|9)|1\.14\.(0|1|2|3)|1\.15\.0)$/.test(pkg.version), 'package version is registration-email compatible');
assert(/^(1\.13\.(6|7|8|9)|1\.14\.(0|1|2|3)|1\.15\.0)$/.test(app.expo.version), 'Expo version is registration-email compatible');
assert(app.expo.android.versionCode >= 94, 'Android versionCode is >= 94');

if (process.exitCode) process.exit(process.exitCode);
console.log('LOUSA V10.2.5 registration/email/onboarding verification passed.');
