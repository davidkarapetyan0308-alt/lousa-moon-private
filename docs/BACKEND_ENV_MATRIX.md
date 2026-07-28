# Backend environment matrix — build 128

| Setting | QA/staging | Production |
|---|---|---|
| `APP_ENV` | `staging` | `production` |
| `NODE_ENV` | `production` | `production` |
| `DATABASE_URL` | required | required |
| `REQUIRE_REDIS` | `false` unless QA explicitly tests Redis | `true` |
| Firebase verification | Admin credentials required | Admin credentials required |
| `ALLOW_FIREBASE_REST_FALLBACK` | `false` | `false` |
| Payments | `sandbox` | real provider only |
| `/health` | process liveness only | process liveness only |
| `/ready` | DB + auth schema + Firebase Admin + Redis policy | same |

The mobile app may enter `local_limited_mode` only when Google and Firebase succeeded but `/ready` or `/v1/auth/firebase/session` is temporarily unavailable. It must retry with a fresh Firebase ID token without opening Google Account Chooser again.
