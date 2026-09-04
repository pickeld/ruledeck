# Security

Report vulnerabilities privately. Do not open a public issue for a working exploit.

- Email: open a private GitHub security advisory on [pickeld/ruledeck](https://github.com/pickeld/ruledeck/security/advisories/new)

## What this project stores

- Passwords are hashed with Argon2id. They are never logged.
- Session cookies are opaque (`id`), HttpOnly, `SameSite=Lax`, and hashed at rest.
- Developer sync tokens (`rds_…`) are shown once, stored only in gitignored `.ruledeck/credentials` on the laptop, and hashed in Postgres (`Membership.syncTokenHash`).
- Audit events record actions, not secrets.

## Local secrets you must not commit

- `.env`
- `.local-credentials`
- `.ruledeck/credentials`
- `/output` (generated kits can include a sync token)

`.env.example` contains placeholders only.

## Production notes

This first release is meant to be run on a private network or behind your own auth gateway.

- Set `RULEDECK_HTTPS=true` and `APP_PUBLIC_URL` to an `https://` origin.
- Replace the seeded local users before exposing the UI.
- Use Postgres migrations instead of relying on `prisma db push` for irreversible schema changes.
- Rate limiting for `/api/v1/*` is in-process (about 60 requests/minute/token) and resets on restart.
