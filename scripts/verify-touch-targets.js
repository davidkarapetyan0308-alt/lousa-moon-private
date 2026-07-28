/* eslint-env node */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];

const pressScale = read('src/components/ui/PressScale.tsx');
if (!pressScale.includes('hitSlop={hitSlop ?? 6}')) failures.push('PressScale must provide a default touch expansion.');

const design = read('src/theme/designSystem.ts');
if (!/touchTarget:\s*48\b/.test(design)) failures.push('Design system touch target must be 48dp.');
const buttons = read('src/components/ui/buttons/index.tsx');
if (!buttons.includes('width: LousaLayout.touchTarget') || !buttons.includes('height: LousaLayout.touchTarget')) {
  failures.push('Semantic IconButton must reserve the shared 48dp touch target.');
}

const layout = read('src/components/layout.tsx');
if (!layout.includes('<IconButton') || !layout.includes('headerPlaceholder: { width: 48, height: 48 }')) {
  failures.push('Modal header must use the semantic 48dp IconButton.');
}

const tabs = read('app/(tabs)/_layout.tsx');
if (!tabs.includes('minHeight: 48') && !tabs.includes('height: TAB_CONTENT_HEIGHT')) failures.push('Bottom tabs must reserve at least 48dp.');
if (/translateY/.test(tabs)) failures.push('Active bottom tab must not move vertically.');

const calendar = read('src/components/DateCalendarPicker.tsx');
if (!calendar.includes('hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}')) failures.push('Compact calendar day controls must expand their touch target.');

const below48MinHeight = [];
for (const file of ['app/screens/profile.tsx', 'app/screens/support.tsx', 'app/screens/address-map.tsx', 'app/(tabs)/cycle.tsx']) {
  const source = read(file);
  for (const match of source.matchAll(/(?:button|action|row|chip|arrow)[A-Za-z0-9_]*\s*:\s*\{[^}]*minHeight:\s*(\d+)/gi)) {
    if (Number(match[1]) < 48) below48MinHeight.push(`${file}:${match[0].slice(0, 80)}`);
  }
}
if (below48MinHeight.length) failures.push(`Explicit interactive minHeight below 48dp: ${below48MinHeight.join(' | ')}`);

if (failures.length) {
  console.error('verify:touch-targets FAIL');
  failures.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}
console.log('verify:touch-targets PASS');
