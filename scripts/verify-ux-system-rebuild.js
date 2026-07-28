const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const errors = [];
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const requireFile = (file) => { if (!exists(file)) errors.push(`missing ${file}`); };
const requireText = (file, needles) => {
  const text = read(file);
  for (const needle of needles) if (!text.includes(needle)) errors.push(`${file}: missing ${needle}`);
};
const forbidText = (file, needles) => {
  const text = read(file);
  for (const needle of needles) if (text.includes(needle)) errors.push(`${file}: forbidden ${needle}`);
};

[
  'src/components/ui/PressScale.tsx',
  'src/components/ui/buttons/index.tsx',
  'src/components/ui/inputs/index.tsx',
  'src/components/ui/surfaces/index.tsx',
  'src/components/ui/feedback/index.tsx',
  'src/components/ui/navigation/index.tsx',
].forEach(requireFile);

requireText('src/theme/designSystem.ts', [
  'buttonRadius: 18',
  'buttonHeight: 56',
  'touchTarget: 48',
  'export const LousaTypography',
]);
requireText('src/components/ui/buttons/index.tsx', [
  'export function PrimaryButton',
  'export function SecondaryButton',
  'export function TextButton',
  'export function DestructiveButton',
  'export function IconButton',
  'export function StickyBottomAction',
  'loading',
  'blocked && styles.blocked',
]);
requireText('src/components/ui/inputs/index.tsx', [
  'export function ChoiceChip',
  'export function CheckboxRow',
  'export function SwitchRow',
]);
requireText('src/components/ui/surfaces/index.tsx', [
  'export function HeroCard',
  'export function SectionSurface',
  'export function ListSection',
]);

const keyScreens = [
  'app/(tabs)/index.tsx',
  'app/(tabs)/for-you.tsx',
  'app/(tabs)/box.tsx',
];
for (const file of keyScreens) {
  requireText(file, ['HeroCard']);
  forbidText(file, ['<SurfaceCard', '<PrimaryAction', '<PressScale']);
}
requireText('app/(tabs)/cycle.tsx', ['ChoiceChip', 'PrimaryButton', 'SecondaryButton', 'SectionSurface']);
forbidText('app/(tabs)/cycle.tsx', ['<SurfaceCard', '<PrimaryAction']);
requireText('app/screens/subscription.tsx', ['ProgressHeader', 'StickyBottomAction', 'CheckboxRow', 'SwitchRow', 'PrimaryButton']);
requireText('app/screens/address-map.tsx', ['StickyBottomAction', 'ChoiceChip', 'CheckboxRow', 'IconButton']);
requireText('app/auth/login.tsx', ['PrimaryButton', 'SecondaryButton']);

const appFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel);
    else if (/\.tsx$/.test(entry.name)) appFiles.push(rel);
  }
}
walk('app');
for (const file of appFiles) {
  if (read(file).includes('<PrimaryAction')) errors.push(`${file}: legacy PrimaryAction is still used`);
}

if (errors.length) {
  console.error('verify:ux-system-rebuild FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('verify:ux-system-rebuild PASS — semantic buttons, reduced key screens, state-driven surfaces, sticky form actions');
