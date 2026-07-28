# Google Auth build 128 — proven root causes

## Confirmed from source and signing verification

1. **QA signing SHA mismatch.** The local QA signing key inspected in this environment has SHA-1 `E8:95:25:BD:CA:6D:C1:07:19:55:E9:5F:FD:AD:E8:C0:14:B6:47:28`; the Firebase Android OAuth client for `com.lousa.moon.qa` contains `7E:6A:30:34:AE:34:F9:B6:C1:D3:23:4B:2A:00:13:45:3A:00:D1:5A`. A Google chooser may open, but that APK cannot be accepted as the registered Android OAuth application.
2. **Unbounded backend exchange.** The former mobile code used plain `fetch` for `/v1/auth/firebase/session`, so a sleeping/unreachable server could leave the login spinner waiting for the platform network timeout.
3. **Limited mode was rejected by the screen.** Firebase could authenticate successfully while backend creation failed, but `login.tsx` treated every non-`authenticated` state as a failed login.
4. **Google was signed out before every attempt.** This forced repeated account selection and destroyed the provider session needed for a backend-only retry.
5. **Render QA configuration contradicted production validation.** It declared production behavior while also selecting sandbox payment and mandatory Redis settings that could prevent startup.
6. **Firebase verification could fall back to external REST in deployed environments.** Staging/production did not strictly require Firebase Admin credentials.
7. **The original timeout helper did not bound native SDK promises.** Aborting a signal did not release callers when Firebase ignored the signal. Build 128 uses `Promise.race`.
8. **QA signing was generated per machine.** A newly generated debug key cannot have the same fingerprint as a previously registered OAuth client. Build 128 requires one stable external QA key and fails on mismatch.

## Not proven in this environment

The exact response of the currently deployed Render service could not be measured because DNS resolution is unavailable in the execution environment. Physical-device logcat and backend request logs are still required to identify the exact failure stage of the user's installed APK.
