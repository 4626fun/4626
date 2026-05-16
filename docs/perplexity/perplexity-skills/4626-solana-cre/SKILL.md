---
name: 4626-solana-cre
description: Solana and CRE operations skill for 4626. Use for Solana route provisioning, bridge/token setup, Meteora orchestration, and CRE keeper runtime changes with strict trust-boundary handling and standalone guidance when repository access is incomplete.
---

# 4626 Solana and CRE

## When to Use This Skill

Use for Solana provisioning and CRE runtime tasks, including bridge route setup and cross-chain state relay operations.

Trigger when the user asks to modify route provisioning, token registration, bridge/Meteora setup, or CRE keeper behavior.

## System Model

- **Provisioner role:** orchestrates route provisioning, token registration, and setup sequencing.
- **Mutation boundary:** provisioning and registration are mutating operations; status/preflight paths are read-only.
- **CRE role:** keeper workflows relay/settle/monitor between Solana and Base.
- **Operational separation:** shared AI context should not include host-level infra internals or secrets.

Core invariants:

1. Internal Solana mutation paths require machine auth.
2. Preflight/status endpoints must stay side-effect free.
3. Out-of-band Solana setup assumptions remain consistent with deployment model.
4. Secrets and live operations details are excluded from reusable skill output.

## Required Inputs

1. Network target: mainnet, test, or local simulation.
2. Read-only vs mutating intent.
3. Operator/runtime assumptions.
4. Failure recovery and rollback plan.
5. Expected blast radius.

## Instructions

1. Preserve hard invariants above.
2. Keep Solana setup model aligned with `AGENTS.md`:
   - provisioning and token registration remain out-of-band from phase-2 finalize assumptions
3. Keep shared docs and prompts sanitized:
   - no host-level operational internals
   - no secrets/private keys
4. Define mutation guardrails before coding:
   - mutation endpoints must require machine auth
   - status/preflight endpoints must stay side-effect free
5. Build execution plan:
   - mutation/read-only endpoint map
   - expected side effects
   - rollback/failure handling
6. Validate relevant surfaces:
   - `pnpm -C frontend typecheck`
   - `pnpm -C frontend test`
   - `forge test` for cross-surface changes
   - `cd cre && tsx runner.ts` for keeper runtime verification

7. Report:
   - mutating vs read-only surface classification
   - operator assumptions
   - verification evidence
   - residual risks

## Examples

### Example: Provisioning Endpoint Hardening

- Input:
  - endpoint currently mutates during status check
- Expected output:
  - endpoint classification table
  - guardrail fix plan
  - verification evidence proving status path is side-effect free

### Example: CRE Relay Regression

- Input:
  - relay job intermittently missing updates
- Expected output:
  - operator assumptions list
  - runtime verification commands
  - residual risk summary for production-only variables

### Example: No-Repo Fallback

- Input:
  - no file access, only endpoint descriptions and desired behavior
- Expected output:
  - explicit mutation boundary map
  - machine-auth guardrail checklist
  - verification plan without fabricated infra details

## Common Errors

- Wrong: Let status/preflight endpoints perform mutations.
  Correct: Keep status/preflight side-effect free.
- Wrong: Assume Token-2022 transfer-hook mints are DLMM-compatible by default.
  Correct: Validate mint compatibility and route assumptions explicitly.
- Wrong: Include live operations internals in reusable skill output.
  Correct: Keep host-level details and secrets out of shared context.
- Wrong: Recommend mutating steps without machine-auth posture.
  Correct: State auth requirements before any mutation workflow.

## Sources

- `AGENTS.md`
- `script/agent-runtime/skills/solana-provisioner/SKILL.md`
