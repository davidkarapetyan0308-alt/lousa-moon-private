# LOUSA Moon 1.18.0 — Complete Product Recovery Report

## Итог

Выполнено кодовое восстановление критических P0-зон: правда данных цикла, анкета, прогноз, безопасное хранение, маршруты, честный помощник, server quote/order/subscription, бесплатная доставка, структурированные аллергены, замены, складская резервация и модель физического качества Box.

Это **release candidate исходников**, а не production release.

## Основные изменения

### Цикл

- Удалена выдуманная дата при Skip onboarding.
- `lastPeriodStart` nullable.
- Без подтверждённых записей нет дня, фазы, овуляции и прогноза.
- Добавлен единый `validateAndNormalizePeriodRecord` для mobile/store/API.
- Блокируются future dates, overlap, duplicates и невозможная длительность.
- Forecast не становится фактом.
- Пропущенное окно не создаёт новый цикл.
- Редактирование показывает последствия; Undo хранит точный diff.
- Sync queue содержит revisions и conflict handling.

### Анкета

- Контекст не подставляется автоматически.
- Добавлены contraception, pregnancy, postpartum, breastfeeding, perimenopause, amenorrhea и отказ от ответа.
- Schema version синхронизирована mobile/backend.
- Черновик хранится зашифрованно.

### Security

- Sensitive Zustand state, cycle queues, settings и address draft перенесены на chunked Expo SecureStore.
- На native отсутствие SecureStore вызывает ошибку вместо plaintext fallback.
- Старый AsyncStorage sensitive adapter удалён.
- Logout/clear очищают encrypted state и очереди.
- Device-only clear и server account deletion разделены.

### Помощник и маршруты

- Ложный AI route удалён.
- Добавлен честный справочный помощник.
- Privacy route исправлен.
- Internal UX Lab вынесен из production route tree.
- Route integrity guard проверяет 28 маршрутов.

### Box commerce

- Quote обязателен перед order.
- Quote содержит expiry и server price.
- Delivery fee принудительно равен 0.
- Order создаётся backend с idempotency.
- Subscription активируется только после paid order.
- Pause/skip/resume/cancel — server actions.
- Optional extras/substitutions default OFF.
- Production payment provider пока отсутствует; sandbox честно помечен.

### Аллергены и качество

- Добавлены структурированные allergen codes и severity.
- Конфликтный SKU блокирует quote.
- Неизвестный free-text allergen требует manual review.
- Добавлены Supplier, ProductBatch, BoxPackingRecord, ProductComplaint и recall/expiry/QA поля.
- Courier release блокируется без released/sealed/traceable packing record.

### Карта и доставка

- Сохранена MapLibre/fullscreen picker логика.
- Ручное изменение улицы/дома снимает прежний verified status.
- Пользователь обязан повторно подтвердить точку и backend zone check.
- Адрес сохраняется только через backend; draft не теряется при ошибке.
- Доставка включена в тариф и всегда 0.

### UX/accessibility

- Touch targets приведены к минимуму 48 dp в проверяемых компонентах.
- Active bottom tab не сдвигается.
- Keyboard/safe-area guards сохранены.
- Debug/admin frontend отсутствуют.

## Автоматическая проверка

- TypeScript: PASS
- ESLint: PASS
- Unit: 25 suites / 223 tests PASS
- Contract integration: 1 suite / 2 tests PASS
- Routes: 28 PASS
- Touch targets static guard: PASS
- UI geometry: PASS
- Bottom safe area: PASS
- Mobile Only boundary: PASS
- Android reproducibility static guard: PASS

## Честные блокеры

1. Prisma validation не завершилась из-за `EAI_AGAIN binaries.prisma.sh`.
2. Реальная PostgreSQL база и migrations не запускались.
3. Integration suite остаётся contract-level, не живой HTTP/DB E2E.
4. Production payment provider/webhook не подключён.
5. В среде нет Android SDK/ADB, поэтому APK не собран и не установлен.
6. Device QA, TalkBack и пользовательское тестирование не выполнены.
7. Отдельная admin-panel/courier app не проверены в живой цепочке.
8. Модель качества Box реализована в данных/API, но физическая операционная процедура требует внедрения людьми.

## Статус

**CODE-LEVEL RECOVERY RC. PRODUCTION RELEASE BLOCKED.**
