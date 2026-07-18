const fs = require('fs');
const path = require('path');
const root = process.cwd();
const file = path.join(root, 'app/auth/login.tsx');
const text = fs.readFileSync(file, 'utf8');
const required = [
  'scrollContentForm',
  'justifyContent: "flex-start"',
  'scrollContentSignup',
  'paddingBottom: 150',
  'signupSheet',
  'termsCompact',
  'Профиль LOUSA',
  'Для записей, настроек и заказов LOUSA BOX — спокойно и приватно.',
];
const forbidden = [
  'contentContainerStyle={styles.scrollContent}',
  'signUpTitle: "Создать профиль LOUSA"',
  'Профиль нужен, чтобы бережно хранить ваши записи, настройки и заказы LOUSA BOX.',
  'justifyContent: "center", paddingTop: 8, paddingBottom: 132',
];
const missing = required.filter((x) => !text.includes(x));
const hits = forbidden.filter((x) => text.includes(x));
if (missing.length || hits.length) {
  if (missing.length) console.error('Missing auth layout fixes:\n' + missing.join('\n'));
  if (hits.length) console.error('Forbidden old auth layout remains:\n' + hits.join('\n'));
  process.exit(1);
}
console.log('verify:v10-2-3-auth-layout PASS — auth/register screen starts near top, uses compact premium copy and has safe bottom spacing.');
