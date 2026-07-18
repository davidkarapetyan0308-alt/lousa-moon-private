#!/usr/bin/env node
/* eslint-env node */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const qaPackage = 'com.lousa.moon.qa';
const expectedSha1 = (process.env.LOUSA_QA_SHA1 || '7E:6A:30:34:AE:34:F9:B6:C1:D3:23:4B:2A:00:13:45:3A:00:D1:5A')
  .replace(/:/g, '')
  .toLowerCase();
const downloads = path.join(os.homedir(), 'Downloads');

if (!fs.existsSync(downloads)) {
  console.error(`[LOUSA] Downloads directory not found: ${downloads}`);
  process.exit(1);
}

const candidates = fs.readdirSync(downloads)
  .filter((name) => /^google-services.*\.json$/i.test(name))
  .map((name) => {
    const file = path.join(downloads, name);
    return { file, mtime: fs.statSync(file).mtimeMs };
  })
  .sort((a, b) => b.mtime - a.mtime);

function containsQaFingerprint(data) {
  const clients = Array.isArray(data?.client) ? data.client : [];
  const qaClient = clients.find(
    (client) => client?.client_info?.android_client_info?.package_name === qaPackage,
  );
  if (!qaClient) return false;
  return (qaClient.oauth_client || []).some((oauth) => {
    const hash = oauth?.android_info?.certificate_hash;
    return typeof hash === 'string' && hash.replace(/:/g, '').toLowerCase() === expectedSha1;
  });
}

let selected = null;
for (const candidate of candidates) {
  try {
    const data = JSON.parse(fs.readFileSync(candidate.file, 'utf8'));
    if (containsQaFingerprint(data)) {
      selected = candidate.file;
      break;
    }
  } catch {
    // Ignore unrelated or malformed downloads and continue looking.
  }
}

if (!selected) {
  console.error('[LOUSA] No downloaded google-services JSON contains the registered QA SHA-1.');
  console.error(`[LOUSA] Expected package: ${qaPackage}`);
  console.error(`[LOUSA] Expected SHA-1: ${expectedSha1}`);
  console.error('[LOUSA] Download google-services.json again from Firebase after adding QA SHA-1/SHA-256.');
  process.exit(1);
}

const rootTarget = path.join(process.cwd(), 'google-services.json');
const androidTarget = path.join(process.cwd(), 'android', 'app', 'google-services.json');
fs.copyFileSync(selected, rootTarget);
fs.copyFileSync(selected, androidTarget);

const bytes = fs.readFileSync(rootTarget);
const digest = crypto.createHash('sha256').update(bytes).digest('hex');
console.log(`[LOUSA] Installed Firebase config from: ${selected}`);
console.log(`[LOUSA] Root target: ${rootTarget}`);
console.log(`[LOUSA] Android target: ${androidTarget}`);
console.log(`[LOUSA] SHA-256: ${digest}`);
