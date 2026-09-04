# Developer sync

Use this after a manager has published a live release and invited you.

## 1. Join and consent

Open the invite link, create an account (or sign in), pick platforms, and allow writes. Name the folder and/or git remote that is this project — for example `platform-api` or `acme/platform-api`.

RuleDeck shows the sync token once. It also writes a kit on the server host:

```
output/<project-slug>/members/<your-user-id>/.ruledeck/
```

## 2. Copy the kit into the real repo

The RuleDeck application folder is not your app. Open the service you actually edit.

```bash
# from the app repo root
cp -R /path/to/ruledeck/output/platform-api/members/<user-id>/.ruledeck .
```

`.ruledeck/credentials` must stay gitignored. The kit already appends that entry to `.gitignore`.

## 3. Install hooks and pull

```bash
node .ruledeck/sync.mjs install-hooks
node .ruledeck/sync.mjs pull
```

`install-hooks` fails if this folder/remote is not in `match`. That is intentional.

After a successful pull you should see Cursor rules, Claude instructions, and/or Copilot files depending on the platforms you selected.

## 4. Day to day

| Git event | Hook | What happens |
| --- | --- | --- |
| `git pull` / merge / rebase / checkout | `post-merge`, `post-checkout`, `post-rewrite` | Rewrite pack files to live |
| `git push` | `pre-push` | Rewrite pack files; if they changed, commit them and push again |

Manual:

```bash
node .ruledeck/sync.mjs pull
node .ruledeck/sync.mjs push
```

If you opened a different folder, you will see `RuleDeck skip` and nothing is written.

## 5. Change which folders count

In RuleDeck, open **Workspaces**, edit the match list, then copy the updated `.ruledeck/config.json` (or re-copy the kit). Match values are folder names or remotes, one per line.

## Troubleshooting

- **Pack fetch 401** — credentials missing or token rotated. Re-run onboarding apply.
- **Pack hash mismatch (409)** — laptop wrote a different set than the server expected. Pull again from a matching folder.
- **Push aborted** — RuleDeck updated managed files. `git status`, commit, push.
- **Hooks ran in the wrong repo** — `core.hooksPath` is set. `git config --unset core.hooksPath` in that repo.
