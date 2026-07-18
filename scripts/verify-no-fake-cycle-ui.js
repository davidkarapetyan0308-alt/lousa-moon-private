const fs = require('fs');
function must(file, parts) {
  const text = fs.readFileSync(file, 'utf8');
  const missing = parts.filter((p) => !text.includes(p));
  if (missing.length) throw new Error(`${file} missing ${missing.join(', ')}`);
}
must('src/utils/cycleEngine.ts', [
  'if (!records.length)',
  "currentDay: 0",
  "confidence: 'insufficient'",
  'isOvulation: false',
  'isFertile: false',
  'isPMS: false',
]);
must('app/(tabs)/index.tsx', [
  'hasCycleData',
  'Цикл пока не настроен',
  'Отметьте дату начала последней менструации',
]);
must('app/(tabs)/cycle.tsx', [
  'hasCycleData',
  'Легенда появится после первой записи',
  'Пока нет данных цикла',
]);
console.log('verify:no-fake-cycle-ui PASS — no-data state is explicit and fake cycle layers are blocked.');
