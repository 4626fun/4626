---
name: 4626-uniswap-ai
description: Uniswap AI and trading integration skill for 4626. Use for swap integration, UniswapX routing, approval/quote/swap-order flows, and planning adoption of official Uniswap AI skills while preserving 4626 trust boundaries and token-kind invariants.
---

# 4626 Uniswap AI

## When to Use This Skill

Use for any 4626 work involving:

- swap flows
- quote/approval/order handling
- UniswapX route execution
- Uniswap Trading API integration
- migration to or adoption of official Uniswap AI skills/plugins

Trigger when the user mentions Uniswap, Trading API, Universal Router, `check_approval`, `quote`, `swap`, `order`, `viem`, or “add Uniswap skills.”

## System Model

4626 already runs a repo-native Uniswap integration with server-side key handling:

- API handlers: `frontend/api/_handlers/uniswap/*`
- route map: `frontend/api/_handlers/_routes.uniswap.ts`
- upstream wrapper: `frontend/server/uniswap/trading.ts`
- client wrappers: `frontend/src/lib/uniswap/tradingApi.ts`
- execution hook: `frontend/src/hooks/useSwapExecution.ts`

Core invariants:

1. `UNISWAP_API_KEY` stays server-side only.
2. Browser clients call `api/uniswap/*`, never direct `trade-api.gateway.uniswap.org` with API keys.
3. Creator Coin and Share token identity must remain distinct in selection, metadata, and imagery.
4. Keep existing auth/rate-limit policy on all swap endpoints.
5. Preserve current routing split:
   - classic/wrap/unwrap/bridge -> swap transaction path
   - UniswapX routings (`DUTCH_*`, `PRIORITY`, `LIMIT_ORDER`) -> order path

## Official Uniswap Skills (External)

Uniswap publishes installable skills/plugins (external to this repo), including:

- `swap-integration`
- `pay-with-any-token`
- `viem-integration`
- `swap-planner`
- `liquidity-planner`
- `configurator`
- `deployer`
- `v4-security-foundations`

Installer command:

- `npx skills add Uniswap/uniswap-ai`

Use these as reference workflows, then map behavior into 4626’s existing server/client architecture above.

## Required Inputs

1. Goal: read-only planning vs implementation.
2. Target chain(s) and swap mode (`EXACT_INPUT`/`EXACT_OUTPUT`).
3. Token pair and token-kind intent (`creator` vs `share`).
4. Execution path (`swap`, `order`, `swap5792`, `swap7702`, or plan/liquidity).
5. UX behavior on partial failure (rate limit, upstream timeout, policy block).

## Instructions

1. Prefer current 4626 API surfaces before adding new ones.
2. For Trading API flow, keep this sequence:
   - `/api/uniswap/checkApproval`
   - `/api/uniswap/quote`
   - `/api/uniswap/swap` or `/api/uniswap/order` based on routing
3. Enforce route/token policy guards before forwarding upstream.
4. Keep API response sanitation and safe error mapping.
5. Do not expose secrets, raw upstream internals, or unsafe fallback routes.
6. If adding official Uniswap skill usage notes, mark them as external and optional.
7. Validate with:
   - `pnpm -C frontend lint`
   - `pnpm -C frontend typecheck`
   - `pnpm -C frontend test`
8. Report:
   - endpoints touched
   - routing behavior
   - policy/rate-limit implications
   - residual risks

## Common Errors

- Wrong: call Trading API directly from frontend with `x-api-key`.
  Correct: keep key in server env and proxy through `api/uniswap/*`.
- Wrong: always call `/swap` regardless of routing type.
  Correct: use `/order` for UniswapX routing families.
- Wrong: merge Creator Coin and Share token identity in UI/search.
  Correct: preserve token-kind metadata and branding boundaries.
- Wrong: bypass server token/route policy checks to “fix” quote failures.
  Correct: keep guardrails and return explicit safe failures.

## Sources

- `AGENTS.md`
- `frontend/api/_handlers/_routes.uniswap.ts`
- `frontend/api/_handlers/uniswap/_checkApproval.ts`
- `frontend/api/_handlers/uniswap/_quote.ts`
- `frontend/api/_handlers/uniswap/_swap.ts`
- `frontend/api/_handlers/uniswap/_order.ts`
- `frontend/server/uniswap/trading.ts`
- `frontend/server/uniswap/guards.ts`
- `frontend/src/lib/uniswap/tradingApi.ts`
- `frontend/src/hooks/useSwapExecution.ts`
- https://developers.uniswap.org/docs/uniswap-ai/overview
