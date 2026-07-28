const fs = require('node:fs');
const path = require('node:path');

const EXPECTED_VERSION = process.env.LOUSA_EXPECTED_VERSION || '1.18.22';
const EXPECTED_CODE = Number(process.env.LOUSA_EXPECTED_VERSION_CODE || 133);
const errors = [];
const read = (file) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
const app = JSON.parse(read('app.json'));
const config = read('app.config.js');
const gradle = read('android/app/build.gradle');
const manifest = read('SOURCE_PACKAGE_MANIFEST.txt');
const openapi = read('apps/api/openapi.yaml');

function expect(label, actual, expected) {
  if (actual !== expected) errors.push(`${label}: expected ${expected}, got ${actual}`);
}
expect('package.json version', pkg.version, EXPECTED_VERSION);
expect('package-lock.json version', lock.version, EXPECTED_VERSION);
expect('package-lock root version', lock.packages?.['']?.version, EXPECTED_VERSION);
expect('app.json expo.version', app.expo?.version, EXPECTED_VERSION);
expect('app.json android.versionCode', app.expo?.android?.versionCode, EXPECTED_CODE);
if (!new RegExp(`version:\\s*['\"]${EXPECTED_VERSION.replace(/\./g, '\\.') }['\"]`).test(config)) errors.push('app.config.js version mismatch');
if (!new RegExp(`versionCode:\\s*${EXPECTED_CODE}\\b`).test(config)) errors.push('app.config.js versionCode mismatch');
if (!new RegExp(`versionName\\s+['\"]${EXPECTED_VERSION.replace(/\./g, '\\.') }['\"]`).test(gradle)) errors.push('android/app/build.gradle versionName mismatch');
if (!new RegExp(`versionCode\\s+${EXPECTED_CODE}\\b`).test(gradle)) errors.push('android/app/build.gradle versionCode mismatch');
if (!manifest.includes(`Version: ${EXPECTED_VERSION}`)) errors.push('SOURCE_PACKAGE_MANIFEST.txt version mismatch');
if (!manifest.includes(`Android versionCode: ${EXPECTED_CODE}`)) errors.push('SOURCE_PACKAGE_MANIFEST.txt versionCode mismatch');
if (!new RegExp(`^\\s*version:\\s*${EXPECTED_VERSION.replace(/\./g, '\\.') }\\s*$`, 'm').test(openapi)) errors.push('apps/api/openapi.yaml version mismatch');

if (errors.length) {
  console.error('verify:version-consistency FAIL');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log(`verify:version-consistency PASS — ${EXPECTED_VERSION} (${EXPECTED_CODE})`);
