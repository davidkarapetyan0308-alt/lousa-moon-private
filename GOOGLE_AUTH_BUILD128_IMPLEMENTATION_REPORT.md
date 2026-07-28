# Google Auth build 128 — implementation report

## Identity

- App: `1.18.17`
- versionCode: `128`
- QA package: `com.lousa.moon.qa`
- Production package: `com.lousa.moon`
- Firebase project: `lousa-moon`

## Client changes

- Added `authTrace.ts` with per-attempt monotonic stage events and token redaction.
- Added `googleAuthMachine.ts` to block parallel attempts and distinguish cancellation, failure, limited mode and success.
- Removed automatic `GoogleSignin.signOut()` before login.
- Added Play Services checks and explicit `DEVELOPER_ERROR` mapping.
- Added real upper-bound timeouts for Firebase/native promises using `Promise.race`.
- Added backend `/ready` preflight and bounded session exchange retries.
- Added Bearer Firebase ID token and app/attempt correlation headers.
- Added safe `local_limited_mode` after Firebase success and transient backend failure.
- Added automatic background server-session retries without reopening Google.
- Added atomic SecureStore commit/rollback for backend access, refresh and session values.
- Removed manual persistence of Firebase ID tokens.
- Added stage-aware Google loading text.

## Backend changes

- Added lightweight `/health` and dependency-aware `/ready`.
- Staging/production now require Firebase Admin credentials and strong JWT secrets.
- Disabled Firebase REST verification fallback outside development/test.
- Added database/Redis readiness timeouts.
- Firebase session endpoint accepts Bearer tokens and logs correlation IDs without credentials.
- User/session persistence uses a database transaction and idempotent upsert behavior.
- Legacy account email/phone collisions return `AUTH_ACCOUNT_LINK_REQUIRED` rather than silently linking identities.
- Render QA is `APP_ENV=staging`, Redis optional, sandbox payment allowed only in QA.
- Startup migration failures are fatal outside development/test.

## Signing protection

- QA Gradle build uses one stable external keystore.
- Build scripts no longer generate a random QA key.
- OAuth verification checks actual key SHA-1/SHA-256 before typecheck/Gradle.
- The current execution key mismatch is intentionally a hard failure.

## Checks completed

- 188 TS/TSX files parsed with zero syntax errors.
- Full static verification passed.
- `withTimeout` was runtime-tested against a promise that ignores AbortSignal.
- Staging environment validation was runtime-tested for mandatory JWT secrets.
- OAuth certificate verification correctly failed on the current unregistered key.

## Checks unavailable

`npm ci` failed with HTTP 503 for `zustand-4.5.7.tgz`; a public-registry attempt did not complete. Therefore semantic typecheck, ESLint, Jest, Prisma generation, Gradle APK and device QA are not claimed as passed.
