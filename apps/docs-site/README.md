# CreatorVault Docs Site

Docusaurus-based documentation site for CreatorVault.

## Documentation Model

This site publishes curated documentation from `4626/docs/`.

### Three Layers

| Layer | Location | Purpose |
|-------|----------|---------|
| **Code** (authoritative, internal) | `4626/contracts/`, `4626/frontend/` | Source of truth for implementation |
| **Canonical docs** (public-facing, curated) | `4626/docs/` | Human-written documentation |
| **Published docs** (generated) | `apps/docs-site/docs/` | Build output — do not edit |

### Key Rules

- **Code ≠ Docs** — Documentation describes code, it does not mirror it 1:1.
- `contracts/` and `frontend/` are conceptual inputs, but only `docs/` is a filesystem input.
- Documentation describing contracts lives in `4626/docs/contracts/`.
- Documentation describing frontend lives in `4626/docs/frontend/`.
- Missing documentation for some code areas is allowed and intentional.

### What the Sync Script Does

| Action | Description |
|--------|-------------|
| ✅ Reads from | `4626/docs/` (manual) + `4626/docs/_generated/` (API) |
| ✅ Publishes | Markdown files to `docs-site/docs/` |
| ✅ Normalizes | Adds frontmatter (title, sidebar_position) |
| ✅ Fixes links | Transforms broken links in generated API docs |
| ✅ Validates | Internal links (in strict mode) |
| ✅ Brand assets | Syncs `frontend/public/brand/` → `static/brand/` |

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
- `pnpm build:strict` - Full strict build pipeline

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

### Build for Production

```bash
pnpm build
```

### Serve Production Build

```bash
pnpm serve
```

## Brand Assets

Brand assets are managed in `frontend/public/brand/` and automatically synced to `static/brand/` during build.

| Asset | Source | Used for |
|-------|--------|----------|
| `logo.svg` | `frontend/public/brand/logo.svg` | Navbar logo |
| `favicon.svg` | `frontend/public/brand/favicon.svg` | Browser tab icon |
| `social-card.svg` | `frontend/public/brand/social-card.svg` | Open Graph / Twitter cards |

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
