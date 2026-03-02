# 4626 Brand Kit Integration Design

Date: 2026-03-01
Status: Approved
Owner: Frontend Platform

## Context

The current app should reuse and standardize the visual language from the existing Creator Vaults Brand Kit repository, while keeping the canonical source inside this monorepo.

Current state:

- `frontend/` already uses substantial brand token/classes (`brand.*`, `vault.*`, shared utility classes).
- Brand-kit source is currently a standalone showcase app, not a reusable package.
- UI primitives in `frontend/src/components/ui/*` are partially aligned but not centralized as a design-system package.

## Goals

- Create an internal, reusable brand-kit package in this monorepo.
- Preserve existing routes, URLs, and behavior.
- Keep current app stable while migrating incrementally.
- Make tokens/components consistent across pages (`Swap`, `Vault`, `Portfolio`, `DeployVault`).

## Non-Goals

- No route or URL changes.
- No full visual rewrite in one pass.
- No external package publish in this phase.

## Chosen Approach

Use a workspace package plus gradual migration:

1. Create `packages/brand-kit` as the canonical source for tokens, base CSS, and primitives.
2. Keep `frontend` imports stable through thin wrapper/re-export adapters.
3. Migrate primitives first, then branded composites in small batches.

This combines clean architecture with low rollout risk.

## Package Architecture

Proposed structure:

```text
packages/brand-kit/
  src/
    tokens/
      colors.ts
      typography.ts
      radius.ts
    styles/
      brand.css
    components/
      Button.tsx
      Card.tsx
      Input.tsx
      Badge.tsx
      Modal.tsx
    index.ts
```

Frontend integration:

- `frontend/src/components/ui/*` stays as compatibility wrappers/re-exports initially.
- App entry imports shared brand CSS from `packages/brand-kit`.
- Existing class contracts remain valid during migration.

## Token Contract

Standardize and preserve existing semantic tokens:

- `--brand-primary` = `#0052FF`
- `brand.hover` = `#004AD9`
- `brand.accent` = `#3B82F6`
- `--vault-bg` = `#020202`
- `--vault-card` = `#0A0A0A`
- `--vault-border` = `#1F1F1F`
- `--vault-text` = `#EDEDED`
- `--vault-subtext` = `#666666`

Compatibility rules:

- Keep existing utility usage working (`bg-brand-primary`, `text-brand-accent`, `bg-vault-card/70`, etc.).
- Add a tailwind preset from `packages/brand-kit` and extend from it in `frontend/tailwind.config.js`.

## Migration Plan

### Phase 1 (Low-risk base)

- Build package scaffold.
- Move token definitions + shared CSS contract.
- Export `Button` and `Card`.
- Wire frontend to consume package styles.

### Phase 2 (Core primitives)

- Migrate `Input`, `Badge`, `Modal`.
- Keep wrapper exports in `frontend/src/components/ui/*` to avoid broad import churn.

### Phase 3 (Branded composites)

- Migrate higher-level branded components (`VaultNavBar`, `TokenOrb`, etc.) after primitives stabilize.

## Verification

For each migration batch:

- `pnpm -C frontend typecheck`
- `pnpm -C frontend lint`
- Targeted regression checks on:
  - `/swap`
  - `/vault/:address`
  - `/portfolio`
  - `/deploy`

Visual checks should confirm no unintended route-level regressions.

## Risks and Mitigations

- Drift between old and new styles:
  - Mitigation: semantic token compatibility + wrapper re-exports.
- Breaking imports during migration:
  - Mitigation: adapters in `frontend/src/components/ui/*`.
- Large one-shot refactor instability:
  - Mitigation: phased rollout with small verifiable batches.

## Follow-up

- Optional repository rename can happen later without blocking this integration.
- If desired later, extract `packages/brand-kit` into a standalone package/repo once internal API stabilizes.
