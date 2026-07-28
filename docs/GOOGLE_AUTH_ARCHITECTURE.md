# Google authentication architecture — build 128

1. Android Google Sign-In checks Google Play Services and returns a Google ID token.
2. React Native Firebase exchanges the Google credential and obtains a fresh Firebase ID token.
3. The app calls `GET /ready` with a 5-second timeout.
4. The app calls `POST /v1/auth/firebase/session` with `Authorization: Bearer <Firebase ID token>` and a 4-second timeout. One short retry is allowed.
5. Backend verifies the token through Firebase Admin, performs idempotent user/identity persistence in a database transaction, and creates LOUSA access/refresh sessions.
6. Tokens are written to SecureStore and read back before `authenticated` is committed.
7. If backend is temporarily unavailable, Firebase stays signed in, only retry metadata is saved, and the app enters `local_limited_mode`. Background/manual retry gets a fresh Firebase token; Google chooser is not reopened.

Security constraints:
- Google/Firebase tokens are never logged.
- Firebase ID tokens are not stored manually.
- Backend UID/email values are taken only from a verified Firebase token.
- Staging and production require Firebase Admin credentials.
