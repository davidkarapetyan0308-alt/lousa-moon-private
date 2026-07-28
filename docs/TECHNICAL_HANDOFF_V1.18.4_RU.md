# LOUSA Moon V1.18.4 Build 115: Technical Handoff

## Назначение

Этот документ описывает техническое состояние проекта LOUSA Moon на момент передачи в работу. Цель текущей версии - рабочее мобильное приложение, которое не зависит от Mac после установки APK и умеет работать с публичным backend/Firebase auth.

## Текущие параметры сборки

- Версия приложения: `1.18.4`
- Android QA package: `com.lousa.moon.qa`
- Android production package: `com.lousa.moon`
- Android versionCode: `115`
- Основная команда сборки APK: `npm run android:apk:qa`
- Точка входа Expo: `expo-router/entry`
- React Native: `0.76.9`
- Expo: `~52.0.0`
- Firebase mobile SDK: `@react-native-firebase/app`, `@react-native-firebase/auth`
- Backend Firebase Admin: `firebase-admin`
- Database ORM: Prisma

## Архитектура

Проект состоит из четырех основных частей:

1. Mobile app
   - Expo Router + React Native.
   - Основной код находится в `app/` и `src/`.
   - Состояние и локальное хранение: Zustand, AsyncStorage для несекретных предпочтений и SecureStore для чувствительных данных. Большие sensitive datasets требуют отдельного encrypted-database release.
   - Авторизация: Firebase native identity + обязательный backend session exchange + явный limited local mode при недоступности backend.

2. API backend
   - Код находится в `apps/api/`.
   - Запускается через `tsx apps/api/src/server.ts`.
   - Production startup: `scripts/start-production-api.sh`.
   - Prisma schema: `apps/api/prisma/schema.prisma`.

3. Android native project
   - Код находится в `android/`.
   - QA build использует package `com.lousa.moon.qa`.
   - Firebase config читается из `google-services.json` / `android/app/google-services.json`.

4. Build and verification scripts
   - Все ключевые проверки лежат в `scripts/`.
   - APK сборка не должна идти напрямую через случайные Gradle команды. Использовать `npm run android:apk:qa`.

## Auth Flow

Основной сценарий:

1. Firebase SDK подтверждает личность пользователя.
2. Приложение получает Firebase ID token.
3. Backend проверяет ID token и создаёт собственную server session.
4. Только после этого состояние становится `authenticated`.
5. Если backend недоступен, приложение переходит в `local_limited_mode`, не подменяет backend token Firebase token и блокирует server-authoritative действия до успешного retry.

Firebase-only состояние нельзя считать полноценным входом в LOUSA backend.

## Firebase

Firebase чувствителен к трем вещам:

- Android package name.
- `google-services.json`.
- SHA-1/SHA-256 fingerprint в Firebase Console.

QA package: `com.lousa.moon.qa`.

Если package или signing key поменять без обновления Firebase Console, Google sign-in снова начнет ломаться.

## Backend Runtime

Production backend требует:

- `APP_ENV=production`
- `NODE_ENV=production`
- `PUBLIC_API_URL=https://...`
- `DATABASE_URL`
- `MIGRATION_DATABASE_URL`
- `REDIS_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `AUTH_PROVIDER=firebase`
- `FIREBASE_PROJECT_ID=lousa-moon`
- `FIREBASE_SERVICE_ACCOUNT_JSON`

На Render используется `render.yaml`. На другом сервисе нужно перенести те же env vars из `.env.production.example`.

Startup command:

```bash
scripts/start-production-api.sh
```

Health check:

```text
GET /health
```

## Database

Prisma schema находится здесь:

```text
apps/api/prisma/schema.prisma
```

Перед запуском production backend нужно выполнить:

```bash
npm run prisma:generate
npm run prisma:migrate:deploy
node scripts/ensure-auth-db-schema.js
```

Если managed host использует отдельный migration URL, использовать `MIGRATION_DATABASE_URL` для миграций и `DATABASE_URL` для runtime.

## Maps / Address

Приложение использует карту и адресные сервисы для пользовательского адреса/доставки LOUSA BOX. В проекте есть fallback на OpenFreeMap:

```text
EXPO_PUBLIC_OPENFREEMAP_STYLE_URL=https://tiles.openfreemap.org/styles/positron
EXPO_PUBLIC_DISABLE_PUBLIC_MAP_FALLBACK=false
```

MapTiler/Google keys необязательны для базового запуска, но могут быть подключены через env vars.

## Build Process

Для APK:

```bash
npm ci
npm run prisma:generate
npm run android:apk:qa
```

`scripts/build-qa-apk.sh` делает:

- загружает env через `scripts/load-env.sh`;
- включает `EXPO_PUBLIC_APP_MODE=api`;
- включает `EXPO_PUBLIC_AUTH_PROVIDER=firebase`;
- задает `LOUSA_BUILD_VARIANT=qa`;
- задает `LOUSA_ANDROID_PACKAGE=com.lousa.moon.qa`;
- проверяет Android env;
- проверяет Firebase config;
- проверяет online Firebase runtime;
- проверяет signing SHA;
- собирает `:app:assembleQa`.

## What To Verify Before Any New Build

Минимальный набор:

```bash
npm run typecheck
npm run lint -- --quiet
npm run smoke:firebase-auth-config
npm run smoke:online-firebase-runtime
npm run verify:firebase-signing-sha
npm run android:apk:qa
```

Ручная проверка на устройстве:

- app запускается без Metro;
- Google login не показывает server/Firebase Admin ошибку;
- email registration/login не падает raw backend ошибкой;
- app восстанавливает session после restart;
- ошибки сети отображаются нормальным текстом;
- API URL не `localhost`;
- профиль открывается после входа.

## Known Risk

Главный риск проекта - несогласованность между:

- Android package;
- Firebase Console SHA fingerprints;
- `google-services.json`;
- public backend env;
- backend database auth schema.

При любой работе с auth сначала проверять эти пять пунктов.

