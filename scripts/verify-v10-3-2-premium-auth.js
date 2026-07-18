#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const fail = (message) => { console.error(`FAIL: ${message}`); process.exit(1); };
const assert = (cond, msg) => { if (!cond) fail(msg); };

const login = read('app/auth/login.tsx');
const server = read('apps/api/src/server.ts');
const contracts = read('src/services/contracts/index.ts');
const api = read('src/services/api/index.ts');
const errors = read('src/services/errorMessages.ts');
const env = read('.env.example');
const pkg = read('package.json');
const appJson = read('app.json');
const appConfig = read('app.config.js');

[
  'src/features/auth/components/PremiumAuthShell.tsx',
  'src/features/auth/components/AuthTopBar.tsx',
  'src/features/auth/components/AuthCard.tsx',
  'src/features/auth/components/AuthTextField.tsx',
  'src/features/auth/components/AuthPasswordField.tsx',
  'src/features/auth/components/AuthProviderButton.tsx',
  'src/features/auth/components/AuthErrorBanner.tsx',
  'src/features/auth/components/AuthDivider.tsx',
  'src/features/auth/components/AuthLegalText.tsx',
  'LOUSA_V10_3_2_IMPLEMENTATION_REPORT_RU.md',
  'LOUSA_V10_3_2_DEVICE_QA_CHECKLIST_RU.md',
  'LOUSA_V10_3_2_GOOGLE_AUTH_SETUP_RU.md',
  'LOUSA_V10_3_2_PHONE_AUTH_SETUP_RU.md',
  'LOUSA_V10_3_2_KNOWN_LIMITATIONS_RU.md',
  'LOUSA_V10_3_2_HONEST_SCORE_RU.md',
].forEach((file) => assert(exists(file), `${file} is missing`));

assert(login.includes('PremiumAuthShell'), 'auth route must use PremiumAuthShell');
assert(login.includes('continuePhone'), 'phone auth button copy is missing');
assert(login.includes('mode === "phone"'), 'PhoneAuthScreen state is missing');
assert(login.includes('mode === "verifyPhone"'), 'VerifyPhoneScreen state is missing');
assert(login.includes('handlePhoneStart') && login.includes('handleVerifyPhone'), 'phone auth handlers are missing');
assert(!login.includes('marginTop: -120'), 'forbidden layout hack found');
assert(!login.includes('justifyContent: "center",\n    paddingTop: 8,\n    paddingBottom: 56'), 'old welcome vertical centering returned');

assert(contracts.includes('startPhoneAuth?') && contracts.includes('verifyPhoneAuth?'), 'AuthService phone contract is missing');
assert(api.includes('/v1/auth/phone/start') && api.includes('/v1/auth/phone/verify'), 'mobile API phone endpoints are missing');
assert(server.includes("pathname === '/v1/auth/phone/start'") && server.includes("pathname === '/v1/auth/phone/verify'"), 'backend phone auth endpoints are missing');
assert(server.includes('phoneVerification.create') && server.includes('hashSecret(code, 32)'), 'phone OTP must be hashed in database');
assert(server.includes('canExposeDevOtp() ? { devCode') && server.includes("env.appEnv === 'production'"), 'dev OTP exposure must be gated');
assert(server.includes('GOOGLE_AUTH_NOT_CONFIGURED'), 'Google auth setup error is missing');
assert(errors.includes('GOOGLE_AUTH_NOT_CONFIGURED') && errors.includes('SMS_DELIVERY_FAILED') && errors.includes('INVALID_PHONE_OTP'), 'error mapper lacks Google/SMS codes');
assert(env.includes('SMS_PROVIDER=console') && env.includes('TWILIO_ACCOUNT_SID') && env.includes('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID'), '.env.example missing auth provider variables');
assert(pkg.includes('"version": "1.15.0"'), 'package version must be 1.15.0');
assert(appJson.includes('"version": "1.15.0"') && appJson.includes('"versionCode": 102'), 'app.json version/code must be 1.15.0/102');
assert(appConfig.includes("version: '1.15.0'") && appConfig.includes('versionCode: 102'), 'app.config.js version/code must be 1.15.0/102');

const rawUiErrors = ['Network request failed', 'TypeError', '[object Object]'];
rawUiErrors.forEach((fragment) => {
  assert(!login.includes(`>${fragment}<`), `raw UI error ${fragment} found in auth screen`);
});

console.log('PASS: LOUSA V10.3.2 Premium Auth System & Phone Login Lockdown verification passed.');
