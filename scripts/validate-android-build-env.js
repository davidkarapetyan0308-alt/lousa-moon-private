#!/usr/bin/env node
const fs = require('node:fs');
const { URL } = require('node:url');

const variant = process.argv[2];
const packages = {
  qa: 'com.lousa.moon.qa',
  release: 'com.lousa.moon',
};
if (!packages[variant]) {
  console.error('Usage: node scripts/validate-android-build-env.js <qa|release>');
  process.exit(2);
}

const failures = [];
const fail = (message) => failures.push(message);
const requiredPackage = packages[variant];
const apiUrl = (process.env.EXPO_PUBLIC_LOUSA_API_URL || '').trim().replace(/\/$/, '');
const actionUrl = (process.env.EXPO_PUBLIC_FIREBASE_AUTH_ACTION_URL || '').trim();

function parseUrl(name, value) {
  try {
    return new URL(value);
  } catch {
    fail(`${name} is not a valid URL: ${value || '<empty>'}`);
    return null;
  }
}

if (!apiUrl) {
  fail('EXPO_PUBLIC_LOUSA_API_URL is required. On a phone use http://MAC_LAN_IP:4100 for QA, never localhost.');
} else {
  const parsed = parseUrl('EXPO_PUBLIC_LOUSA_API_URL', apiUrl);
  if (parsed) {
    if (!['http:', 'https:'].includes(parsed.protocol)) fail('EXPO_PUBLIC_LOUSA_API_URL must use http:// or https://.');
    if (['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) fail('localhost is forbidden for an APK installed on a phone. Use the Mac LAN IP or HTTPS API.');
    if (variant === 'release' && parsed.protocol !== 'https:') fail('Release APK requires an HTTPS EXPO_PUBLIC_LOUSA_API_URL.');
  }
}

if (variant === 'release') {
  if (!actionUrl) {
    fail('EXPO_PUBLIC_FIREBASE_AUTH_ACTION_URL is required for release email verification/password reset links.');
  } else {
    const parsed = parseUrl('EXPO_PUBLIC_FIREBASE_AUTH_ACTION_URL', actionUrl);
    if (parsed && parsed.protocol !== 'https:') fail('Release Firebase auth action URL must use HTTPS.');
  }
}

for (const file of ['google-services.json', 'android/app/google-services.json']) {
  if (!fs.existsSync(file)) {
    fail(`${file} is missing.`);
    continue;
  }
  try {
    const config = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (config.project_info?.project_id !== 'lousa-moon') fail(`${file}: project_id must be lousa-moon.`);
    const client = config.client?.find((item) => item.client_info?.android_client_info?.package_name === requiredPackage);
    if (!client) fail(`${file}: Firebase Android client ${requiredPackage} is missing.`);
  } catch (error) {
    fail(`${file}: invalid JSON (${error.message}).`);
  }
}

if ((process.env.EXPO_PUBLIC_APP_MODE || 'api') !== 'api') fail('Real QA/release builds require EXPO_PUBLIC_APP_MODE=api.');
if ((process.env.EXPO_PUBLIC_AUTH_PROVIDER || 'firebase') !== 'firebase') fail('Real QA/release builds require EXPO_PUBLIC_AUTH_PROVIDER=firebase.');

if (failures.length) {
  console.error(`[LOUSA ${variant}] build environment FAILED`);
  failures.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}
console.log(`[LOUSA ${variant}] build environment PASS`);
console.log(`Android package: ${requiredPackage}`);
console.log(`Backend API: ${apiUrl}`);
if (actionUrl) console.log(`Firebase action URL: ${actionUrl}`);
