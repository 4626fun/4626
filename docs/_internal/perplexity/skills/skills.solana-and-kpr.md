# 4626 Skills: Solana And KPR

## When To Use

Use this for Solana route provisioning, bridge token setup, Meteora setup flow, and KPR keeper operations that mirror Solana/Base state.

## Intake Checklist (Required)

1. network target (mainnet/test/local simulation)
2. read-only vs mutating intent
3. operator runtime assumptions
4. expected failure recovery path

## Canonical Invariants

- Preflight/status paths remain read-only and side-effect free.
- Internal Solana mutation paths require machine auth; no ambient user session fallback.
- Solana setup remains out-of-band from phase-2 finalize assumptions in deploy flow.

## Provisioner Model

- Main surface: `frontend/server/solana-provisioner/`.
- Typical sequence:
  1. provision route and wrapped token
  2. optional Token-2022 creator setup with transfer-hook extensions
  3. register vault config used for Meteora Alpha Vault paths
- Keep endpoint/infra host specifics out of shared context docs.

## KPR Model

- KPR bots under `kpr/` relay entries, settle fees, relay winners, and monitor price divergence.
- Runtime command: `cd kpr && tsx runner.ts` (dry run: `DRY_RUN=true tsx runner.ts`).
- Treat existing KPR TypeScript errors as known caveat unless explicitly being fixed.

## Commands

- Frontend typecheck/tests when provisioner-facing code changes:
  - `pnpm -C frontend typecheck`
  - `pnpm -C frontend test`
- Contracts regression checks for cross-surface changes:
  - `forge test`
- KPR install and run:
  - `cd kpr && npm ci`
  - `cd kpr && tsx runner.ts`

## Execution Framework

### Phase 1: Mutation Boundary Mapping

- Label each touched endpoint/path as read-only or mutating.
- Confirm machine-auth requirement for mutating paths.

### Phase 2: Provisioning/Relay Plan

- Document exact sequence and expected side effects.
- Keep host-level operational details out of shared context.

### Phase 3: Verification

- Validate frontend + contract checks for cross-surface impacts.
- Run KPR runtime command in local simulation where possible.

### Phase 4: Report

- Return changed mutation surfaces, verification evidence, and residual risk.

## Common Pitfalls

- Mixing read-only status paths with mutating setup side effects.
- Assuming Token-2022 transfer-hook mints can be dropped directly into Meteora DLMM routes.
- Exposing operational host/runbook internals in docs or prompts.

## Safe Defaults

- Use capability-scoped machine credentials for mutating paths.
- Keep Solana instructions at invariant/workflow level for shared AI context packs.
- Escalate to internal runbooks for environment-specific operational procedures.

## Sources

- `AGENTS.md`
- `script/agent-runtime/skills/solana-provisioner/SKILL.md`
