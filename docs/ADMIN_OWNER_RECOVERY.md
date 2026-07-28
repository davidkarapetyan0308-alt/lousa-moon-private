# One-time owner password recovery

This emergency endpoint exists solely to recover access to the single existing LOUSA `OWNER` account. It is disabled by default. It does not create users, does not accept roles, and permanently refuses a second use.

## Temporary Render variables

```text
ADMIN_OWNER_RECOVERY_ENABLED=true
ADMIN_OWNER_RECOVERY_SECRET=<a-new-random-secret-of-at-least-32-characters>
```

Never place these values in mobile clients, a repository, screenshots, or tickets.

## Controlled request

```bash
curl --fail-with-body -X POST "https://YOUR-API/v1/admin/recover-owner-password" \
  -H "Content-Type: application/json" \
  -H "x-admin-owner-recovery-secret: YOUR_TEMPORARY_SECRET" \
  --data '{"email":"admin@lousa.app","password":"A-long-unique-password-with-symbols"}'
```

On success, all active sessions for the owner are revoked and the normal admin login can use the new password.

## Mandatory shutdown

Immediately delete both recovery variables from Render and redeploy. The endpoint returns `404` when either value is absent.

## Guardrails

- Exact JSON fields only: `email`, `password`.
- Requires 14+ characters with upper-case, lower-case, digit, and special character.
- Requires exactly one existing `OWNER` matching the supplied email.
- Uses a PostgreSQL advisory lock, 3 attempts per IP per 15 minutes, and constant-time secret comparison.
- Revokes all prior owner sessions.
- Writes a non-sensitive audit record and permits no second recovery.
