# 4626 Skills: Agent Runtime Guardrails

## When To Use

Use this as routing context for agent tasks spanning docs/rules, frontend changes, trust-boundary API changes, Telegram linking, Solana provisioner changes, and contract changes.

## Intake Checklist (Required Before Routing)

Collect:

1. touched files/paths
2. requested behavior change
3. whether trust boundaries or mutation logic are involved
4. runtime target (local/preview/production)
5. acceptable verification runtime budget

## Skill Routing Map

- `docs-and-rules`: `AGENTS.md`, `.cursor/`, `docs/`, contributor docs.
- `frontend-change`: `frontend/src/`, `frontend/api/`, `frontend/server/`.
- `security-sensitive-api`: `frontend/api/`, `frontend/server/_lib/`.
- `telegram-linking`: Telegram Mini App onboarding/linking surfaces.
- `solana-provisioner`: Solana provisioner + keeper-adjacent state.
- `contracts-change`: `contracts/`, `script/`, `test/`.

## Core Guardrails

- `AGENTS.md` remains the repo authority.
- Path-scoped rules override generic guidance inside their scope.
- Keep deploy preflight/status read-only.
- Require machine auth for internal Solana mutation paths.
- Preserve Telegram semantic order and single-state-machine model.
- Keep changes minimal on high-risk contract surfaces.

## Verification Commands By Skill

- `docs-and-rules`:
  - `pnpm docs:check`
  - `node --test script/agent-runtime/__tests__/skills.test.js`
- `frontend-change`:
  - `pnpm -C frontend lint`
  - `pnpm -C frontend typecheck`
  - `pnpm -C frontend test`
- `security-sensitive-api`:
  - `pnpm -C frontend lint`
  - `pnpm -C frontend typecheck`
  - `pnpm security:local`
- `telegram-linking`:
  - `pnpm -C frontend lint`
  - `pnpm -C frontend typecheck`
  - `pnpm -C frontend test`
- `solana-provisioner`:
  - `pnpm -C frontend typecheck`
  - `pnpm -C frontend test`
  - `forge test`
- `contracts-change`:
  - `forge build`
  - `forge test`

## Execution Framework

### Phase 1: Scope Selection

- Choose the narrowest primary scope.
- Add secondary scopes only when paths or behavior require it.

### Phase 2: Guardrail Validation

- Map applicable invariants from `AGENTS.md`.
- Identify trust-boundary rules that must remain unchanged.

### Phase 3: Verification Planning

- Build command list as union of all selected scopes.
- Tag each command as required vs optional.

### Phase 4: Completion Report

- Return:
  - selected scope(s)
  - invariants checked
  - commands run and outcome
  - residual risks / deferred checks

## Common Pitfalls

- Treating optional rule files as higher authority than `AGENTS.md`.
- Weakening trust boundaries without adding allow/deny test coverage.
- Mixing Telegram linking semantics with generic waitlist state logic.

## Safe Defaults

- Choose the narrowest skill scope first, then add cross-skill checks only when needed.
- Run listed verification commands before merge or PR handoff.

## Sources

- `script/agent-runtime/skills/docs-and-rules/SKILL.md`
- `script/agent-runtime/skills/frontend-change/SKILL.md`
- `script/agent-runtime/skills/security-sensitive-api/SKILL.md`
- `script/agent-runtime/skills/telegram-linking/SKILL.md`
- `script/agent-runtime/skills/solana-provisioner/SKILL.md`
- `script/agent-runtime/skills/contracts-change/SKILL.md`
- `AGENTS.md`
