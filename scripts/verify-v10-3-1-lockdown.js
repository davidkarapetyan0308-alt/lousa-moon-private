const fs = require('fs');
const path = require('path');

const root = process.cwd();
const mustExist = [
  'src/features/auth/components/AuthScreenFrame.tsx',
  'src/features/auth/services/authFlow.ts',
  'src/services/errorMessages.ts',
  'README_QA_LOCKDOWN_RU.md',
  'LOUSA_V10_3_1_IMPLEMENTATION_REPORT_RU.md',
  'LOUSA_V10_3_1_DEVICE_QA_CHECKLIST_RU.md',
  'LOUSA_V10_3_1_KNOWN_LIMITATIONS_RU.md',
  'LOUSA_V10_3_1_RELEASE_CHECKLIST_RU.md',
  'LOUSA_V10_3_1_HONEST_SCORE_RU.md',
  '.env.example',
];

const failures = [];
for (const file of mustExist) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`Missing ${file}`);
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const login = read('app/auth/login.tsx');
if (!login.includes('AuthScreenFrame') && !login.includes('PremiumAuthShell')) failures.push('AuthScreenFrame/PremiumAuthShell is not used in app/auth/login.tsx');
if (!login.includes('getUserFacingErrorMessage')) failures.push('auth UI does not use error mapper');
if (login.includes('/v1/admin')) failures.push('mobile auth contains admin endpoint');
if (login.includes('Network request failed')) failures.push('raw Network request failed is present in auth UI');

const errorMapper = read('src/services/errorMessages.ts');
for (const code of ['NETWORK_ERROR','EMAIL_DELIVERY_FAILED','INVALID_OTP','MAP_PROVIDER_UNAVAILABLE','ADDRESS_OUT_OF_ZONE','AUTH_SESSION_EXPIRED']) {
  if (!errorMapper.includes(code)) failures.push(`error mapper missing ${code}`);
}

const env = read('.env.example');
for (const key of ['EXPO_PUBLIC_LOUSA_API_URL','EMAIL_PROVIDER','ALLOW_DEV_OTP_RESPONSE','MAPTILER_API_KEY','EXPO_PUBLIC_MAPTILER_API_KEY','EXPO_PUBLIC_LOUSA_MAP_STYLE_URL']) {
  if (!env.includes(key)) failures.push(`.env.example missing ${key}`);
}

const address = read('app/screens/address-map.tsx');
if (!address.includes('MapLibre')) failures.push('address screen does not mention/use MapLibre');
if (!address.includes('ручной') && !address.includes('manual')) failures.push('manual address fallback copy not found');

const pkg = JSON.parse(read('package.json'));
for (const script of ['verify:v10-3-1-lockdown','smoke:auth','smoke:onboarding','smoke:address','smoke:support','smoke:production-env']) {
  if (!pkg.scripts || !pkg.scripts[script]) failures.push(`package.json missing ${script}`);
}

if (failures.length) {
  console.error('LOUSA V10.3.1 lockdown verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('LOUSA V10.3.1 lockdown verification PASS');
