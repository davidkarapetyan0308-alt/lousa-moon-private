# LOUSA Moon — baseline до полного исправления

Исходная версия: 1.17.0
Android versionCode: 108
Архитектура: Mobile Only + backend API
Baseline commit: 80af365

## Выполненные проверки

- `npm ci --ignore-scripts` — PASS.
- `node scripts/patch-expo-modules-core.js` — выполнен.
- `npm run typecheck` — PASS.
- `npm run lint -- --quiet` — FAIL: `scripts/verify-mobile-only-boundary.js` использует `__dirname` в ESM.
- `npm test -- --runInBand` — FAIL: 1 тест из 207 пытается прочитать удалённую `apps/admin/public/index.html`.
- `npm run test:integration -- --runInBand` — PASS, но текущие 2 теста проверяют только контракт, а не реальную PostgreSQL/API цепочку.

## Критические подтверждённые дефекты

1. Пропуск даты в onboarding создаёт выдуманную дату цикла.
2. Cycle store имеет fallback `сегодня - 13 дней` и показывает правдоподобный цикл без данных.
3. `cycleContext` по умолчанию выставляется в `natural`, а `factors` в `none` без ответа пользователя.
4. Нет единого валидатора записей цикла между UI/store/API.
5. Локальный Box store способен создать подписку и order без server quote/payment proof.
6. Чувствительные крупные данные хранятся в AsyncStorage без шифрования содержимого.
7. В production route tree присутствуют внутренние экраны.
8. Luna называется AI, хотя использует локальные шаблоны.
9. Есть устаревшие тесты и release guards, ожидающие встроенную admin-panel.
10. Нет доказательства сборки и Device QA версии 1.17.0.
