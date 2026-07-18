const { spawnSync } = require('child_process');
const checks = [
  ['verify:ui-copy', 'scripts/verify-ui-copy.js'],
  ['verify:no-fake-cycle-ui', 'scripts/verify-no-fake-cycle-ui.js'],
  ['verify:bottom-safe-area', 'scripts/verify-bottom-safe-area.js'],
];
for (const [name, file] of checks) {
  const result = spawnSync(process.execPath, [file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
const fs = require('fs');
const docs = [
  'README_LOUSA_MOON_V10_1_UI_UX_PRODUCT_DIARY_RU.md',
  'LOUSA_MOON_V10_1_UI_UX_AUDIT_RU.md',
  'LOUSA_MOON_V10_1_COPY_REWRITE_RU.md',
  'LOUSA_MOON_V10_1_DESIGN_SYSTEM_RU.md',
  'LOUSA_MOON_V10_1_NO_DATA_LOGIC_RU.md',
  'LOUSA_MOON_V10_1_BOX_TRUTH_RU.md',
  'LOUSA_MOON_V10_1_TEST_REPORT_RU.md',
  'LOUSA_MOON_V10_1_KNOWN_LIMITATIONS_RU.md',
];
const missing = docs.filter((d) => !fs.existsSync(d));
if (missing.length) {
  console.error('Missing V10.1 docs: ' + missing.join(', '));
  process.exit(1);
}
console.log('verify:v10-1 PASS — V10.1 product-truth UI package is complete.');
