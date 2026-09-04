# Architecture

RuleDeck is a Next.js 16 App Router app with Postgres. The UI is a cookie session. Laptop sync is a separate Bearer-token API.

## Catalog and merge

Artifacts live on a project (`RULE`, `PROMPT`, `PROCEDURE`, `TOOL`). Each edit creates an `ArtifactVersion`. A `Release` pins a set of versions and can be marked live.

There is one `GLOBAL` project (slug `global`). Every other project inherits that live release.

**Live pack** for a project:

```
effectiveLive = merge(global.live, project.live)
```

Same `type:slug` → project wins.

**Draft preview** (generate without publishing):

```
effectiveDraft = merge(global.live, project latest versions)
```

Adapters in `src/lib/adapters.ts` turn the canonical list into platform files. The pack hash is the sorted `path:sha256(content)` list. Manifest files omit timestamps so the hash is stable.

## Membership and consent

`Invite` is a hashed, expiring link. Join creates a `Membership`.

Onboarding:

1. Pick vibe-coding platforms
2. Name the Cursor folder / git remotes that count as this project
3. Consent to writes
4. RuleDeck mints `rds_…`, hashes it (`syncTokenHash`), and writes a kit under `OUTPUT_ROOT/<slug>/members/<userId>/`

The kit includes generated platform files plus `.ruledeck/{config.json,sync.mjs,hooks,credentials}`. Credentials are gitignored.

## Workspace matching

A Cursor session is the folder the developer opened. `cli/sync.mjs` compares:

- `path.basename(repo)`
- `git remote -v` URLs (normalized)

against `.ruledeck/config.json` `match`.

- Match + `pull` / `post-merge` / `post-checkout` / `post-rewrite` → fetch live pack, write files, check in
- Match + `pre-push` → same, then `git add` managed paths; if they still differ from HEAD, abort the push
- No match → print `RuleDeck skip` and exit 0
- `install-hooks` in a non-matching folder → fail

`core.hooksPath=.ruledeck/hooks` is set only in the matching repo. Server-side `installSyncKit` does not enable hooks on the sandbox under `/output`.

## Compliance

Team status is computed from membership:

| Status | Meaning |
| --- | --- |
| Onboarding | Invite accepted, pack not applied |
| Following | Applied live release, files match, recent check-in |
| Broke pack | Different release or files drifted |
| Not applied | No generating platform / never applied |
| Stale | Last check-in older than 7 days |

## Authn

- Passwords: Argon2id
- Browser session: opaque cookie `id`, hashed, 8 hour absolute timeout
- Sync API: Bearer token, hashed, in-process rate limit

`/api/v1/*` and `/join/*` and `/login` are cookie-public. Sync routes still require a valid token.

## Layout

```
src/app/                 UI + /api/v1
src/lib/                 catalog, adapters, pack write, sync auth
cli/sync.mjs             laptop runtime copied into kits
prisma/                  schema + seed
docker/                  entrypoint (db push, seed, next start)
```
