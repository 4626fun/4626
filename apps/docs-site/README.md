# 4626 Docs Site

Docusaurus-based documentation site for 4626.

## Documentation Model

This site publishes curated documentation from multiple sources across the monorepo.

### Five Sources

| Source | Location | Destination | Purpose |
|--------|----------|-------------|---------|
| **Manual docs** | `docs/` | `/` (root) | Human-written documentation (source of truth) |
| **Contract API** | `docs/_generated/contracts/` | `/api/contracts/` | Solidity NatSpec (forge doc) |
| **Frontend API** | `docs/_generated/frontend/` | `/api/frontend/` | TypeScript TSDoc (typedoc) |
| **Automation workflows** | `cre/` | `/operations/cre/` | Automation docs (README + guides) |
| **Frontend docs** | `frontend/` | `/frontend/` | Frontend guides, architecture notes, overview |

### Key Rules

- **Code ≠ Docs** — Documentation describes code, it does not mirror it 1:1.
- `docs/` is the primary manual source. `cre/` and `frontend/` contribute workspace-level docs (READMEs, design docs).
- `docs/_internal/` and `docs/plans/` are intentionally excluded from public docs publishing.
- Documentation describing contracts lives in `docs/contracts/`.
- Documentation describing frontend lives in `docs/frontend/` (manual) + `frontend/docs/` (workspace).
- Missing documentation for some code areas is allowed and intentional.
- Frontend API docs intentionally focus on stable library/config/wallet/auth/API layers, not every React page or component prop type.

### What the Sync Script Does

| Action | Description |
|--------|-------------|
| Reads from | `docs/` (manual) + `docs/_generated/` (API) + `cre/` + `frontend/` |
| Publishes | Markdown files to `docs-site/docs/` |
| Normalizes | Adds frontmatter (title, sidebar_position) |
| Enforces metadata | Manual docs get audience/stage/owner/last_reviewed/status |
| Renames | `README.md` → `index.md` (cre) or `overview.md` (frontend) |
| Fixes links | Transforms broken links in generated API docs |
| Validates | Internal links (in strict mode) |
| Brand assets | Syncs `frontend/public/brand/` → `static/brand/` |

### API Docs Pipeline

Auto-generated API documentation flows through this pipeline:

```
1. forge doc          → docs/_generated/contracts/  (Solidity NatSpec)
2. typedoc            → docs/_generated/frontend/   (TypeScript TSDoc)
3. sync-docs.mjs      → docs-site/docs/api/         (copy + fix links)
4. postprocess-api-docs.ts                          (index pages + validation)
5. docusaurus build
```

The postprocess script:
- Creates `index.md` for directories without one
- Validates all internal links
- Fails in `--strict` mode if links are unresolved

Scripts:
- `pnpm api:postprocess` - Run postprocessing
- `pnpm api:postprocess:strict` - Fail on unresolved links
- `pnpm check:hygiene-policy` - Enforce required manual-doc frontmatter + freshness + canonical topic uniqueness
- `pnpm build:strict` - Full strict docs-site build pipeline
- `pnpm bundle:strict` - Full strict docs-site bundle without minification (heavier, optional for local validation)

Repo-level shortcuts:
- `pnpm docs:refresh` - Regenerate frontend + contract docs, then sync and postprocess the docs site
- `pnpm docs:check` - Regenerate docs, run strict sync/postprocess validation, and fail if generated output was not committed
- `pnpm docs:build:strict` - Alias for `pnpm docs:check`
- `pnpm docs:bundle` - Run the heavyweight strict docs-site bundle from the repo root
- `pnpm docs:drift` - Detect whether the current change set should trigger docs refresh/build checks

## Development

### Prerequisites

- Node.js 18+
- pnpm

### Setup

```bash
cd apps/docs-site
pnpm install
```

### Local Development

```bash
pnpm start
```

This runs `sync-docs` automatically, then starts the Docusaurus dev server.

### Sync Docs Manually

```bash
# Normal mode (warnings only)
pnpm sync-docs

# Strict mode (exits non-zero on broken links or missing frontmatter)
pnpm sync-docs:strict
```

### Repo-Root Workflow

From the repo root, the normal contributor workflow is:

```bash
pnpm docs:refresh
pnpm docs:check
```

For an additional full site bundle check, run:

```bash
pnpm docs:bundle
```

Note: the full Docusaurus production bundle is significantly more memory-hungry than sync/postprocess validation. On constrained local machines it may be killed by the OS even when the docs pipeline itself is correct.

To quickly see whether a change set is docs-sensitive:

```bash
pnpm docs:drift
```

### Build for Production

```bash
pnpm build
```

### Serve Production Build

```bash
pnpm serve
```

## Brand Assets

### 4626 brand

Brand assets are managed in `frontend/public/brand/` and automatically synced to `static/brand/` during build.

| Asset | Source | Used for |
|-------|--------|----------|
| `logo.svg` | `frontend/public/brand/logo.svg` | Navbar logo |
| `favicon.svg` | `frontend/public/brand/favicon.svg` | Browser tab icon |

To update brand assets:
1. Edit files in `frontend/public/brand/`
2. Run `pnpm sync-docs` to copy to docs site
3. Commit changes to `frontend/public/brand/`

## Project Structure

```
apps/docs-site/
├── docusaurus.config.ts        # Docusaurus configuration
├── sidebars.ts                 # Sidebar configuration
├── docs/                       # GENERATED - do not edit
├── scripts/
│   ├── sync-docs.mjs           # Sync curated + API docs
│   └── postprocess-api-docs.ts # Create indexes, validate links
├── src/
│   └── css/
│       └── custom.css          # Custom styles
├── static/
│   └── brand/                  # SYNCED - do not edit directly
└── package.json
```

## Adding New Documentation

1. Add/edit files in `4626/docs/` (the source of truth)
2. Run `pnpm sync-docs` to preview changes locally
3. Commit changes to `4626/docs/` (not `apps/docs-site/docs/`)

## Features

- **Mermaid diagrams** - Live-rendered in markdown with ` ```mermaid ` code blocks
- **Syntax highlighting** - Solidity, TypeScript, JSON, and more
- **Dark mode** - Automatic theme switching
- **Search** - Built-in search functionality
