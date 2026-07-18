const fs = require('fs');
const app = JSON.parse(fs.readFileSync('app.json', 'utf8')).expo;
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
let ok = true;

if (app.version !== pkg.version) {
  console.error(`[verify-release] app.json version ${app.version} does not match package.json ${pkg.version}`);
  ok = false;
}
if (app.android?.package !== 'com.lousa.moon') {
  console.error('[verify-release] Invalid Android package');
  ok = false;
}
if (!Number.isInteger(app.android?.versionCode) || app.android.versionCode < 84) {
  console.error(`[verify-release] Android versionCode must be >= 84 for V9.0.6, got ${app.android?.versionCode}`);
  ok = false;
}
if ((process.env.EXPO_PUBLIC_APP_MODE || 'api') !== 'api') {
  console.error('[verify-release] Release must use EXPO_PUBLIC_APP_MODE=api');
  ok = false;
}
const apiUrl = (process.env.EXPO_PUBLIC_LOUSA_API_URL || '').trim();
if (!apiUrl) {
  console.error('[verify-release] Missing EXPO_PUBLIC_LOUSA_API_URL');
  ok = false;
} else if (!/^https:\/\//i.test(apiUrl)) {
  console.error('[verify-release] Production API URL must use HTTPS');
  ok = false;
}
const authActionUrl = (process.env.EXPO_PUBLIC_FIREBASE_AUTH_ACTION_URL || '').trim();
if (!authActionUrl) {
  console.error('[verify-release] Missing EXPO_PUBLIC_FIREBASE_AUTH_ACTION_URL');
  ok = false;
} else if (!/^https:\/\//i.test(authActionUrl)) {
  console.error('[verify-release] Firebase auth action URL must use HTTPS');
  ok = false;
}
if (process.env.EXPO_PUBLIC_RELEASE_BUILD !== 'true' || process.env.EXPO_PUBLIC_BUILD_CHANNEL !== 'production') {
  console.error('[verify-release] Explicit production build flags are required');
  ok = false;
}
if (!process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID && !process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY && !process.env.GOOGLE_MAPS_API_KEY_ANDROID && !process.env.GOOGLE_MAPS_ANDROID_API_KEY) {
  console.error('[verify-release] Missing Google Maps Android key');
  ok = false;
}
if (process.env.EXPO_PUBLIC_RELEASE_BUILD === 'true' && /debug/i.test(process.env.ANDROID_KEYSTORE_ALIAS || '')) {
  console.error('[verify-release] Release build cannot use debug signing alias');
  ok = false;
}
if (!ok) process.exit(1);
console.log(`[verify-release] ok (${app.version}, Android ${app.android.versionCode})`);
