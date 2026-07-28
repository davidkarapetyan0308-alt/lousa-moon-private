# LOUSA Moon V1.18.4: Что нельзя трогать без полной проверки

Этот файл нужен для следующего разработчика или агента. Ниже перечислены зоны, которые нельзя менять "на глаз", потому что именно они чаще всего ломают APK, Google login, online backend и независимость приложения от Mac.

## Нельзя менять без причины

### 1. Android package names

Файл:

```text
app.config.js
```

Критичные значения:

```text
com.lousa.moon.qa
com.lousa.moon
```

Если поменять package name, нужно заново настроить Firebase Android app, OAuth client и SHA fingerprints.

### 2. Android versionCode/version

Файл:

```text
app.config.js
```

Текущие значения:

```text
version: 1.18.4
versionCode: 115
```

Нельзя откатывать `versionCode` вниз. Android и магазины приложений считают это downgrade.

### 3. Firebase config

Файлы:

```text
google-services.json
android/app/google-services.json
```

Нельзя удалять, заменять случайным файлом или скачивать config от другого Firebase project без полной перенастройки.

### 4. Firebase identity и backend session boundary

Зоны:

```text
src/services/firebase/
src/features/auth/
src/services/api/
```

Нельзя возвращать старый Firebase-token-as-backend-token fallback. Полная авторизация разрешена только после успешного backend session exchange. Limited local mode должен оставаться явным и блокировать server-authoritative действия.

### 5. Production API URL

Нельзя собирать APK с:

```text
localhost
127.0.0.1
10.0.2.2
```

Эти адреса подходят только для эмулятора/локального теста. Реальный телефон не должен зависеть от Mac.

### 6. Build scripts

Критичные файлы:

```text
scripts/build-qa-apk.sh
scripts/load-env.sh
scripts/validate-android-build-env.js
scripts/smoke-firebase-auth-config.js
scripts/smoke-online-firebase-runtime.js
scripts/verify-firebase-signing-sha.js
scripts/ensure-standard-debug-keystore.sh
```

Нельзя обходить эти проверки прямой командой Gradle, если собирается APK для передачи пользователю.

### 7. Backend startup

Критичные файлы:

```text
Dockerfile
render.yaml
scripts/start-production-api.sh
scripts/ensure-auth-db-schema.js
apps/api/prisma/schema.prisma
```

Нельзя удалять `ensure-auth-db-schema.js`, потому что он страхует backend auth schema при проблемах с миграциями.

### 8. Secret handling

Нельзя коммитить или класть в публичный ZIP:

```text
.env
FIREBASE_SERVICE_ACCOUNT_JSON as raw file
private_key JSON
keystore passwords
JWT secrets
DATABASE_URL with real password
REDIS_URL with real password
```

В ZIP должны быть только `.env.example` и `.env.production.example`.

### 9. Session and secure storage

Критичные зоны:

```text
src/services/security/
src/store/
src/bootstrap/
```

Нельзя менять session restore без проверки restart сценария на реальном телефоне.

### 10. Public deployment assumptions

Нельзя считать, что "если работает на Mac, значит работает онлайн". Перед передачей APK нужно проверить:

- public backend доступен с телефона;
- APK не требует Metro;
- env vars на backend заданы в dashboard хостинга;
- Firebase Admin credentials реально работают на server side;
- CORS/health/auth endpoints отвечают.

## Что можно менять спокойно

Относительно безопасные зоны, если не затрагивать auth/build/backend env:

- тексты интерфейса;
- визуальные отступы и цвета;
- статические onboarding экраны;
- локальные подсказки;
- документацию;
- тесты, если они не ослабляют проверки.

## Правило перед изменением

Если изменение касается auth, Firebase, package name, backend env, database migration, build script или API URL, сначала написать короткий технический план и только потом менять код.

