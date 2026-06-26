---
name: 4626-agent-runtime-guardrails
description: Agent runtime routing and guardrail skill for 4626. Use to map work into the correct scope, enforce trust-boundary safeguards, and produce deterministic multi-scope verification plans even when direct repository access is partial.
---

# 4626 Agent Runtime Guardrails

## When to Use This Skill

Use this skill to map a task to the correct runtime scope and ensure required guardrails and checks are applied before completion.

Trigger when the user asks to coordinate multi-domain work, validate trust-boundary-sensitive changes, or produce deterministic completion evidence.

## System Model

This skill is the control plane for deciding:

- which domain skills apply
- which invariants must be checked
- which commands are required vs optional
- what evidence is needed before marking complete

Scope map:

- `frontend-change`: UI/state behavior changes
- `security-sensitive-api`: auth, mutation, ownership, trust boundary checks
- `telegram-linking`: Telegram proof, OTP, link token and canonical linking semantics
- `solana-provisioner`: Solana setup and registration flows
- `contracts-change`: Solidity/Foundry contract and deploy surfaces
- `docs-and-rules`: policy/rule/docs authority surfaces

## Required Inputs

1. Touched paths or subsystem map.
2. Intended behavior change.
3. Trust-boundary impact.
4. Verification scope and runtime budget.
5. Whether command execution is possible in current environment.

## Instructions

1. Select scope:
   - `docs-and-rules`
   - `frontend-change`
   - `security-sensitive-api`
   - `telegram-linking`
   - `solana-provisioner`
   - `contracts-change`
2. Apply global guardrails:
   - `AGENTS.md` is primary authority
   - path-scoped rules override only inside scope
   - trust-boundary changes require explicit verification
3. Map invariant checklist from selected scopes:
   - identity/canonical account invariants
   - token-kind invariants
   - trust-boundary invariants
   - deploy/read-only invariants
4. Build verification plan from selected scopes:
   - docs/rules: `pnpm docs:check` and runtime skill tests
   - frontend: lint/typecheck/test
   - security-sensitive API: lint/typecheck/security sweep
   - Telegram linking: lint/typecheck/test
   - Solana provisioner: frontend checks + `forge test`
   - contracts: `forge build` + `forge test`
5. If multiple scopes are touched, run the union of verification commands.
6. Report completion in a structured checklist:
   - selected scopes
   - invariants evaluated
   - commands run
   - residual risks or deferred checks
7. Apply verification policy:
   - at least one verification command per selected scope
   - for trust-boundary changes, run `pnpm security:local` unless user limits runtime
   - if commands cannot run, mark "not run" and explain why

## Examples

### Example: Cross-Surface Auth + API Change

- Input:
  - touched areas: frontend auth state + API mutation endpoint
- Expected output:
  - scopes selected: `frontend-change`, `security-sensitive-api`
  - union verification commands listed and executed
  - trust-boundary checklist with residual risks

### Example: Contracts + Deploy UI Change

- Input:
  - touched areas: Foundry script + deploy page behavior
- Expected output:
  - scopes selected: `contracts-change`, `frontend-change`
  - forge + frontend command matrix
  - explicit note if any verification is deferred

### Example: No-Repo Fallback

- Input:
  - no changed-file list, only behavior request
- Expected output:
  - scope selection from risk profile
  - explicit assumptions
  - verification matrix with required/optional checks

## Common Errors

- Wrong: Run only quick local checks for trust-boundary changes.
  Correct: Include security-focused verification and explain scope.
- Wrong: Verify only one scope in a multi-scope change.
  Correct: Use union verification for all selected scopes.
- Wrong: Mark complete without residual risk statement.
  Correct: Report deferred checks and remaining risks explicitly.
- Wrong: Select broad scopes without rationale.
  Correct: Explain why narrower scope was insufficient.

## Sources

- `AGENTS.md`
- `script/agent-runtime/skills/docs-and-rules/SKILL.md`
- `script/agent-runtime/skills/frontend-change/SKILL.md`
- `script/agent-runtime/skills/security-sensitive-api/SKILL.md`
- `script/agent-runtime/skills/telegram-linking/SKILL.md`
- `script/agent-runtime/skills/solana-provisioner/SKILL.md`
- `script/agent-runtime/skills/contracts-change/SKILL.md`
