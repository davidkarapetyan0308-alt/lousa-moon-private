# LOUSA MOON

React Native / Expo mobile application with a committed native Android project and Node API.

## Current handoff

- App version: `1.18.22`
- Android versionCode: `133`
- Production package: `com.lousa.moon`
- QA package: `com.lousa.moon.qa`
- Firebase project ID: `lousa-moon`
- Online backend: `https://lousa-moon-api.onrender.com`
- Expo SDK: `52`
- React Native: `0.76.9`
- Reanimated: `3.16.x`

## Required toolchain

- Node.js: `20.x` or `22.x`
- npm: `10+`
- Java/JDK: `17`
- Android compileSdk: `35`
- Android targetSdk: `35`
- Android minSdk: `24`
- Android Build Tools: `35.0.0`
- Gradle wrapper: `8.10.2`
- Android NDK: `26.1.10909125`

## One-command QA APK

```bash
npm ci && EXPO_PUBLIC_LOUSA_API_URL=https://lousa-moon-api.onrender.com PUBLIC_API_URL=https://lousa-moon-api.onrender.com npm run android:apk:qa
```

Expected output:

```text
android/app/build/outputs/apk/qa/app-qa.apk
```

The release QA APK contains its JavaScript bundle and must not require Metro, the build Mac, localhost, emulator host aliases, or a private LAN address.

## Paper Moon startup architecture

For an unauthenticated cold start, the only visible sequence is designed to be:

```text
native Android splash → fully decoded Paper Moon first frame → cloud/moon reveal → same auth screen becomes interactive
```

The native splash is held at module load. Paper Moon starts as soon as the mounted root Stack has rendered two frames; it never waits for session restoration or a redirect. Bundled asset resolution, successful `Image.onLoad` decoding and layout still protect the normal scene, while bounded layout/decode watchdogs select the calm fallback instead of suppressing the animation. A failed or already-complete native splash handoff now continues the React Paper Moon scene instead of cancelling it. The long rope was removed from the moon PNG; the thread is now an independent anchored animated layer.

See:

- `docs/PAPER_MOON_ARCHITECTURE.md`
- `docs/PAPER_MOON_DEVICE_QA.md`

## Google Sign-In architecture

Google login is split into measured stages: Google Play Services, Google ID token, Firebase credential, Firebase ID token, backend readiness, server-session exchange and atomic local persistence. Backend timeouts no longer leave an endless spinner. A temporary backend outage enters local limited mode and retries without reopening Google.

QA builds require one stable external signing keystore whose SHA-1/SHA-256 is registered for `com.lousa.moon.qa`; the build fails before Gradle on mismatch. See `docs/GOOGLE_AUTH_ARCHITECTURE.md`, `docs/GOOGLE_OAUTH_CERTIFICATE_MATRIX.md`, and `docs/BACKEND_ENV_MATRIX.md`.

## Important build files

- `BUILD.md`
- `RELEASE_NOTES.md`
- `.env.qa.example`
- `.env.production.example`
- `docs/HANDOFF.md`
- `scripts/validate-build-env.sh`
- `scripts/build-qa-apk.sh`
- `scripts/build-prod-apk.sh`
- `scripts/verify-apk.sh`
- `scripts/package-source-zip.sh`
- `scripts/verify-source-zip.sh`
- `scripts/run-paper-moon-device-qa.sh`

## Source ZIP exclusions

The handoff ZIP intentionally excludes:

- `node_modules`;
- `.gradle` and `android/.gradle`;
- `android/app/build`;
- `.expo`;
- `ios/Pods`;
- `dist` and `dist_web`;
- APK/AAB outputs;
- `.git`;
- private keystores;
- non-example `.env` files.

A static check or successful Gradle build does not prove animation quality. Device acceptance requires a clean QA release installation, cold-start video, `gfxinfo` framestats, and preferably a Perfetto trace.
