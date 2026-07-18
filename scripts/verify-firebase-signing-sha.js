#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = process.cwd();
const variant = ['debug', 'qa', 'release'].includes(process.env.FIREBASE_SIGNING_VARIANT)
  ? process.env.FIREBASE_SIGNING_VARIANT
  : 'debug';
const packageName = variant === 'qa' ? 'com.lousa.moon.qa' : 'com.lousa.moon';
const configPath = path.join(root, 'android/app/google-services.json');

function stop(message, details = []) {
  console.error(`verify:firebase-signing-sha FAILED (${variant}, ${packageName})`);
  console.error(`- ${message}`);
  details.forEach((line) => console.error(`- ${line}`));
  process.exit(1);
}
function normalizeSha(value) {
  return String(value || '').replace(/[^a-fA-F0-9]/g, '').toLowerCase();
}
function colonSha(value) {
  return normalizeSha(value).toUpperCase().match(/.{1,2}/g)?.join(':') || '';
}
function properties(file) {
  return Object.fromEntries(
    fs.readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      }),
  );
}

if (!fs.existsSync(configPath)) stop('android/app/google-services.json is missing.');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const client = config.client?.find(
  (item) => item.client_info?.android_client_info?.package_name === packageName,
);
if (!client) stop(`Firebase config has no Android client for ${packageName}.`);

let keystore;
let alias;
let storePass;
let keyPass;
if (variant === 'release') {
  const propertiesPath = path.join(root, 'android/keystore.properties');
  if (!fs.existsSync(propertiesPath)) stop('android/keystore.properties is missing.');
  const values = properties(propertiesPath);
  if (!values.storeFile || !values.keyAlias || !values.storePassword || !values.keyPassword) {
    stop('android/keystore.properties is incomplete.');
  }
  keystore = path.isAbsolute(values.storeFile)
    ? values.storeFile
    : path.resolve(root, 'android', 'app', values.storeFile);
  alias = values.keyAlias;
  storePass = values.storePassword;
  keyPass = values.keyPassword;
} else {
  keystore = process.env.ANDROID_DEBUG_KEYSTORE || path.join(os.homedir(), '.android', 'debug.keystore');
  alias = 'androiddebugkey';
  storePass = 'android';
  keyPass = 'android';
}
if (!fs.existsSync(keystore)) {
  stop(`Signing keystore is missing: ${keystore}`, [
    variant === 'release'
      ? 'Provide the private release keystore.'
      : 'Run bash scripts/ensure-standard-debug-keystore.sh, then add its SHA-1 and SHA-256 to Firebase.',
  ]);
}

let output;
try {
  output = execFileSync('keytool', [
    '-list', '-v', '-alias', alias, '-keystore', keystore,
    '-storepass', storePass, '-keypass', keyPass,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch {
  stop(`keytool could not read the ${variant} keystore.`);
}
const sha1 = normalizeSha(output.match(/SHA1:\s*([^\r\n]+)/i)?.[1]);
const sha256 = output.match(/SHA256:\s*([^\r\n]+)/i)?.[1]?.trim() || '';
if (!sha1) stop('SHA-1 was not found in keytool output.');

const configuredHashes = (client.oauth_client || [])
  .filter((item) => item.client_type === 1)
  .map((item) => normalizeSha(item.android_info?.certificate_hash))
  .filter(Boolean);
if (!configuredHashes.includes(sha1)) {
  stop(`Firebase does not contain the SHA-1 of the key that will sign this APK.`, [
    `Package: ${packageName}`,
    `SHA-1: ${colonSha(sha1)}`,
    `SHA-256: ${sha256}`,
    'Add both fingerprints in Firebase Console, download a new google-services.json, and replace both project copies.',
  ]);
}

console.log(`verify:firebase-signing-sha PASS (${variant}, ${packageName})`);
console.log(`SHA-1: ${colonSha(sha1)}`);
console.log(`SHA-256: ${sha256}`);
