# LOUSA MOON handoff — 1.18.22 / 133

## Fixed identity

- Production package: `com.lousa.moon`
- QA package: `com.lousa.moon.qa`
- Firebase project: `lousa-moon`
- Public API: `https://lousa-moon-api.onrender.com`

## Do not change without a new build and QA cycle

- package IDs, versionName/versionCode;
- Google Web OAuth client selection;
- QA/release signing keys or registered Firebase fingerprints;
- Firebase project and Admin project ID;
- auth state machine and per-stage timeouts;
- pending backend-session metadata keys;
- atomic session commit order;
- `/health`, `/ready`, and `/v1/auth/firebase/session` contracts;
- Paper Moon startup gate, root-frame/layout/decode watchdogs and non-fatal splash handoff;
- API URL and APK verification scripts.

## Google/Firebase signing rule

The QA signing key stays outside the ZIP. Set `LOUSA_QA_KEYSTORE_PATH`, alias and passwords before building. Its SHA-1/SHA-256 must be registered for `com.lousa.moon.qa`. The build must fail when they do not match. Do not solve a mismatch by editing only `google-services.json`; create/register the matching Android OAuth client in Firebase/Google Cloud and download a fresh config.

## Backend requirements

QA/staging requires:

- `DATABASE_URL`;
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`;
- `PUBLIC_API_URL`;
- `FIREBASE_PROJECT_ID=lousa-moon`;
- Firebase Admin credentials;
- `ALLOW_FIREBASE_REST_FALLBACK=false`.

Production additionally requires Redis and a real payment provider. Firebase service-account credentials must never be placed in the mobile ZIP.

## Auth behavior

```text
Google chooser
→ Google ID token
→ Firebase credential
→ fresh Firebase ID token
→ backend /ready
→ backend session exchange
→ atomic SecureStore commit
→ app
```

If Google and Firebase succeed while backend is temporarily unavailable, the app enters `local_limited_mode`, keeps Firebase identity, does not reopen Google, and retries server exchange in the background.

## Required acceptance

A release is not accepted without:

1. successful OAuth signing matrix;
2. QA release APK;
3. clean install on Android;
4. successful new and existing Google users;
5. backend cold-start and offline scenarios;
6. client trace + backend correlation log;
7. package/version/SHA/APK verification.
