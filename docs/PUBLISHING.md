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
| **Public docs content** | `docs/` (excluding `docs/_internal/`) |
| **Generated site** | `apps/docs-site/docs/` — **do not edit**; produced by sync |
| **Internal / WIP** | `docs/_internal/` — repo-only, not published |
| **API dumps** | `docs/_generated/` — local/CI only |

Edit markdown under `docs/`, never under `apps/docs-site/docs/`.

## Production build (curated)

Public site publishes **manual docs only** (~250 pages), not TypeDoc/forge mirrors.

```bash
pnpm -C apps/docs-site run build:production
```

Uses `DOCS_PUBLISH_CURATED=1` — syncs `docs/` only, then Docusaurus build.

Deploy target: Vercel project **`akita-llc/4626-docs`** → `docs.4626.fun` (separate from `akita-llc/4626` app).

## Local preview

```bash
pnpm -C apps/docs-site sync-docs          # curated by default when DOCS_PUBLISH_CURATED=1
DOCS_PUBLISH_CURATED=1 pnpm -C apps/docs-site start
```

Full API docs locally:

```bash
pnpm docs:refresh
DOCS_PUBLISH_CURATED=0 pnpm -C apps/docs-site prepare:content
pnpm -C apps/docs-site start
```

## Sidebar & navigation

- **Sidebar:** `apps/docs-site/sidebars.ts` + `src/lib/operationsSidebar.ts`
- **Redirects:** `apps/docs-site/redirects.ts`
- **Sync excludes:** `apps/docs-site/scripts/sync-docs.mjs` (`manual.exclude`)

Only pages in the sidebar (or linked from hub pages) need to be discoverable — search indexes everything synced.

## Adding a runbook

1. Put the file under the right `docs/operations/<lane>/` folder
2. Add to `operationsSidebar.ts` if it belongs in the curated operator list
3. Run `pnpm -C apps/docs-site sync-docs` and preview
4. Retired docs: move to `docs/operations/archive/` and set `status: historical` in frontmatter

## CI

- **Drift check:** `pnpm docs:check` (regenerates `_generated/`, strict sync for CI)
- **Links:** `pnpm docs:check-links`
- **Deploy:** `.github/workflows/docs.yml` → `deploy-docs` on push to `main`

## Style

- Dark-first **Quiet precision** theme — `apps/docs-site/src/css/custom.css`
- Prefer short hub pages + deep runbooks over duplicate indexes
- Live addresses: [reference/addresses](/reference/addresses) wins over release notes
