# LOUSA Moon 1.18.0 — сборка Mobile Only

## Что находится в архиве

- мобильное приложение React Native / Expo;
- Android native project;
- общий backend API;
- Prisma schema и migrations;
- assets и custom Expo plugins;
- unit/integration/static проверки;
- отчёты полного восстановления.

В проекте **нет встроенной админ-панели**. Отдельная админ-программа использует backend API.

## Требования

- Node.js 20+;
- npm;
- JDK 17 или 21;
- Android SDK;
- PostgreSQL для живой backend-проверки;
- корректный QA `google-services.json` для `com.lousa.moon.qa`.

## 1. Установка

```bash
npm ci
```

## 2. Переменные окружения

```bash
cp BUILD_ENV.example .env
```

Для телефона замените `192.168.1.100` на LAN-IP Mac. На Android нельзя использовать `localhost` для API Mac.

## 3. Firebase QA

```bash
npm run firebase:install-google-services:qa
FIREBASE_SIGNING_VARIANT=qa npm run verify:firebase-signing-sha
```

## 4. Android SDK

```bash
printf 'sdk.dir=%s\n' "$HOME/Library/Android/sdk" > android/local.properties
```

## 5. Полная автоматическая проверка

```bash
npm run verify:complete-product-recovery-full
```

Ожидается:

- TypeScript PASS;
- ESLint PASS;
- unit tests PASS;
- contract integration tests PASS;
- route integrity PASS;
- touch targets PASS;
- UI geometry PASS;
- Mobile Only boundary PASS;
- Android reproducibility PASS.

## 6. Backend и база

```bash
npm run prisma:generate
npm run prisma:validate
npm run prisma:migrate:deploy
npm run prisma:seed
npm run api:dev
```

`prisma:validate/generate` требуют доступа к Prisma binaries. Миграции выполнять только на резервируемой QA базе.

## 7. QA APK

```bash
npm run android:apk:qa
```

APK:

```text
android/app/build/outputs/apk/qa/app-qa.apk
```

Чистая установка:

```bash
adb uninstall com.lousa.moon.qa
adb install android/app/build/outputs/apk/qa/app-qa.apk
```

## 8. Production ограничения

Production-релиз запрещён, пока не выполнены:

- живой PostgreSQL integration test;
- подключение production payment provider и webhook;
- сборка и проверка APK на Android;
- полный Device QA;
- проверка отдельной admin-panel и courier app;
- операционная проверка партий/QA содержимого Box.
