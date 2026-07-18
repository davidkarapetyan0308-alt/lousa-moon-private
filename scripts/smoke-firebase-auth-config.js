#!/usr/bin/env node
const fs = require('node:fs');
const crypto = require('node:crypto');

const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
const read = (file) => fs.readFileSync(file, 'utf8');
const parse = (file) => JSON.parse(read(file));
const digest = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

for (const file of ['google-services.json', 'android/app/google-services.json']) {
  assert(fs.existsSync(file), `${file} is missing`);
}

if (!failures.length) {
  const rootConfig = parse('google-services.json');
  assert(digest('google-services.json') === digest('android/app/google-services.json'), 'Firebase config copies are different');
  assert(rootConfig.project_info?.project_id === 'lousa-moon', 'Firebase project_id must be lousa-moon');
  for (const packageName of ['com.lousa.moon', 'com.lousa.moon.qa']) {
    const client = rootConfig.client?.find(
      (item) => item.client_info?.android_client_info?.package_name === packageName,
    );
    assert(Boolean(client), `Firebase Android client ${packageName} is missing`);
    assert(Boolean(client?.client_info?.mobilesdk_app_id), `${packageName}: Firebase Android app ID is missing`);
    assert(Boolean(client?.api_key?.[0]?.current_key), `${packageName}: Firebase Android API key is missing`);
    assert(Boolean(client?.oauth_client?.some((item) => item.client_type === 3)), `${packageName}: Firebase Web OAuth client (client_type=3) is missing`);
  }
}

const rootGradle = read('android/build.gradle');
const appGradle = read('android/app/build.gradle');
const appConfig = read('app.config.js');
const services = read('src/services/index.ts');
const firebaseAuth = read('src/services/firebase/firebaseAuth.ts');
const server = read('apps/api/src/server.ts');
assert(rootGradle.includes('com.google.gms:google-services:4.5.0'), 'Google Services Gradle classpath is missing');
assert(appGradle.includes('apply plugin: "com.google.gms.google-services"'), 'Google Services app plugin is missing');
assert(appGradle.includes('applicationIdSuffix ".qa"'), 'Standalone QA package suffix is missing');
assert(appGradle.includes('debuggable false'), 'QA APK must be non-debuggable so JS is bundled');
assert(appConfig.includes('QA_ANDROID_PACKAGE') && appConfig.includes('LOUSA_BUILD_VARIANT'), 'app.config.js is not QA-package aware');
assert(services.includes("process.env.EXPO_PUBLIC_AUTH_PROVIDER || 'firebase'"), 'Firebase is not the default mobile auth provider');
assert(firebaseAuth.includes('FIREBASE_EMAIL_NOT_VERIFIED'), 'Firebase email verification gate is missing');
assert(firebaseAuth.includes('EXPO_PUBLIC_FIREBASE_AUTH_ACTION_URL'), 'Firebase auth action URL is not wired into email actions');
assert(firebaseAuth.includes('FIREBASE_PHONE_UNAVAILABLE'), 'Friendly unavailable-region Phone Auth handling is missing');
assert(server.includes("provider === 'password' && !decoded.email_verified"), 'Backend does not reject unverified Firebase password users');
assert(server.includes('LEGACY_AUTH_DISABLED'), 'Backend legacy auth routes are not disabled');
assert(server.includes("server.listen(env.port, env.apiHost"), 'Backend is not explicitly listening on the configured LAN host');

if (failures.length) {
  console.error('smoke:firebase-auth-config FAILED');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('smoke:firebase-auth-config PASS');
console.log('Firebase project: lousa-moon');
console.log('Android packages: com.lousa.moon, com.lousa.moon.qa');
