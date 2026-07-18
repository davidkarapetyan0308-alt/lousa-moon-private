const fs = require('fs');
const path = require('path');
const root = process.cwd();
const authFile = path.join(root, 'app/auth/login.tsx');
let auth = fs.readFileSync(authFile, 'utf8');
const governorFile = path.join(root, 'src/features/auth/components/AuthScreenFrame.tsx');
if (fs.existsSync(governorFile)) auth += '\n' + fs.readFileSync(governorFile, 'utf8');
const premiumShellFile = path.join(root, 'src/features/auth/components/PremiumAuthShell.tsx');
if (fs.existsSync(premiumShellFile)) auth += '\n' + fs.readFileSync(premiumShellFile, 'utf8');
const pkg = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
const appJson = fs.readFileSync(path.join(root, 'app.json'), 'utf8');
const appConfig = fs.readFileSync(path.join(root, 'app.config.js'), 'utf8');

const required = [
  'useSafeAreaInsets',
  'PremiumAuthShell',
  "edges={['top', 'bottom']}",
  'mode !== "welcome" && styles.scrollContentAuthFixed',
  'paddingBottom: mode === "signup" ? signupBottomPadding : formBottomPadding',
  'scrollContentAuthFixed',
  'formTitleLong',
  'stepImageSmall:',
  'Укажите email, связанный с аккаунтом. Мы отправим код подтверждения.',
  'Введите шестизначный код',
];
const forbidden = [
  'scrollContent: { flexGrow: 1, paddingHorizontal: 18, alignItems: "center" }',
  'recoveryBody:\n      "Укажи email',
  'codeError: "Введи шестизначный код"',
  'stepImageSmall: { width: 148, height: 148',
  'justifyContent: "center",\n    paddingTop: 8,\n    paddingBottom: 132',
  'edges={["top"]}',
];
const missing = required.filter((item) => !auth.includes(item));
const hits = forbidden.filter((item) => auth.includes(item));
if (!pkg.includes('"version": "1.15.0"')) missing.push('package.json version 1.15.0');
if (!appJson.includes('"version": "1.15.0"')) missing.push('app.json version 1.15.0');
if (!appJson.includes('"versionCode": 102')) missing.push('app.json android versionCode 102');
if (!appConfig.includes("version: '1.15.0'")) missing.push('app.config.js version 1.15.0');
if (!appConfig.includes('versionCode: 102')) missing.push('app.config.js versionCode 102');
if (missing.length || hits.length) {
  if (missing.length) console.error('Missing V10.2.4 auth layout governor items:\n' + missing.join('\n'));
  if (hits.length) console.error('Forbidden old unstable auth layout remains:\n' + hits.join('\n'));
  process.exit(1);
}
console.log('verify:v10-2-4-auth-layout-governor PASS — auth screens use top-anchored layout governor, safe bottom padding, compact recovery/register screens, and updated version metadata.');
