# Changelog

## 0.1.0 — 2026-09-05

First public release.

### Policy console

- Author rules, prompts, procedures, and tools per project
- Version every edit, publish a labeled live release, browse history and diffs
- Org-wide **global** pack plus per-project extras; same `type:slug` in the project overrides global
- Invite links, join flow, and an audit log

### Developer sync

- Consent to writes, bind a Cursor folder / git remote to a project
- Zero-dependency `cli/sync.mjs` runtime copied into each kit
- Git hooks: pull/checkout/rebase rewrite the live pack; push rewrites and blocks if those files are still dirty
- Non-matching folders skip instead of writing

### Platforms

- Generates Cursor, Claude Code, and GitHub Copilot files
- Codex CLI, Windsurf, Cline, Continue, and OpenCode can be declared; adapters are not generated yet

### Operations

- Docker Compose (Next.js 16 + Postgres 16)
- Argon2id passwords, hashed sessions, hashed sync tokens
- Seeded local manager/developer accounts via gitignored `.local-credentials`
