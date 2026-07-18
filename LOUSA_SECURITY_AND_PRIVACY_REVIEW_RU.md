# LOUSA Security and Privacy Review — 1.18.0

## Исправлено в коде

- health/user/wellness/box state используют encrypted chunked SecureStore;
- native build не переходит молча на plaintext AsyncStorage;
- legacy AsyncStorage values мигрируются и удаляются;
- cycle/address/settings queues зашифрованы;
- logout/clear удаляют encrypted state и drafts;
- Device clear отделён от server account deletion;
- fake AI удалён;
- mobile project не содержит admin frontend;
- courier/delivery API строится через allow-list без cycle/symptom/mood/note fields;
- OTP/password/token не должны логироваться;
- separate domains HealthPrivateDomain и DeliveryDomain сохранены архитектурно.

## Требует живой проверки

- Android data extraction после migration;
- Keystore behaviour после reinstall/lockscreen changes;
- token refresh/revocation;
- два пользователя на одном устройстве;
- role authorization отдельной admin-panel/courier app;
- server logs/observability redaction;
- backup/restore policy;
- data retention и account deletion SLA;
- privacy/legal review для Армении и целевых рынков.

## Остаточный риск

Expo SecureStore chunking лучше plaintext AsyncStorage, но для больших долгосрочных медицинских журналов предпочтительна отдельная зашифрованная SQLite/MMKV база с transactional migration и backup policy. Текущий вариант считается усиленным RC, но требует Device QA и threat-model review.
