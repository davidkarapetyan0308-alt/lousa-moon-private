#!/usr/bin/env node
const fs = require('node:fs');
const shell = fs.readFileSync('src/features/auth/components/PremiumAuthShell.tsx', 'utf8');
const login = fs.readFileSync('app/auth/login.tsx', 'utf8');
for (const fragment of ['KeyboardAvoidingView', 'SafeAreaView', "edges={['top', 'bottom']}", 'paddingBottom: bottomPadding', 'PremiumAuthShell']) {
  if (!shell.includes(fragment) && !login.includes(fragment)) {
    console.error(`FAIL: layout guard fragment missing: ${fragment}`);
    process.exit(1);
  }
}
if (/marginTop:\s*-[0-9]+/.test(login)) {
  console.error('FAIL: negative marginTop hack detected.');
  process.exit(1);
}
console.log('PASS: premium auth layout smoke contract is present.');
