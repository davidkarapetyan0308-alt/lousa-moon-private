const fs = require('fs');
const env = fs.existsSync('.env.example') ? fs.readFileSync('.env.example','utf8') : '';
const required = [
  'EXPO_PUBLIC_APP_MODE',
  'EXPO_PUBLIC_LOUSA_API_URL',
  'EMAIL_PROVIDER',
  'ALLOW_DEV_OTP_RESPONSE',
  'RESEND_API_KEY',
  'SMTP_HOST',
  'MAPTILER_API_KEY',
  'EXPO_PUBLIC_MAPTILER_API_KEY',
  'EXPO_PUBLIC_LOUSA_MAP_STYLE_URL',
];
const missing = required.filter((key) => !env.includes(key));
if (missing.length) {
  console.error('Production env smoke failed:', missing.join(', '));
  process.exit(1);
}
console.log('Production env smoke PASS');
