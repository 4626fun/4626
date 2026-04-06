# Blue Void Editorial Dark Spec

Date: 2026-03-04
Status: Approved
Owner: Frontend Design + Platform

## Context

4626 already has a cinematic dark visual language in production, but the UI still reads as mixed-era components rather than one cohesive premium system.

This spec defines a single dark-first direction:

- Direction: Blue Void Editorial
- Reference baseline: Untitled UI dark mode variants
- Product identity: 4626-specific, not template-like

## Hard Requirements

1. Dark mode is required for all in-scope surfaces.
2. Light-mode visual decisions are out of scope in this phase.
3. Keep existing routes and product behavior unchanged.
4. Preserve existing canonical wallet and onboarding invariants.

## In-Scope Surfaces

- `frontend/src/pages/Swap.tsx` and swap subcomponents
- `frontend/src/features/waitlist/**`
- `frontend/src/pages/AccountSettings.tsx`
- Shared primitives/tokens under `frontend/packages/brand-kit/**`

## Visual Principles

1. Editorial restraint over decorative complexity.
2. High contrast hierarchy with low chroma backgrounds.
3. Blue is semantic and intentional (actions, active state, trust markers), not ambient noise.
4. Dense data remains legible through rhythm, spacing, and typography.
5. Motion is subtle, directional, and fast.

## Token Specification (Dark)

These are the canonical target values for this direction.

### Core surfaces

- `--vault-bg`: `2 2 2` (`#020202`)
- `--vault-card`: `10 10 10` (`#0A0A0A`)
- `--vault-card-raised`: `15 16 20` (`#0F1014`)
- `--vault-border`: `31 31 31` (`#1F1F1F`)
- `--vault-border-strong`: `52 55 66` (`#343742`)

### Text

- `--vault-text`: `237 237 237` (`#EDEDED`)
- `--vault-subtext`: `148 153 170` (`#9499AA`)
- `--vault-muted`: `109 114 129` (`#6D7281`)

### Brand blue system

- `--brand-primary`: `0 82 255` (`#0052FF`)
- `--brand-hover`: `26 102 255` (`#1A66FF`)
- `--brand-accent`: `59 130 246` (`#3B82F6`)
- `--brand-glow`: `rgba(0, 82, 255, 0.28)`

### State colors

- Success: `#10B981`
- Warning: `#F59E0B`
- Error: `#EF4444`

## Typography Specification

### Font families

- Display: `Space Grotesk`
- Body/UI: `Inter`
- Data/metrics: `JetBrains Mono`

### Scale and weights

- Hero display: `56/64`, weight `500`, tracking `-0.02em`
- Section title: `28/34`, weight `600`, tracking `-0.01em`
- Card title: `16/22`, weight `600`
- Body: `14/22`, weight `400`
- Label/caps: `10/14`, weight `500`, tracking `0.18em`, uppercase
- Metric value: `tabular-nums`, weight `500`

## Shape, Border, and Elevation

### Radius

- Primary card radius: `16px`
- Secondary control radius: `12px`
- Pills/chips: `999px`

### Borders

- Default border: `1px solid rgba(255, 255, 255, 0.08)`
- Focus border: `1px solid rgba(0, 82, 255, 0.45)`

### Shadows

- Card: `0 18px 45px -24px rgba(0,0,0,0.72)`
- CTA: `0 10px 34px -12px rgba(0,82,255,0.52)`
- Avoid multi-glow stacking beyond one active surface.

## Motion Specification

- Global duration range: `120ms` to `220ms`
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)`
- Hover: mostly opacity/color/shadow changes, no large movement
- Tap/press scale: max `0.98`
- Avoid looping ambient animations except tiny status indicators

## Component Language

### Cards

- Flat dark base with subtle border and modest blur where needed.
- No heavy frosted gradients.
- One visual emphasis per card (title, metric, or action), not all three.

### Inputs and selectors

- Strong text contrast.
- Muted field background (`bg-white/4` or equivalent tokenized color).
- Explicit active state with blue ring and border.

### Buttons

- Primary buttons use brand blue fill and restrained glow.
- Secondary buttons are neutral dark with border emphasis.
- Danger buttons stay neutral until intent-confirming context.

### Chips/badges

- Dense and compact.
- Monochrome by default; blue only for active/current.

## Page-Level Rules

### Swap

- Primary area: strict information hierarchy (pair -> amount -> route details -> CTA).
- Remove decorative duplication around execution status.
- Route/gas/slippage bars should use compact editorial chip rows.

### Waitlist

- Preserve trust-first tone.
- Keep one clear primary action per step.
- Wallet snapshot remains compact with mono address rows and minimal icon noise.

### Account

- Convert dense control sections into editorial panels with clear grouping:
  - Identity + wallet architecture
  - Coin/profile
  - Operations and advanced controls

## Accessibility and Performance Constraints

- Minimum text contrast: WCAG AA at all normal sizes.
- Motion must respect `prefers-reduced-motion`.
- No large persistent background effects that hurt LCP/CLS.
- No route-level client-side animation frameworks beyond current stack.

## Implementation Sequence

1. Update brand-kit tokens and CSS contract.
2. Apply Swap shell and component harmonization.
3. Apply waitlist card and CTA harmonization.
4. Apply account grouping and visual hierarchy pass.
5. Run lint/typecheck and manual UI regression checks.

## Verification Checklist

- `pnpm -C frontend typecheck`
- `pnpm -C frontend lint`
- Manual checks:
  - `/swap` dark hierarchy and CTA emphasis
  - waitlist completion flow readability and one-tap clarity
  - `/account` grouping clarity and action discoverability

## Non-Goals

- No URL changes
- No behavior changes to swap execution, waitlist auth semantics, or account permissions
- No light-mode redesign in this phase

