# One-time admin owner bootstrap

This endpoint exists only to create the first LOUSA administrator after a controlled deployment. It is disabled by default and must never be left enabled.

## Required temporary Render environment variables

Set these values only after the build containing this feature is deployed:

```text
ADMIN_BOOTSTRAP_ENABLED=true
ADMIN_BOOTSTRAP_SECRET=<a-new-random-secret-of-at-least-32-characters>
```

Do not add either value to a mobile application, source repository, client-side configuration, screenshots, or support tickets.

## Single controlled request

Use a terminal on a trusted computer. Replace all placeholder values locally; do not paste a real password into shared chat.

```bash
curl --fail-with-body -X POST "https://YOUR-API/v1/admin/bootstrap-owner" \
  -H "Content-Type: application/json" \
  -H "x-admin-bootstrap-secret: YOUR_TEMPORARY_SECRET" \
  --data '{"email":"OWNER_EMAIL","name":"LOUSA Owner","password":"A-long-unique-password-with-symbols"}'
```

Expected result:

```json
{"ok":true,"admin":{"email":"OWNER_EMAIL","role":"OWNER"}}
```

The endpoint returns `409 OWNER_ALREADY_EXISTS` after a successful creation. This is expected and proves it cannot create a second owner.

## Mandatory shutdown

Immediately after the successful request, delete both `ADMIN_BOOTSTRAP_ENABLED` and `ADMIN_BOOTSTRAP_SECRET` from Render, then redeploy the service. With either value absent, the endpoint returns `404` and does not reveal that bootstrapping exists.

Sign in through the ordinary admin login only after the variables have been removed. Do not use this endpoint for password changes or additional admins.

## Security properties

- Requires two explicit server-only variables and a secret header.
- Requires exact JSON fields: `email`, `name`, `password`.
- Requires a 14+ character password containing upper-case, lower-case, digit, and special character.
- Rate limited to three attempts per IP per 15 minutes through Redis in production.
- Uses a PostgreSQL transaction advisory lock to prevent concurrent owner creation.
- Saves only the existing scrypt password hash and writes an audit event without email, password, or bootstrap secret.
