# Product UI design system

**Mental model:** Product UI = `@/components/ui/*` (shadcn/Radix primitives + 4626 Tailwind tokens).

## Tokens

- Brand and surfaces: CSS variables in `src/index.css` (`--brand-primary`, `--vault-*`).
- shadcn semantic colors: bridged in `html.dark` and `@theme inline` (same vars, no duplicate hex).

## Components

| Layer | Use |
| ----- | --- |
| `Button`, `Badge`, `Modal`, `Input`, `Alert`, `SegmentedTabs` | Default for new product UI |
| `btn-accent` / `btn-primary` / `btn-secondary` (CSS) | Implementation detail for `Button` variants; do not use raw classes on new surfaces |
| `MetricChartPlot` + Recharts | Explore content-detail charts (`ExploreContentDetail`) |
| `AccountTray` | Account chrome tray (`ConnectButton`) |
| `sonner` | Toasts via `AppToaster` + `toast.*` helpers |

## Boundaries

- `src/components/ui` must not import from `src/features/*` (`pnpm guard:frontend-boundaries`).
- No runtime `@coinbase/cds-*` in app code; charts use Recharts only.
