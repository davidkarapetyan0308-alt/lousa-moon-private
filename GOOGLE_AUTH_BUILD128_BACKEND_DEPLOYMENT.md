# Google Auth build 128 — backend deployment

## QA/staging

Deploy `render.yaml` with real values for:

- `DATABASE_URL` and optional migration URL;
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`;
- `FIREBASE_SERVICE_ACCOUNT_JSON` or equivalent Admin credentials;
- `FIREBASE_PROJECT_ID=lousa-moon`;
- `PUBLIC_API_URL=https://lousa-moon-api.onrender.com`.

`/health` proves only process liveness. `/ready` must return HTTP 200 and report database, auth schema and Firebase Admin as ready before a full server session can be created.

## Production

Use `render.production.example.yaml`, an always-on production service, Redis, real payment provider credentials and production signing fingerprints. Do not use the free sleeping QA service as production authentication infrastructure.

## Deployment acceptance

After deploy, record cold and warm responses for `/health` and `/ready`, then correlate one successful mobile `X-Auth-Attempt-ID` with backend logs. Never place the Firebase Admin private key in the mobile source or APK.
