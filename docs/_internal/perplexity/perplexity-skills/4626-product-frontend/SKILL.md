---
name: 4626-product-frontend
description: Product and frontend execution skill for 4626. Use for UI and state-machine changes across waitlist, auth, Telegram linking, and frontend API wiring with explicit invariants, routing constraints, regression coverage, and no-repo fallback guidance.
---

# 4626 Product and Frontend

## When to Use This Skill

Use for frontend architecture decisions, auth/waitlist UX changes, Telegram link onboarding, and API route wiring.
Trigger when the user asks to change onboarding flows, auth/session behavior, Telegram linking, or frontend API behavior.

## System Model

- **Channels:** web app, Base app entry, Telegram Mini App.
- **Identity core:** verified email is canonical identity and recovery key.
- **Linking:** Telegram/Base/Zora link into the same canonical account model.
- **Wallet readiness:** linked/onboarded is not equivalent to execution-ready.

## Required Inputs

1. Affected route(s) and user journey.
2. Expected state transitions before and after the change.
3. Target channel: web, Base app, Telegram, or multiple.
4. Failure and rollback behavior expectations.
5. Whether trust-boundary logic is touched.

## Instructions

1. Enforce invariants:
   - canonical account model remains unified
   - Telegram semantic order remains fixed (proof -> OTP -> sync -> bind -> persist)
   - no multi-source verification truth
   - no ad hoc session polling
   - static API route registration remains intact
2. Map current flow and target flow before editing:
   - entry route
   - state transitions
   - terminal success/failure states
3. Apply minimal diff strategy:
   - migrate callers instead of preserving legacy aliases
   - avoid introducing new global providers unless route-scoped mount is impossible
4. Telegram-specific changes must keep reducer/state-machine authority and WebView-safe auth.
5. API changes must remain compatible with static route-map registration.
6. Validate before completion:
   - `pnpm -C frontend lint`
   - `pnpm -C frontend typecheck`
   - `pnpm -C frontend test`
7. Add regression coverage for sensitive auth/linking behavior when practical.
8. Report:
   - flows touched (before/after)
   - invariants checked
   - validation evidence
   - residual risk

## Examples

### Example: Telegram OTP Step Refactor

- Input:
  - channel: Telegram Mini App
  - affected flow: OTP -> account sync -> link completion
- Expected output:
  - updated state transitions
  - invariant checklist
  - test coverage for regression from verified state to email collection

### Example: Auth Polling Cleanup

- Input:
  - route: account setup
  - issue: duplicate session polling logic
- Expected output:
  - removal or consolidation plan
  - proof that `useSiweAuth` behavior is not duplicated
  - lint/typecheck/test evidence

### Example: No-Repo Fallback

- Input:
  - only plain-language flow description, no file paths
- Expected output:
  - explicit state machine draft
  - invariant-safe plan
  - no unsafe mutation assumptions

## Common Errors

- Wrong: Split Telegram verification truth across multiple flags/hooks.
  Correct: Keep one reducer/state-machine authority.
- Wrong: Treat link completion as wallet execution readiness.
  Correct: Preserve execution-ready gating semantics.
- Wrong: Add dynamic route wiring in API handlers.
  Correct: Keep route registration deterministic and static.
- Wrong: Patch platform bugs with broad UA-only logic.
  Correct: Gate by explicit route/state conditions.
- Wrong: Propose behavior changes without transition mapping.
  Correct: Include before/after flow states and failure transitions.

## Sources

- `AGENTS.md`
- `script/agent-runtime/skills/frontend-change/SKILL.md`
- `script/agent-runtime/skills/telegram-linking/SKILL.md`
- `script/agent-runtime/skills/security-sensitive-api/SKILL.md`
