# Release notes — LOUSA MOON 1.18.22 (133)

## Native splash handoff repair

- Removes the path that immediately cancelled Paper Moon when Android's native splash had already hidden or rejected the hide call.
- Caps the native splash handoff at 750ms and always continues the React animation after a failure or timeout.
- Adds a 320ms layout watchdog so a missing `onLayout` event cannot keep the scene invisible.

## Paper Moon startup guarantee

- Decouples visible Paper Moon start from SecureStore hydration, Firebase recovery and Expo Router redirects.
- Begins after the mounted root Stack has rendered two frames, with a 1.6-second root-frame watchdog for Android process restoration.
- Adds a 1.6-second image-decode watchdog: missing `Image.onLoad` events use the calm fallback instead of preventing animation.
- Keeps the final content handoff gated so the overlay cannot disappear before the root screen is safe to interact with.

## Global Paper Moon startup repair

- Moves the Paper Moon scene above the entire mounted root navigation tree, so it runs once on every cold launch for login, guest and restored-session routes.
- Starts the visible timeline only after the destination route commits two React frames; there is no auth-route-only owner and no white route handoff.
- Keeps Reduce Motion and image-fallback handoffs visible for about two seconds instead of flashing by.
- Retries a failed paper asset once, then uses a calm native-view fallback; an image error cannot force an immediate finish.
- Adds trace events for route readiness, image fallback, first frame, native splash handoff and animation completion.

## Root navigation crash fix

- Fixes `Attempted to navigate before mounting the Root Layout component`.
- Root `Stack` now mounts unconditionally on the first render.
- Adds a lightweight `app/index.tsx` startup route under the held native splash.
- Moves hydration and auth redirects into a sibling coordinator.
- Every startup redirect waits for `useRootNavigationState()?.key`.
- Removes the route-stability bypass that could expose the wrong screen.


## Startup recovery hotfix

- Normalizes legacy/malformed persisted theme values before ThemeProvider renders.
- Bounds SecureStore reads and continues with safe in-memory defaults without deleting encrypted data.
- Hydration and route timeouts no longer replace the app with a permanent fatal card.
- Adds one automatic runtime recovery and manual Retry / Safe login controls.
- QA release screens expose the real technical error instead of a generic message.

## Google Sign-In and online session repair

- Removed unconditional Google provider sign-out before every login.
- Added explicit Google Play Services and OAuth configuration errors.
- Added a single-attempt Google auth state machine that blocks duplicate taps.
- Added real SDK timeouts using `Promise.race`, including native promises that ignore `AbortSignal`.
- Added separate limits for Google/Firebase/backend readiness/backend session stages.
- Added `/ready` backend readiness with database, auth schema, Redis policy and Firebase Admin checks.
- Firebase ID token is sent as a Bearer token with a correlation attempt ID.
- Added bounded transient retries without reopening the Google chooser.
- Firebase-authenticated users enter safe local limited mode when backend is sleeping or temporarily unavailable.
- Added automatic background server-session recovery at 5s, 15s and 30s intervals.
- Backend session tokens are committed atomically and rolled back on SecureStore failure.
- Firebase ID tokens are no longer persisted manually.
- Backend Firebase verification requires Admin SDK credentials in staging/production.
- Render QA configuration no longer contradicts production Redis/payment validation.
- Added idempotent user creation and explicit account-link conflict handling.
- Added `/health` liveness and `/ready` readiness separation.
- QA signing now requires one stable external keystore; a random per-machine debug key is forbidden.
- Added OAuth certificate matrix and hard build failure when installed signing SHA is absent from Firebase config.

## Known external blocker

The execution environment's generated QA key has SHA-1 `E8:95:25:BD:CA:6D:C1:07:19:55:E9:5F:FD:AD:E8:C0:14:B6:47:28`, while the checked-in QA Firebase client contains `7E:6A:30:34:AE:34:F9:B6:C1:D3:23:4B:2A:00:13:45:3A:00:D1:5A`. The source intentionally refuses to build a Google-enabled QA APK until the actual signing key matches a Firebase-registered SHA.
