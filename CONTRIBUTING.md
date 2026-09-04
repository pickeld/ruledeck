# Contributing

## Setup

```bash
./scripts/bootstrap-env.sh
docker compose up --build
```

Or Node + Postgres as in the README. Sign in with `.local-credentials`.

## Checks

```bash
npx prisma generate
npm run typecheck
npm run lint
```

Do not commit `.env`, `.local-credentials`, `.ruledeck/`, or `/output`.

## Scope

Keep PRs small. This repo is the console and the laptop runtime (`cli/sync.mjs`). Generated packs belong in consumer repos, not here.

Do not install RuleDeck git hooks in this application repository.
