const fs = require('fs');
const onboarding = fs.readFileSync('app/auth/onboarding.tsx', 'utf8');
const main = fs.readFileSync('app/auth/login.tsx', 'utf8');
const required = ['setOnboarded', '/(tabs)', 'preparation', 'privacy'];
const missing = required.filter((item) => !onboarding.includes(item) && !main.includes(item));
if (!main.includes('isOnboarded: false')) missing.push('new user must be marked not onboarded');
if (missing.length) {
  console.error('Onboarding smoke failed:', missing.join(', '));
  process.exit(1);
}
console.log('Onboarding smoke PASS');
