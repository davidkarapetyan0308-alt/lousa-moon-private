# LOUSA MOON Android build — 1.18.22 (133)

## Identity

- Production package: `com.lousa.moon`
- QA package: `com.lousa.moon.qa`
- Firebase project: `lousa-moon`
- Public API: `https://lousa-moon-api.onrender.com`

## Toolchain

- Node.js `20.x` or `22.x`
- npm `10+`
- JDK `17`
- compileSdk / targetSdk `35`
- minSdk `24`
- Build Tools `35.0.0`
- Gradle wrapper `8.10.2`
- NDK `26.1.10909125`

## Required QA signing configuration

QA Google Sign-In is valid only when the exact key signing the APK is registered for `com.lousa.moon.qa` in Firebase. The keystore must stay outside the source ZIP.

```bash
export LOUSA_QA_KEYSTORE_PATH=/absolute/path/to/lousa-qa.keystore
export LOUSA_QA_KEY_ALIAS=androiddebugkey
export LOUSA_QA_KEYSTORE_PASSWORD='...'
export LOUSA_QA_KEY_PASSWORD='...'
```

The build stops before Gradle when the key SHA-1 does not match `google-services.json`. Never generate a new QA signing key automatically on another Mac.

## One-command QA APK

```bash
npm ci && EXPO_PUBLIC_LOUSA_API_URL=https://lousa-moon-api.onrender.com PUBLIC_API_URL=https://lousa-moon-api.onrender.com npm run android:apk:qa
```

## Fully clean QA APK

```bash
rm -rf node_modules .expo android/.gradle android/app/build
npm ci
EXPO_PUBLIC_LOUSA_API_URL=https://lousa-moon-api.onrender.com \
PUBLIC_API_URL=https://lousa-moon-api.onrender.com \
npm run android:apk:qa
```

Expected output:

```text
android/app/build/outputs/apk/qa/app-qa.apk
package: com.lousa.moon.qa
versionName: 1.18.22-qa
versionCode: 133
```

The script verifies environment URLs, Firebase clients, Web OAuth client, actual signing SHA-1/SHA-256, TypeScript, lint, Jest, Paper Moon, Gradle output and APK metadata.

## Production

Configure `android/keystore.properties`, `.env.production`, production Firebase signing fingerprints, Redis and a real payment provider, then run:

```bash
LOUSA_ENV_FILE=.env.production npm ci
LOUSA_ENV_FILE=.env.production npm run android:apk:release
```

## Source ZIP

```bash
npm run package:source
```

The source ZIP excludes dependencies, caches, build products, APK/AAB files, keystores and secret env files.
