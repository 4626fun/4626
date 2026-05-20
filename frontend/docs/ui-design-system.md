# Product UI design system (Phase 1)

**Mental model:** Product UI = `@/components/ui/*` (shadcn/Radix primitives + 4626 Tailwind tokens).

## Tokens

- Brand and surfaces: CSS variables in `src/index.css` (`--brand-primary`, `--vault-*`).
- shadcn semantic colors: bridged in `html.dark` and `@theme inline` (same vars, no duplicate hex).

## Components

| Layer | Use |
| ----- | --- |
| `Button`, `Badge`, `Modal`, `Input`, `Alert`, `SegmentedTabs` | Default for new product UI |
| `btn-accent` (legacy) | Avoid on new/edited marketing surfaces; prefer `<Button variant="primary">` |
| `@coinbase/cds-web` | **Charts only** (`ExploreContentDetail` via `cds-web-visualization`); needs slim `CdsThemeProvider` in `main.tsx` |
| `AccountTray` | Replaces CDS `Tray` in account chrome (`ConnectButton`) |
| `sonner` | Toasts via `AppToaster` + `toast.*` helpers |

## Boundaries

- `src/components/ui` must not import from `src/features/*` (`pnpm guard:frontend-boundaries`).
