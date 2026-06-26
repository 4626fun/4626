---
name: 4626-master-context
description: Canonical 4626 operating context for Perplexity. Use as first-pass routing for cross-domain tasks that need architecture grounding, invariant checks, trust-boundary handling, and deterministic verification planning even when repository files are unavailable.
---

# 4626 Master Context

## When to Use This Skill

Use this skill as the first pass whenever the task is ambiguous or spans multiple areas. Trigger especially when the user asks how the system works, what constraints apply, or requests changes that may impact auth, wallet state, trust boundaries, contracts, or Solana operations.

## System Model

4626 is a multi-surface system:

- Frontend/App: onboarding, auth, account setup, Telegram flows, creator UX.
- API/Server: request routing, auth checks, trust-boundary enforcement.
- Contracts: vault stack, OFT cross-chain wiring, VRF randomness, strategies.
- Solana/KPR: out-of-band provisioning plus keeper relay workflows.

Global invariants to preserve:

1. Verified email is canonical identity.
2. Web/Base/Telegram resolve into one account model.
3. Linked/onboarded is not execution-ready.
4. Creator Coin and Share token are distinct.
5. Telegram flow order remains fixed: proof -> OTP -> sync -> bind -> persist.
6. Preflight/status endpoints are read-only.
7. Internal Solana mutations require machine auth.

## Required Inputs

1. Primary goal and success criteria.
2. Suspected subsystem(s): frontend, contracts, Solana/KPR, integrations.
3. Read-only analysis vs implementation intent.
4. Environment target: local, preview, or production.
5. Verification budget: fast, smoke, or full.

## Instructions

1. Map request to subsystem(s) and list impacted invariants.
2. Route to one or more domain skills:
   - `4626-product-frontend`
   - `4626-onchain-vaults`
  - `4626-solana-cre` (Solana/KPR lane)
   - `4626-integrations`
   - `4626-uniswap-ai`
   - `4626-agent-runtime-guardrails` for uncertain/high-risk routing.
3. Build verification plan (required vs optional commands).
4. Use read-only-first approach before proposing mutating actions.
5. Return a structured summary containing:
   - selected scopes
   - invariants checked
   - trust boundaries touched
   - commands run/skipped with reason
   - residual risks

Verification command menu:

- Frontend: `pnpm -C frontend lint`, `pnpm -C frontend typecheck`, `pnpm -C frontend test`
- Contracts: `forge build`, `forge test`
- Security sweep: `pnpm security:local`
- Docs/runtime: `pnpm docs:check`, `node --test script/agent-runtime/__tests__/skills.test.js`

No-repo fallback rule:

- Ask only for missing required inputs.
- State assumptions explicitly.
- Avoid mutation guidance without authority context.
- Return a safe read-only-first plan.

## Examples

### Example: Ambiguous Cross-Domain Request

- Input: "Fix account setup and deployment reliability."
- Output shape:
  - selected scopes: product-frontend + onchain-vaults + runtime-guardrails
  - invariant checklist
  - verification matrix with required commands
  - residual risk list

### Example: Architecture Question Only

- Input: "What rules must we preserve for Telegram linking?"
- Output shape:
  - subsystem map
  - fixed Telegram order
  - trust-boundary rules
  - no code-change recommendation unless requested

## Common Errors

- Wrong: Pick a domain skill before listing invariants.
  Correct: Identify impacted invariants first, then choose scope.
- Wrong: Treat linked/onboarded users as execution-ready.
  Correct: Keep execution-ready as a distinct gated state.
- Wrong: Recommend mutating actions immediately.
  Correct: Start with read-only preflight and authority checks.
- Wrong: Skip trust-boundary analysis for API/Solana requests.
  Correct: Explicitly classify mutation vs read-only paths and auth model.

## Sources

- `AGENTS.md`
- `.cursor/skills/*/SKILL.md`
- `script/agent-runtime/skills/*/SKILL.md`
