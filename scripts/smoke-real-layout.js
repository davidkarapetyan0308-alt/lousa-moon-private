/* eslint-env node */
const fs = require('node:fs');
const read = (file) => fs.readFileSync(file, 'utf8');
const onboarding = read('app/auth/onboarding.tsx');
const address = read('app/screens/address-map.tsx');
const layout = read('src/components/layout.tsx');
const failures = [];
if (!onboarding.includes('<ScrollView') || !onboarding.includes('keyboardShouldPersistTaps="handled"')) failures.push('onboarding scroll/keyboard behavior missing');
if (!address.includes('KeyboardAvoidingView') || !address.includes('insets.bottom')) failures.push('address keyboard/safe-area behavior missing');
if (!layout.includes('useAppContentInsets') || !layout.includes('paddingBottom: bottomSpace')) failures.push('shared bottom-safe layout missing');
if (failures.length) { console.error('smoke:real-layout FAIL'); failures.forEach((x)=>console.error(`- ${x}`)); process.exit(1); }
console.log('smoke:real-layout PASS');
