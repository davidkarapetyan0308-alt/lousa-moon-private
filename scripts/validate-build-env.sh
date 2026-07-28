#!/usr/bin/env bash
set -euo pipefail

VARIANT="${1:-qa}"
case "$VARIANT" in
  qa) EXPECTED_PACKAGE="com.lousa.moon.qa" ;;
  production|prod|release) VARIANT="production"; EXPECTED_PACKAGE="com.lousa.moon" ;;
  *) echo "Usage: scripts/validate-build-env.sh <qa|production>" >&2; exit 2 ;;
esac

node - "$VARIANT" "$EXPECTED_PACKAGE" <<'NODE'
const fs = require('node:fs');
const crypto = require('node:crypto');
const net = require('node:net');

const variant = process.argv[2];
const expectedPackage = process.argv[3];
const errors = [];
const fail = (message) => errors.push(message);
const value = (name) => String(process.env[name] || '').trim();

function parseRequiredUrl(name, raw) {
  if (!raw) {
    fail(`${name} is required.`);
    return null;
  }
  let parsed;
  try { parsed = new URL(raw); }
  catch { fail(`${name} is not a valid URL: ${raw}`); return null; }
  if (parsed.protocol !== 'https:') fail(`${name} must use HTTPS for a distributable APK.`);
  if (parsed.username || parsed.password) fail(`${name} must not contain URL credentials.`);
  if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
    // Allowed, but normalize equality below.
  }
  validatePublicHost(name, parsed.hostname);
  return parsed;
}

function validatePublicHost(name, host) {
  const lower = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (!lower) return fail(`${name} has an empty hostname.`);
  if (['localhost', 'localhost.localdomain', '0.0.0.0', '127.0.0.1', '::1', '10.0.2.2'].includes(lower) || lower.endsWith('.local')) {
    return fail(`${name} uses a forbidden local hostname: ${host}`);
  }
  const family = net.isIP(lower);
  if (family === 4) {
    const p = lower.split('.').map(Number);
    const privateV4 = p[0] === 10 || p[0] === 127 || (p[0] === 169 && p[1] === 254) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || p[0] === 0;
    if (privateV4) fail(`${name} uses a forbidden private/local IPv4 address: ${host}`);
  }
  if (family === 6 && (lower === '::1' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd'))) {
    fail(`${name} uses a forbidden local/private IPv6 address: ${host}`);
  }
}

const api = parseRequiredUrl('EXPO_PUBLIC_LOUSA_API_URL', value('EXPO_PUBLIC_LOUSA_API_URL'));
const publicApi = parseRequiredUrl('PUBLIC_API_URL', value('PUBLIC_API_URL'));
if (api && publicApi) {
  const normalize = (u) => u.toString().replace(/\/$/, '');
  if (normalize(api) !== normalize(publicApi)) {
    fail('EXPO_PUBLIC_LOUSA_API_URL and PUBLIC_API_URL must point to the same backend.');
  }
}

if ((value('EXPO_PUBLIC_APP_MODE') || 'api') !== 'api') fail('EXPO_PUBLIC_APP_MODE must be api.');
if ((value('EXPO_PUBLIC_AUTH_PROVIDER') || 'firebase') !== 'firebase') fail('EXPO_PUBLIC_AUTH_PROVIDER must be firebase.');

const actionUrl = value('EXPO_PUBLIC_FIREBASE_AUTH_ACTION_URL');
if (variant === 'production') {
  const action = parseRequiredUrl('EXPO_PUBLIC_FIREBASE_AUTH_ACTION_URL', actionUrl);
  if (action && (/\.example$/i.test(action.hostname) || /replace/i.test(action.toString()))) {
    fail('EXPO_PUBLIC_FIREBASE_AUTH_ACTION_URL still contains a placeholder.');
  }
} else if (actionUrl) {
  parseRequiredUrl('EXPO_PUBLIC_FIREBASE_AUTH_ACTION_URL', actionUrl);
}

function sha(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
const configs = ['google-services.json', 'android/app/google-services.json'];
for (const file of configs) {
  if (!fs.existsSync(file)) { fail(`${file} is missing.`); continue; }
  try {
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (json.project_info?.project_id !== 'lousa-moon') fail(`${file}: Firebase project_id must be lousa-moon.`);
    for (const pkg of ['com.lousa.moon', 'com.lousa.moon.qa']) {
      const client = json.client?.find((x) => x.client_info?.android_client_info?.package_name === pkg);
      if (!client) fail(`${file}: missing Firebase Android client ${pkg}.`);
      if (client && !client.oauth_client?.some((x) => x.client_type === 3)) fail(`${file}: ${pkg} is missing OAuth web client_type=3.`);
    }
    if (!json.client?.some((x) => x.client_info?.android_client_info?.package_name === expectedPackage)) {
      fail(`${file}: selected build package ${expectedPackage} is missing.`);
    }
  } catch (error) { fail(`${file}: invalid JSON (${error.message}).`); }
}
if (configs.every(fs.existsSync) && sha(configs[0]) !== sha(configs[1])) {
  fail('Root and android/app google-services.json copies are not byte-identical.');
}

for (const file of [
  'package-lock.json',
  'android/gradlew',
  'android/gradle/wrapper/gradle-wrapper.jar',
  'android/gradle/wrapper/gradle-wrapper.properties',
]) {
  if (!fs.existsSync(file)) fail(`${file} is missing.`);
}

if (errors.length) {
  console.error(`BUILD ENV VALIDATION FAILED (${variant})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`BUILD ENV VALIDATION PASS (${variant})`);
console.log(`Package: ${expectedPackage}`);
console.log(`Backend: ${api.toString().replace(/\/$/, '')}`);
console.log('Firebase project: lousa-moon');
NODE
