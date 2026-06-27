---
title: Publishing docs
sidebar_position: 99
slug: /publishing
---

# Publishing docs

How `docs.4626.fun` is built from this repo.

## Source of truth

| What | Where |
|------|--------|
| **Public docs content** | Allowlisted paths in `apps/docs-site/curatedPublishAllowlist.mjs` |
| **Generated site** | `apps/docs-site/docs/` — **do not edit**; produced by sync |
| **Internal / WIP** | `docs/_internal/` — repo-only, not published |
| **API dumps** | `docs/_generated/` — local/CI only |

Edit markdown under `docs/`, never under `apps/docs-site/docs/`.

## Production build (curated)

Public site publishes **~70 allowlisted pages**, not the full `docs/` tree or TypeDoc/forge mirrors.

```bash
pnpm -C apps/docs-site run build:production
```

Uses `DOCS_PUBLISH_CURATED=1` + the allowlist in `curatedPublishAllowlist.mjs`.

Deploy target: Vercel project **`akita-llc/4626-docs`** → `docs.4626.fun`.

## Local preview

```bash
DOCS_PUBLISH_CURATED=1 pnpm -C apps/docs-site sync-docs
DOCS_PUBLISH_CURATED=1 pnpm -C apps/docs-site start
```

Full API docs locally:

```bash
pnpm docs:refresh
DOCS_PUBLISH_CURATED=0 pnpm -C apps/docs-site prepare:content
pnpm -C apps/docs-site start
```

## Adding a public page

1. Add or edit the markdown under `docs/`
2. Add the path to **`curatedPublishAllowlist.mjs`**
3. Add to **`sidebars.ts`** or **`operationsSidebar.ts`**
4. Run `DOCS_PUBLISH_CURATED=1 pnpm -C apps/docs-site sync-docs` and preview

Operator-only or historical docs: put under `docs/_internal/` — no allowlist entry needed.

## CI

- **Drift check:** `pnpm docs:check` (full regen for CI; production deploy uses allowlist)
- **Links:** `node apps/docs-site/scripts/check-doc-links.mjs`
- **Deploy:** `.github/workflows/docs.yml` → `deploy-docs` on push to `main`
