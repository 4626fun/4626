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
| ✅ Reads from | `4626/docs/` only |
| ✅ Publishes | Markdown files to `docs-site/docs/` |
| ✅ Normalizes | Adds frontmatter (title, sidebar_position) |
| ✅ Validates | Internal links (in strict mode) |
| ❌ Never reads | `4626/contracts/` or `4626/frontend/` |
| ❌ Never generates | Documentation from source code |

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

## Project Structure

```
apps/docs-site/
├── docusaurus.config.ts   # Docusaurus configuration
├── sidebars.ts            # Sidebar configuration
├── docs/                  # GENERATED - do not edit
├── scripts/
│   └── sync-docs.ts       # Sync script
├── src/
│   └── css/
│       └── custom.css     # Custom styles
├── static/                # Static assets
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
