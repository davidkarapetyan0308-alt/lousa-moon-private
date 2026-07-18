const fs = require('fs');
const src = fs.readFileSync('app/auth/login.tsx', 'utf8');
const required = [
  'type AuthMode',
  'signup',
  'verify',
  'recovery',
  'reset',
  'requestRegistrationCode',
  'verifyRegistration',
  'requestPasswordReset',
  'resetPassword',
  'router.replace("/auth/onboarding")',
  'AuthScreenFrame',
];
const missing = required.filter((item) => !src.includes(item));
if (missing.length) {
  console.error('Auth smoke failed:', missing.join(', '));
  process.exit(1);
}
console.log('Auth smoke PASS');
