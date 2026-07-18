const fs = require('fs');
const path = require('path');
const root = process.cwd();
const targets = ['app', 'src'];
const forbidden = [
  '0 день цикла',
  'Фолликулярная фаза',
  'Добавь ещё одну подтверждённую дату',
  'Один тап',
  'Средства под тебя',
  'С возвращением',
  'Забыли пароль',
  'Создай свой профиль',
  'Отслеживание',
  'Добавить менструацию',
  'Что будет внутри',
  'Выбрать LOUSA BOX',
  'Тепло и комфорт',
  'Небольшой ритуал',
  'Продолжая, ты',
  'հՅ',
  'ՀՅ',
];
function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx|js|jsx)$/.test(full)) acc.push(full);
  }
  return acc;
}
const files = targets.flatMap((dir) => walk(path.join(root, dir)));
const hits = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const phrase of forbidden) {
    if (text.includes(phrase)) hits.push(`${path.relative(root, file)} :: ${phrase}`);
  }
}
if (hits.length) {
  console.error('Forbidden UI copy found:\n' + hits.join('\n'));
  process.exit(1);
}
console.log('verify:ui-copy PASS — premium copy blacklist is clean.');
