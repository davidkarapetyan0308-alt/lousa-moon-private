#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const variant = process.argv[2] || process.env.LOUSA_BUILD_VARIANT || 'qa';
const expected = variant === 'qa'
  ? { packageName: 'com.lousa.moon.qa', signing: 'qa' }
  : { packageName: 'com.lousa.moon', signing: 'release' };
const root = process.cwd();
const configPaths = ['google-services.json', 'android/app/google-services.json'];
const failures = [];
const normalize = (value) => String(value || '').replace(/[^a-fA-F0-9]/g, '').toLowerCase();
const colon = (value) => normalize(value).toUpperCase().match(/.{1,2}/g)?.join(':') || '';

function readProperties(file) {
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/)
    .map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim()]; }));
}

function signingConfig() {
  if (expected.signing === 'qa') {
    return {
      keystore: process.env.LOUSA_QA_KEYSTORE_PATH || process.env.ANDROID_DEBUG_KEYSTORE || path.join(os.homedir(), '.android', 'debug.keystore'),
      alias: process.env.LOUSA_QA_KEY_ALIAS || 'androiddebugkey',
      storePass: process.env.LOUSA_QA_KEYSTORE_PASSWORD || 'android',
      keyPass: process.env.LOUSA_QA_KEY_PASSWORD || process.env.LOUSA_QA_KEYSTORE_PASSWORD || 'android',
    };
  }
  const propertiesPath = path.join(root, 'android/keystore.properties');
  if (!fs.existsSync(propertiesPath)) {
    failures.push('android/keystore.properties is required to verify production OAuth signing.');
    return null;
  }
  const props = readProperties(propertiesPath);
  return {
    keystore: path.isAbsolute(props.storeFile || '') ? props.storeFile : path.resolve(root, 'android', 'app', props.storeFile || ''),
    alias: props.keyAlias, storePass: props.storePassword, keyPass: props.keyPassword,
  };
}

const signing = signingConfig();
let sha1 = '';
let sha256 = '';
if (signing) {
  if (!fs.existsSync(signing.keystore)) failures.push(`Signing keystore is missing: ${signing.keystore}`);
  else {
    try {
      const output = execFileSync('keytool', ['-list', '-v', '-alias', signing.alias, '-keystore', signing.keystore, '-storepass', signing.storePass, '-keypass', signing.keyPass], { encoding: 'utf8' });
      sha1 = normalize(output.match(/SHA1:\s*([^\r\n]+)/i)?.[1]);
      sha256 = normalize(output.match(/SHA256:\s*([^\r\n]+)/i)?.[1]);
      if (!sha1 || !sha256) failures.push('keytool output does not contain SHA-1/SHA-256.');
    } catch (error) {
      failures.push(`keytool failed: ${error.message}`);
    }
  }
}

let webClientId = '';
const matrix = [];
for (const relative of configPaths) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) { failures.push(`${relative} is missing.`); continue; }
  let payload;
  try { payload = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { failures.push(`${relative} is invalid JSON: ${error.message}`); continue; }
  if (payload.project_info?.project_id !== 'lousa-moon') failures.push(`${relative}: project_id must be lousa-moon.`);
  const client = payload.client?.find((item) => item.client_info?.android_client_info?.package_name === expected.packageName);
  if (!client) { failures.push(`${relative}: Android client ${expected.packageName} is missing.`); continue; }
  const webClients = (client.oauth_client || []).filter((item) => item.client_type === 3 && /\.apps\.googleusercontent\.com$/.test(item.client_id || ''));
  if (webClients.length !== 1) failures.push(`${relative}: expected exactly one valid Web OAuth client for ${expected.packageName}.`);
  if (webClients[0]) {
    if (webClientId && webClientId !== webClients[0].client_id) failures.push('Web OAuth client differs between google-services.json copies.');
    webClientId = webClients[0].client_id;
  }
  const androidHashes = (client.oauth_client || []).filter((item) => item.client_type === 1)
    .map((item) => normalize(item.android_info?.certificate_hash)).filter(Boolean);
  const shaMatch = Boolean(sha1 && androidHashes.includes(sha1));
  if (sha1 && !shaMatch) failures.push(`${relative}: installed signing SHA-1 ${colon(sha1)} is not registered for ${expected.packageName}.`);
  matrix.push({ file: relative, packageName: expected.packageName, shaMatch, androidHashes: androidHashes.map(colon), webClientId });
}

const report = [
  '# Google OAuth certificate matrix', '',
  `- Variant: ${variant}`,
  `- Package: ${expected.packageName}`,
  `- Signing: ${expected.signing}`,
  `- APK signing SHA-1: ${colon(sha1) || 'unavailable'}`,
  `- APK signing SHA-256: ${colon(sha256) || 'unavailable'}`,
  `- Web OAuth client: ${webClientId || 'missing'}`, '',
  '| Config | Package | SHA match | Registered SHA-1 values |',
  '|---|---|---:|---|',
  ...matrix.map((row) => `| ${row.file} | ${row.packageName} | ${row.shaMatch ? 'YES' : 'NO'} | ${row.androidHashes.join('<br>')} |`),
  '',
];
fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs/GOOGLE_OAUTH_CERTIFICATE_MATRIX.md'), report.join('\n'));

if (failures.length) {
  console.error('verify:google-oauth-config FAILED');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('verify:google-oauth-config PASS');
console.log(`Package: ${expected.packageName}`);
console.log(`SHA-1: ${colon(sha1)}`);
console.log(`SHA-256: ${colon(sha256)}`);
console.log(`Web client: ${webClientId}`);
