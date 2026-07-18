# LOUSA Device QA Results — 1.18.0

## Статус

**НЕ ВЫПОЛНЕНО В ТЕКУЩЕЙ СРЕДЕ.** Android SDK, ADB и реальное устройство отсутствуют.

Это не заменено скриншотами старых версий и не обозначено как PASS.

## Обязательная матрица

- Samsung с gesture navigation;
- Android с 3-button navigation;
- 320–360 dp;
- 390–412 dp;
- font scale 100%, 130%, 150%;
- русский, английский, армянский;
- TalkBack;
- online/offline/reconnect;
- backend available/unavailable;
- location granted/denied/permanently denied.

## P0 сценарии

1. Fresh install → Skip onboarding → ноль period records и отсутствие прогноза.
2. Добавить period start → изменить → удалить → Undo → restart → reconnect.
3. Пропущенное forecast window не начинает новый цикл.
4. Auth email/phone/Firebase ошибки не теряют ввод.
5. Address map сохраняет zoom; street/house edit снимает verified status.
6. Quote → sandbox payment → paid order → subscription.
7. Double tap не создаёт два order.
8. Delivery fee отображается 0 / включена в тариф.
9. Allergen conflict блокирует quote.
10. Logout очищает health/address drafts и следующий пользователь не видит данные.
11. TalkBack читает календарь, формы и bottom tabs.
12. Tab bar не перекрывает CTA/поля.

Результаты нужно заполнить на реальном APK с video/logcat evidence.
