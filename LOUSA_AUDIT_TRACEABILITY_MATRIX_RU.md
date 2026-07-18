# LOUSA Audit Traceability Matrix — 1.18.0

База: LOUSA Moon 1.17.0 Mobile Only. Целевая версия: **1.18.0 / Android versionCode 109**.

Статусы не означают production readiness. `ИСПРАВЛЕНО В КОДЕ` отделено от живой БД, APK и Device QA.

| ID | Область | Исходная проблема | Статус | Изменённые зоны | Доказательство / остаток |
|---|---|---|---|---|---|
| P0-01 | Onboarding | Пропуск анкеты создает выдуманную дату 13 дней назад | **ИСПРАВЛЕНО / UNIT PASS** | `app/auth/onboarding.tsx; src/store/index.ts; tests/completeProductRecovery.test.ts` | Skip сохраняет ноль записей; synthetic date удалена. |
| P0-02 | Cycle store | lastPeriodStart имеет выдуманный fallback | **ИСПРАВЛЕНО / UNIT PASS** | `src/store/index.ts; src/utils/cycleEngine.ts` | lastPeriodStart nullable; цикл без данных unavailable. |
| P0-03 | Cycle data | Нет единого валидатора period records | **ИСПРАВЛЕНО / UNIT PASS** | `src/domain/cycleValidation.ts; src/store/index.ts; apps/api/src/server.ts` | Один валидатор используется в UI/store/API. |
| P0-04 | Cycle data | Можно создать future/overlap/impossible period | **ИСПРАВЛЕНО / UNIT PASS** | `src/domain/cycleValidation.ts; tests/cycleValidation.test.ts` | Будущие даты, пересечения и невозможные интервалы блокируются. |
| P0-05 | Cycle editing | Destructive действия имеют неожиданный эффект | **ИСПРАВЛЕНО В КОДЕ / DEVICE QA** | `app/(tabs)/cycle.tsx; src/services/cycleSyncDiff.ts` | Добавлены preview, подтверждение и persisted Undo; физическая проверка не выполнена. |
| P0-06 | Cycle sync | Локальные правки и сервер могут расходиться | **ЧАСТИЧНО / LIVE DB REQUIRED** | `src/services/cycleSync.ts; apps/api/src/server.ts; schema.prisma` | Revision/conflict queue реализована; реальный offline→reconnect PostgreSQL тест не выполнен. |
| P0-07 | Cycle context | Onboarding всегда записывает natural/none | **ИСПРАВЛЕНО / STATIC+UNIT** | `app/auth/onboarding.tsx; apps/api/src/server.ts` | Контекст и факторы спрашиваются; frontend/backend enum синхронизированы. |
| P0-08 | Assistant | Luna выдается за AI, но является regex-ответчиком | **ИСПРАВЛЕНО** | `app/screens/help-assistant.tsx` | Ложный AI route удалён; справочник честно обозначен. |
| P0-09 | Routing | Кнопка Privacy ведет на отсутствующий route | **ИСПРАВЛЕНО / ROUTE PASS** | `app/(tabs)/for-you.tsx; scripts/verify-route-integrity.js` | Privacy ведёт на существующий legal route. |
| P0-10 | Security copy | Экран обещает защищенное health storage, но используется AsyncStorage | **ИСПРАВЛЕНО** | `app/screens/settings.tsx; src/security/encryptedStateStorage.ts` | Copy приведён к фактическому encrypted storage. |
| P0-11 | Local security | Health/address данные не зашифрованы | **ИСПРАВЛЕНО В КОДЕ / DEVICE QA** | `src/security/encryptedStateStorage.ts; src/store/index.ts` | Sensitive state шифруется через SecureStore/Keystore; extraction test требует Android. |
| P0-12 | Account rights | Локальная очистка может восприниматься как удаление аккаунта | **ИСПРАВЛЕНО В КОДЕ** | `app/screens/settings.tsx; src/services/localData.ts` | Очистка устройства и удаление server account разделены. |
| P0-13 | Commerce | Нет обязательного server quote | **ИСПРАВЛЕНО / CONTRACT TEST** | `app/screens/subscription.tsx; apps/api/src/server.ts` | Order/review блокируется без действующего server quote. |
| P0-14 | Commerce | Order создается локально | **ИСПРАВЛЕНО / CONTRACT TEST** | `app/screens/subscription.tsx; apps/api/src/server.ts` | Order создаётся backend из quote с idempotency. |
| P0-15 | Payments | Нет production payment flow | **БЛОКЕР PRODUCTION** | `apps/api/src/server.ts` | Sandbox intent/confirm/refund реализован; production provider/webhook не подключён. |
| P0-16 | Subscription | Pause/skip/cancel локальные | **ИСПРАВЛЕНО В КОДЕ / LIVE QA** | `app/(tabs)/box.tsx; apps/api/src/server.ts` | Pause/skip/resume/cancel серверные; два устройства не проверены. |
| P0-17 | Box defaults | Optional extras могут быть включены без явного выбора | **ИСПРАВЛЕНО / UNIT PASS** | `src/store/index.ts; app/screens/subscription.tsx` | Optional extras и substitutions по умолчанию выключены. |
| P0-18 | Allergies | Аллергии хранятся свободным текстом | **ИСПРАВЛЕНО / UNIT PASS** | `src/domain/models.ts; src/services/allergenSafety.ts; apps/api/src/server.ts` | Структурированные аллергены/severity/policy; конфликт блокирует quote. |
| P0-19 | Inventory | Reservation может oversell при конкуренции | **ИСПРАВЛЕНО В КОДЕ / STRESS TEST REQUIRED** | `apps/api/src/server.ts` | Условная/transactional резервация; конкурентный PostgreSQL stress test не выполнен. |
| P0-20 | Box truth | Локальный order может выглядеть как реальная логистика | **ИСПРАВЛЕНО В КОДЕ** | `app/screens/subscription.tsx; app/(tabs)/box.tsx` | Frontend не создаёт preparing/on-the-way без server events. |
| P0-21 | Delivery sync | Нет живого доказательства mobile->DB->admin | **ЧАСТИЧНО / E2E REQUIRED** | `apps/api/src/server.ts; src/services/api/index.ts` | Delivery API и payload реализованы; отдельная admin-panel в живом окружении не проверена. |
| P0-22 | Privacy roles | Courier/admin payload может быть неверно настроен | **ИСПРАВЛЕНО В КОДЕ / AUTH QA** | `apps/api/src/server.ts` | Delivery/courier payload использует allow-list без health data; live role QA не выполнен. |
| P0-23 | Physical quality | Нет supplier/batch/expiry/QA/recall трассировки | **ИСПРАВЛЕНО В МОДЕЛИ / OPERATIONS REQUIRED** | `schema.prisma; migration; apps/api/src/server.ts` | Supplier/batch/expiry/QA/recall/packing traceability добавлены; физический процесс не проверен. |
| P0-24 | Substitution | Нет явного разрешения на замену | **ИСПРАВЛЕНО / UNIT PASS** | `src/domain/models.ts; app/screens/subscription.tsx; apps/api/src/server.ts` | Замены default OFF; policy сохраняется и проверяется. |
| P0-25 | Internal routes | UX Lab/internal routes присутствуют в production tree | **ИСПРАВЛЕНО / ROUTE PASS** | `tools/internal/ux-lab.tsx; scripts/verify-mobile-only-boundary.js` | Internal route удалён из production tree. |
| P0-26 | Lint | ESLint завершается ошибкой | **ИСПРАВЛЕНО / PASS** | `eslint config; scripts` | npm run lint -- --quiet exit 0. |
| P0-27 | Unit tests | Stale test ищет удаленную admin-panel | **ИСПРАВЛЕНО / PASS** | `tests/productTrustRebuild.test.ts; tests/completeProductRecovery.test.ts` | 25 suites / 223 tests PASS. |
| P0-28 | Integration | Текущий integration тест не запускает реальную БД | **БЛОКЕР LIVE DB** | `apps/api/__integration__/order-flow.test.ts` | Текущий integration test contract-level; реальная PostgreSQL/testcontainers цепочка не выполнена. |
| P0-29 | APK | Последняя версия не собрана в текущей проверке | **БЛОКЕР ENVIRONMENT** | `android/; scripts/build-qa-apk.sh` | Android SDK отсутствует в среде, APK не собран. |
| P0-30 | Device QA | Нет проверки последнего UI на Android | **БЛОКЕР DEVICE QA** | `LOUSA_DEVICE_QA_RESULTS_RU.md` | Реальный Samsung и матрица размеров недоступны. |
| P0-31 | Release | Нет настоящего operational/payment proof | **БЛОКЕР RELEASE** | `LOUSA_RELEASE_CHECKLIST_RU.md` | Production запрещён до payment/live DB/admin/courier/device proof. |

## Автоматические доказательства

- `npm run typecheck` — PASS.
- `npm run lint -- --quiet` — PASS.
- `npm test -- --runInBand` — 25 suites / 223 tests PASS.
- `npm run test:integration -- --runInBand` — 1 contract suite / 2 tests PASS.
- route integrity — 28 routes PASS.
- touch-target static guard — PASS.
- UI geometry / bottom safe area — PASS.
- Mobile Only boundary — PASS.
- Android build reproducibility static guard — PASS.

## Непроверенные уровни

- реальная PostgreSQL миграция и HTTP integration;
- production payment provider/webhook;
- APK build/sign/install;
- Android Device QA и TalkBack;
- живая синхронизация с отдельной admin-panel и courier app;
- физическая QA-процедура упаковки Box.