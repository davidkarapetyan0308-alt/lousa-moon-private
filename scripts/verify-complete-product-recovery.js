/* eslint-env node */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = [];
const requireText = (file, token, message) => {
  const source = read(file);
  if (!source.includes(token)) fail.push(`${message} (${file})`);
};
const forbidText = (file, pattern, message) => {
  const source = read(file);
  if (pattern.test(source)) fail.push(`${message} (${file})`);
};

requireText('app/auth/onboarding.tsx', 'selectedDate: null', 'Onboarding date must start empty');
requireText('app/auth/onboarding.tsx', "questionnaireStatus: records.length ? 'completed' : 'skipped_cycle_date'", 'Skipped date must remain explicit');
forbidText('app/auth/onboarding.tsx', /subDays\([^\n]*13|Date\.now\(\)\s*-\s*13\s*\*/, 'Synthetic 13-day period fallback is forbidden');
requireText('src/store/index.ts', 'lastPeriodStart: null', 'Cycle store must support no-data state');
requireText('src/domain/cycleValidation.ts', 'validateAndNormalizePeriodRecord', 'Unified cycle validator missing');
requireText('src/services/cycleSync.ts', 'encryptedJsonStore', 'Cycle sync queue must be encrypted');
requireText('src/services/addressDraft.ts', 'encryptedJsonStore', 'Address draft must be encrypted');
requireText('src/security/encryptedStateStorage.ts', 'SecureStore', 'SecureStore-backed encrypted state missing');
requireText('apps/api/src/server.ts', "'PAID_ORDER_REQUIRED'", 'Paid order gate is missing');
requireText('apps/api/src/server.ts', "pathname === '/v1/subscription/actions'", 'Server subscription actions missing');
requireText('apps/api/src/server.ts', 'assertOrderPackingQuality', 'Packing QA gate missing');
requireText('apps/api/src/server.ts', 'ALLERGEN_CONFLICT:', 'Allergen quote gate missing');
requireText('apps/api/src/server.ts', 'let deliveryFeeMinor = 0', 'Delivery must be included in the plan');
requireText('app/screens/subscription.tsx', 'result.data.deliveryFeeMinor !== 0', 'Client must reject non-zero delivery fee');
requireText('app/screens/subscription.tsx', "substitutionPolicy: allowSubstitutions ? 'same_category'", 'Explicit substitution consent missing');
requireText('scripts/verify-route-integrity.js', 'verify:route-integrity PASS', 'Route integrity verifier missing');
if (fs.existsSync(path.join(root, 'apps/admin'))) fail.push('Admin frontend must not be inside the mobile source tree.');
if (fs.existsSync(path.join(root, 'app/screens/ai-chat.tsx'))) fail.push('Fake AI route must not be shipped.');

if (fail.length) {
  console.error('verify:complete-product-recovery FAIL');
  fail.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}
console.log('verify:complete-product-recovery PASS');
