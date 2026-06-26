# 4626 Skills: Product And Frontend

## When To Use

Use this context for frontend, app routing, onboarding, waitlist/auth, Telegram Mini App flows, and Vercel API route behavior.

## Intake Checklist (Required)

1. affected route(s) and entry channel (web/Base/Telegram)
2. expected state transitions before and after change
3. whether canonical wallet or Telegram linking semantics are touched
4. user-visible failure/recovery behavior

## Canonical Invariants

- Verified email is the canonical 4626 identity and recovery key.
- All entry points (web, Base app, Telegram) converge to one verified-email account model.
- Canonical wallet policy is preserved; do not silently switch canonical account models.
- `linked`/`waitlist-joined` is not `execution-ready`; wallet-execution features remain gated.
- Telegram is a linked identity channel, not the canonical recovery key.

## Telegram Mini App Rules (Strict)

- Keep one authoritative state machine (single reducer-backed source of truth).
- OTP must be inline inside Telegram WebView (no Privy popup/modal).
- Preserve semantic order:
  1. verify fresh Telegram proof
  2. inline email OTP
  3. wait for Privy sync/account readiness
  4. bind Telegram identity
  5. persist backend state and consume single-use link token (if present)
- Never bind Telegram before verified-email canonical account resolution.

## Frontend/API Architecture Notes

- Frontend SPA + API surface lives in `frontend/` (Vite + React + TypeScript).
- API routes dispatch through static route registration in `frontend/api/_handlers/_routes.ts`.
- Keep provider topology stable; avoid ad hoc session polling around `useSiweAuth()`.
- Keep `/swap` quote flow input-driven; do not reintroduce idle timer re-quote loops.

## Execution Framework

### Phase 1: Flow Mapping

- Write current state-machine path for the affected flow.
- Mark invariant-sensitive transition points.

### Phase 2: Minimal Change Design

- Keep static API route topology.
- Prefer local component/controller edits over global provider reshaping.

### Phase 3: Regression Guarding

- Add/update tests for changed copy, state transitions, and gating behavior.
- Explicitly check that link success is not treated as execution-ready.

### Phase 4: Verification + Reporting

- Run lint/typecheck/tests.
- Report before/after behavior and residual risk.

## Commands

- Dev server: `pnpm -C frontend dev`
- Lint: `pnpm -C frontend lint`
- Typecheck: `pnpm -C frontend typecheck`
- Tests: `pnpm -C frontend test`

## Common Pitfalls

- Regressing Telegram flow to multi-source state booleans (`isReady`, `isVerified` from unrelated sources).
- Introducing waitlist/auth logic that mutates Telegram flow state mid-session.
- Adding dynamic API route patterns outside the static handler map.
- Treating link success as wallet execution readiness.

## Safe Defaults

- Prefer incremental changes that preserve route and provider topology.
- Keep auth behavior explicit and state-machine keyed.
- Reuse existing waitlist/auth/account setup helpers before adding new state paths.

## Sources

- `AGENTS.md`
- `script/agent-runtime/skills/frontend-change/SKILL.md`
- `script/agent-runtime/skills/telegram-linking/SKILL.md`
- `script/agent-runtime/skills/security-sensitive-api/SKILL.md`
