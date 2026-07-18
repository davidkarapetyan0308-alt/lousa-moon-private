const fs = require('fs');
const path = require('path');

const root = process.cwd();
const requiredFiles = [
  'src/services/preparationWindow.ts',
  'app/(tabs)/index.tsx',
  'app/(tabs)/box.tsx',
  'app/auth/onboarding.tsx',
  'README_LOUSA_MOBILE_V10_3_PREPARATION_CORE_QA_RU.md',
  'LOUSA_MOBILE_V10_3_IMPLEMENTATION_REPORT_RU.md',
  'LOUSA_MOBILE_V10_3_HONEST_EVALUATION_RU.md',
];

const requiredStrings = [
  ['src/services/preparationWindow.ts', 'calculatePreparationWindow'],
  ['src/services/preparationWindow.ts', 'buildPreparationWindowCopy'],
  ['app/(tabs)/index.tsx', 'preparationWindow'],
  ['app/(tabs)/index.tsx', 'preparationCopy.eyebrow'],
  ['app/(tabs)/index.tsx', 'Курьер видит только адрес'],
  ['app/(tabs)/box.tsx', 'copy.preparation'],
  ['app/auth/onboarding.tsx', 'Создадим профиль заботы'],
  ['app/auth/onboarding.tsx', 'LOUSA не будет угадывать цикл'],
  ['src/services/notifications.ts', 'Окно подготовки открыто'],
  ['package.json', 'verify:v10-3-preparation-core'],
  ['package.json', '"version": "1.15.0"'],
  ['app.config.js', "version: '1.15.0'"],
  ['app.json', '"versionCode": 102'],
];

const failures = [];
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`Missing file: ${file}`);
}
for (const [file, needle] of requiredStrings) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    failures.push(`Missing file for string check: ${file}`);
    continue;
  }
  const text = fs.readFileSync(full, 'utf8');
  if (!text.includes(needle)) failures.push(`Missing string in ${file}: ${needle}`);
}

const indexText = fs.readFileSync(path.join(root, 'app/(tabs)/index.tsx'), 'utf8');
if (indexText.includes('0 день цикла')) failures.push('Forbidden fake cycle copy found: 0 день цикла');
if (!indexText.includes("preparationWindow.state === 'no_data' ? router.push('/screens/period-editor')")) failures.push('Today preparation CTA does not route no-data users to period editor');

if (failures.length) {
  console.error('verify:v10-3-preparation-core FAILED');
  failures.forEach((f) => console.error(`- ${f}`));
  process.exit(1);
}
console.log('verify:v10-3-preparation-core PASS');
