const requiredApi = ['DATABASE_URL','JWT_ACCESS_SECRET','JWT_REFRESH_SECRET','EMAIL_FROM'];
const appEnv = process.env.APP_ENV || process.env.NODE_ENV || 'development';
let ok = true;
const missing = (key) => {
  console.error(`[verify-env] Missing ${key}`);
  ok = false;
};
for (const key of requiredApi) {
  if (appEnv === 'production' && !process.env[key]) {
    missing(key);
  }
}
if (appEnv === 'production') {
  if (!process.env.REDIS_URL) missing('REDIS_URL');
  if (!process.env.MIGRATION_DATABASE_URL) missing('MIGRATION_DATABASE_URL');
  if (!process.env.PUBLIC_API_URL && !process.env.RENDER_EXTERNAL_HOSTNAME) {
    console.error('[verify-env] Missing PUBLIC_API_URL or RENDER_EXTERNAL_HOSTNAME');
    ok = false;
  }
  if (!process.env.FIREBASE_PROJECT_ID) missing('FIREBASE_PROJECT_ID');
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON && !(process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)) {
    console.error('[verify-env] Missing Firebase Admin credentials');
    ok = false;
  }
  if (process.env.PUBLIC_API_URL && !/^https:\/\//i.test(process.env.PUBLIC_API_URL)) {
    console.error('[verify-env] PUBLIC_API_URL must use HTTPS');
    ok = false;
  }
  if (process.env.EXPO_PUBLIC_LOUSA_API_URL && !/^https:\/\//i.test(process.env.EXPO_PUBLIC_LOUSA_API_URL)) {
    console.error('[verify-env] EXPO_PUBLIC_LOUSA_API_URL must use HTTPS');
    ok = false;
  }
  if (process.env.REDIS_URL && !/^rediss:\/\//i.test(process.env.REDIS_URL)) {
    console.error('[verify-env] Production REDIS_URL must use rediss:// TLS');
    ok = false;
  }
  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    const value = process.env[key] || '';
    if (value.length < 32 || /change_me|placeholder|demo|test_secret/i.test(value)) {
      console.error(`[verify-env] ${key} must be a unique random value of at least 32 characters`);
      ok = false;
    }
  }
  if (/demo|local/i.test(process.env.EXPO_PUBLIC_APP_MODE || '')) { console.error('[verify-env] Production cannot use demo/local app mode'); ok = false; }
}
if (!ok) process.exit(1);
console.log(`[verify-env] ok (${appEnv})`);
