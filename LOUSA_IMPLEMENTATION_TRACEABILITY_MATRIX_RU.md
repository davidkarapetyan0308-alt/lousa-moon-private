# LOUSA 1.18.4 — Implementation Traceability Matrix

Исходник: `LOUSA_MOON_V1.18.3_BUILD114_SOURCE_HANDOFF.zip`  
Исходный SHA-256: `817505abfe3daf927c23849e559eece1749f6a8b94f0cb8b3b0537c1dc9519f2`  
Целевая версия: `1.18.4`, Android `versionCode 115`.

| ID | Раздел | Исходная проблема | Реализация | Проверка | Статус | Оставшийся риск |
|---|---|---|---|---|---|---|
| S-00 | Сохранность | Риск изменения исходного ZIP | SHA, file manifest, отдельная working copy, Git baseline, snapshots | SHA и manifest созданы | ПРОВЕРЕНО СТАТИЧЕСКИ | Нет |
| S-01 | Версии | 1.18.0/109 и 1.18.3/114 одновременно | Все runtime/build источники и OpenAPI синхронизированы; `verify:version-consistency` | PASS 1.18.4/115 | ПРОВЕРЕНО СТАТИЧЕСКИ | APK metadata требует сборки |
| S-02 | Auth | Firebase token мог подменять backend access token | Явная session state machine, pending exchange, limited local mode, server actions blocked | Syntax PASS, unit test добавлен | ИСПРАВЛЕНО В КОДЕ | Полный Jest и Android login не выполнены |
| S-03 | Payments | Sandbox мог выглядеть как production | Provider abstraction, production sandbox blocker, webhook HMAC interface, event integrity fields | Static/pure module checks | ИСПРАВЛЕНО В КОДЕ | ТРЕБУЕТ PAYMENT PROVIDER |
| S-04 | Backend | `server.ts` монолитный | Извлечены payment, schedule, address origin, courier DTO, quality policy | OpenAPI parity PASS | ЧАСТИЧНО | `server.ts` остаётся ~3374 строк |
| S-05 | Mobile | Крупные auth/address/store файлы | Session module и service boundaries вынесены, legacy Box actions удалены | Route/static guards PASS | ЧАСТИЧНО | Крупные JSX/store требуют отдельного refactor + Device QA |
| S-06 | UX | Сложность и повторные действия | Limited mode честный, checkout double-submit blocker, internal route removed, server truth enforced | UI/static guards PASS | ЧАСТИЧНО | Полная визуальная редукция требует APK и user test |
| S-07 | Storage | SecureStore watchdog мог fail-open | Fail-closed timeout, durable write before cache, error propagation | Pure/static test добавлен | ИСПРАВЛЕНО В КОДЕ | Encrypted SQLite не внедрён |
| S-08 | Startup | Короткие race/watchdog | Session refresh перестал объявлять ложную готовность; SecureStore timeout отделён | Syntax/static | ЧАСТИЧНО | Cold-start Device QA обязателен |
| S-09 | Errors | Stack мог показываться пользователю | Production Error Boundary скрывает технические details | Production route/static checks | ИСПРАВЛЕНО В КОДЕ | Требуется crash test APK |
| S-10 | Routes | `log-state` был production route | Переименован в пользовательский `wellness-log`, QA/debug boundary guard | PASS, 28 routes | ПРОВЕРЕНО СТАТИЧЕСКИ | Deep-link Device QA |
| S-11 | OpenAPI | Спецификация расходилась с backend | 129 method/path pairs, автоматический parity script | PASS | ПРОВЕРЕНО СТАТИЧЕСКИ | Response-schema depth ещё можно расширить |
| S-12 | Guards | Старые guards искали устаревшие строки | Guards переведены на актуальные semantic checks | Stabilization suite PASS | ПРОВЕРЕНО СТАТИЧЕСКИ | Не заменяет runtime tests |
| S-13 | Subscription | Mobile задавал итоговые даты | Backend рассчитывает billing/preparation/delivery schedule | Pure strict TS/runtime test | ПРОВЕРЕНО UNIT-УРОВНЕМ ЧИСТОГО МОДУЛЯ | Live DB E2E отсутствует |
| S-14 | Box state | Два источника истины | Production local subscribe/pause/resume/cancel/order actions удалены; demo guarded | Guard PASS | ПРОВЕРЕНО СТАТИЧЕСКИ | Full Jest не выполнен |
| S-15 | Address | Inferred поля выдавались как подтверждённые | `provider_confirmed/inferred/user_entered/unknown`, ручные правки снимают truth | Pure strict TS/runtime test | ПРОВЕРЕНО UNIT-УРОВНЕМ ЧИСТОГО МОДУЛЯ | Map Device QA |
| S-16 | Box quality | Один сотрудник мог собрать и выпустить Box | Separate save/release, dual control, supplier approval, certificates/storage, seal/trace | Policy runtime + guard + OpenAPI PASS | ПРОВЕРЕНО СТАТИЧЕСКИ И ЧИСТЫМ RUNTIME | Admin program должен перейти на новый endpoint |
| S-17 | Privacy | Courier DTO мог расшириться случайно | Explicit whitelist + comment sanitizer + tests | Pure strict TS/runtime test | ПРОВЕРЕНО UNIT-УРОВНЕМ ЧИСТОГО МОДУЛЯ | Live courier integration отсутствует |
| S-18 | Integration | Contract test не является real E2E | Docker QA runner, migrations/seed/API HTTP smoke/Jest command | Скрипт создан | ТРЕБУЕТ ЖИВОЙ БАЗЫ | Docker отсутствует |
| S-19 | Android | Нужна новая независимая сборка | Версия 1.18.4/115, portable scripts, static reproducibility | Static PASS | БЛОКЕР | Android SDK/ADB и npm install недоступны |
| S-20 | Packaging | Риск мусора/секретов | Clean-copy allow/exclude policy, manifest и повторная распаковка | Выполняется перед выдачей | В РАБОТЕ | Финальный SHA добавляется после ZIP |

## Принцип статусов

Статический PASS не приравнивается к Android Device QA. Production readiness не заявлена.
