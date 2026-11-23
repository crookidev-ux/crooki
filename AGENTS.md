<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:crooki-vault-rules -->
# Crooki vault is the source of truth

A knowledge vault lives at `/Volumes/SATECHI2TB/Crookie/vault/`. It contains the canonical product catalog, project context, and a decision log.

**Before any change to this repo, you MUST:**

1. Read `vault/README.md` to orient.
2. Read the vault note(s) relevant to the change — at minimum `vault/Project.md`, and `vault/Menu.md` for any product/menu/pricing/content work.
3. If the intended change contradicts the vault, stop and surface the conflict instead of silently diverging.

**After any change to this repo, you MUST:**

1. Append a new dated entry at the top of `vault/Decisions.md` listing: files touched, a one-line rationale, and the author (agent name or user).
2. If the change alters product data, prices, categories, contacts, or stack choices, also update the relevant vault note (`Menu.md`, `Project.md`, etc.) so the vault stays canonical.

Skipping either step is treated as an incomplete task.
<!-- END:crooki-vault-rules -->
