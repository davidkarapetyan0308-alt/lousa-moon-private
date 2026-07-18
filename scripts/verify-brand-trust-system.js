const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const fail = (message) => { console.error(`verify:brand-trust-system FAIL: ${message}`); process.exitCode = 1; };

const design = read('src/theme/designSystem.ts');
const tokens = read('src/theme/tokens.ts');
const tabs = read('app/(tabs)/_layout.tsx');
const layout = read('src/components/layout.tsx');
const ui = read('src/components/ui/index.tsx');
const mobileRoutes = fs.readdirSync(path.join(root, 'app'), { recursive: true }).map(String);
const userFacing = ['app/(tabs)/index.tsx', 'app/(tabs)/cycle.tsx', 'app/(tabs)/for-you.tsx', 'app/(tabs)/box.tsx', 'app/screens/address-map.tsx']
  .filter((p) => fs.existsSync(path.join(root, p)))
  .map(read)
  .join('\n');

for (const [name, hex] of Object.entries({
  DeepInk: '#211A24', Plum: '#5B365F', BerryRose: '#A64D72', SoftRose: '#D985A5',
  Blush: '#F4DDE6', BlushSoft: '#FBF4F7', Pearl: '#FFFFFF', Success: '#4F7563',
  Warning: '#A36F3D', Error: '#B24C5C', SecondaryText: '#716771', Divider: '#E8DFE4',
})) {
  if (!design.includes(hex) && !tokens.includes(hex)) fail(`${name} token ${hex} is missing`);
}
if (!design.includes('cardRadius: 20')) fail('primary card radius must be 20');
if (!design.includes('smallRadius: 16')) fail('small card radius must be 16');
if (!layout.includes("isDark ? 'cosmic' : 'minimal'")) fail('light screens must default to minimal background');
if (/translateY\s*:/.test(tabs)) fail('active tab geometry must not use translateY');
if (/marginTop\s*:\s*-/.test(tabs)) fail('tab layout must not use negative marginTop');
if (!ui.includes('export function TrustLabel')) fail('TrustLabel component is missing');
if (mobileRoutes.some((p) => /admin/i.test(p))) fail('admin route exists in mobile app');
if (/Карта LOUSA работает на MapLibre|LOUSA map runs on MapLibre|OpenStreetMap-данных/.test(userFacing)) fail('technical map provider copy is exposed to users');
if (/deliveryFee\s*[:=]\s*(?!0\b)\d+/.test(userFacing)) fail('non-zero delivery fee appears in mobile UI');

if (!process.exitCode) console.log('verify:brand-trust-system PASS');
