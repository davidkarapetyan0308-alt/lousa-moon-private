const fs = require('fs');
const layout = fs.readFileSync('src/components/layout.tsx', 'utf8');
const tabs = fs.readFileSync('app/(tabs)/_layout.tsx', 'utf8');
const required = [
  'tabBarHeightAndroid',
  'paddingBottom: bottomSpace',
  'useSafeAreaInsets',
  'tabbed ? LousaLayout.tabContentGap : 24',
];
const missing = required.filter((p) => !layout.includes(p) && !tabs.includes(p));
if (missing.length) {
  console.error('Safe area checks failed: ' + missing.join(', '));
  process.exit(1);
}
console.log('verify:bottom-safe-area PASS — shared tabbed scroll has bottom safe spacing.');
