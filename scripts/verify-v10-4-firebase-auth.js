#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

const pkg = JSON.parse(read('package.json'));
const appJson = read('app.json');
const appConfig = read('app.config.js');
const servicesIndex = read('src/services/index.ts');
const firebaseMobile = read('src/services/firebase/firebaseAuth.ts');
const server = read('apps/api/src/server.ts');
const env = read('apps/api/src/config/env.ts');
const errors = read('src/services/errorMessages.ts');
const envExample = read('.env.example');
const rootGradle = read('android/build.gradle');
const appGradle = read('android/app/build.gradle');
const googleServices = exists('google-services.json') ? JSON.parse(read('google-services.json')) : null;
const androidGoogleServices = exists('android/app/google-services.json') ? JSON.parse(read('android/app/google-services.json')) : null;

assert(pkg.version === '1.15.1', 'package.json must be version 1.15.1');
assert(pkg.dependencies['@react-native-firebase/app'], '@react-native-firebase/app dependency missing');
assert(pkg.dependencies['@react-native-firebase/auth'], '@react-native-firebase/auth dependency missing');
assert(pkg.dependencies['firebase-admin'], 'firebase-admin dependency missing');
assert(appJson.includes('"version": "1.15.1"') && appJson.includes('"versionCode": 103'), 'app.json version/versionCode not updated');
assert(appJson.includes('@react-native-firebase/app') && appJson.includes('@react-native-firebase/auth'), 'Firebase Expo config plugins missing');
assert(appJson.includes('googleServicesFile'), 'android googleServicesFile missing');
assert(appConfig.includes("version: '1.15.1'") && appConfig.includes('versionCode: 103'), 'app.config.js version/code not updated');
assert(appConfig.includes('googleServicesFile'), 'app.config.js googleServicesFile missing');
assert(appConfig.includes('QA_ANDROID_PACKAGE') && appConfig.includes('LOUSA_BUILD_VARIANT'), 'app.config.js QA package switching missing');
assert(servicesIndex.includes('getAuthProviderMode') && servicesIndex.includes('firebaseAuthService'), 'services index does not switch Firebase auth provider');
assert(firebaseMobile.includes('createUserWithEmailAndPassword'), 'Firebase email signup not implemented');
assert(firebaseMobile.includes('sendEmailVerification') && firebaseMobile.includes('FIREBASE_EMAIL_NOT_VERIFIED'), 'Real Firebase email-link verification is not enforced');
assert(firebaseMobile.includes('EXPO_PUBLIC_FIREBASE_AUTH_ACTION_URL'), 'Firebase action URL is not passed to email verification/reset');
assert(firebaseMobile.includes('FIREBASE_PHONE_UNAVAILABLE'), 'Phone Auth unavailable-region friendly handling missing');
assert(!firebaseMobile.includes('firebaseSessionReady: true'), 'Unverified email registration must not create a LOUSA session');
assert(firebaseMobile.includes('signInWithPhoneNumber'), 'Firebase phone auth not implemented');
assert(firebaseMobile.includes('GoogleAuthProvider.credential'), 'Firebase Google credential flow not implemented');
assert(firebaseMobile.includes('/v1/auth/firebase/session'), 'Firebase ID token exchange endpoint not used by mobile');
assert(server.includes('/v1/auth/firebase/session'), 'Backend Firebase session endpoint missing');
assert(server.includes('verifyFirebaseIdToken'), 'Backend does not verify Firebase ID token');
assert(server.includes("provider === 'password' && !decoded.email_verified"), 'Backend accepts unverified Firebase password users');
assert(server.includes('LEGACY_AUTH_DISABLED'), 'Legacy auth routes are not disabled when Firebase is active');
assert(server.includes("provider: 'firebase'"), 'Backend does not store Firebase identity');
assert(env.includes('FIREBASE_PROJECT_ID') && env.includes('FIREBASE_SERVICE_ACCOUNT_JSON'), 'Firebase Admin env vars missing');
assert(errors.includes('FIREBASE_AUTH_NOT_CONFIGURED') && errors.includes('FIREBASE_ADMIN_NOT_CONFIGURED'), 'Firebase user-facing errors missing');
assert(envExample.includes('EXPO_PUBLIC_AUTH_PROVIDER=firebase'), '.env.example Firebase auth provider missing');
assert(envExample.includes('FIREBASE_PROJECT_ID=lousa-moon'), '.env.example Firebase project ID missing');
assert(rootGradle.includes('com.google.gms:google-services:4.5.0'), 'Google Services Gradle dependency missing');
assert(appGradle.includes('apply plugin: "com.google.gms.google-services"'), 'Google Services Gradle app plugin missing');
assert(appGradle.includes('applicationIdSuffix ".qa"') && appGradle.includes('debuggable false'), 'Standalone bundled QA build type missing');
assert(pkg.scripts['android:apk:qa'] && pkg.scripts['android:apk:release'], 'Strict QA/release APK scripts missing');
assert(googleServices && androidGoogleServices, 'google-services.json must exist in root and android/app');
if (googleServices) {
  assert(googleServices.project_info?.project_id === 'lousa-moon', 'Firebase project_id mismatch');
  for (const packageName of ['com.lousa.moon', 'com.lousa.moon.qa']) {
    const client = googleServices.client?.find((item) => item.client_info?.android_client_info?.package_name === packageName);
    assert(Boolean(client?.client_info?.mobilesdk_app_id), `${packageName}: Firebase mobilesdk_app_id missing`);
  }
}
assert(exists('LOUSA_V10_4_FIREBASE_AUTH_MIGRATION_RU.md'), 'Firebase migration report missing');
assert(exists('LOUSA_V10_4_FIREBASE_SETUP_RU.md'), 'Firebase setup doc missing');
assert(exists('LOUSA_V10_4_DEVICE_QA_CHECKLIST_RU.md'), 'Firebase device QA checklist missing');
assert(exists('LOUSA_MOON_FIREBASE_ANDROID_AUTH_CHECKLIST_V10_4_1_RU.md'), 'V10.4.1 Android Auth checklist missing');

if (failures.length) {
  console.error('verify:v10-4-firebase-auth FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('verify:v10-4-firebase-auth PASS');
