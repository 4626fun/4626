# ElizaOS + OpenClaw + Uniswap (Single Runtime Strategy)

We use **ElizaOS as the primary agent runtime** and keep OpenClaw as a compatibility transport/API surface.

## Design

- ElizaOS runtime hosts actionable plugins (including Uniswap skill execution).
- OpenClaw tool endpoints expose the same actions externally.
- Both paths call shared server module: `server/uniswap/agentSkills.ts`.

## Why this setup

- One source of truth for validation, timeouts, and upstream behavior.
- Existing OpenClaw clients keep working.
- ElizaOS remains the primary orchestrator, so we avoid split behavior.

## Available Uniswap skill names

- `uniswap_quote`
- `uniswap_check_approval`
- `uniswap_build_swap`
- `uniswap_batch_swap_5792`
- `uniswap_delegated_swap_7702`
- `uniswap_crosschain_plan`
- `uniswap_liquidity`

## ElizaOS command format

Use:

```text
/uniswap <skill_name> <json_payload>
```

Example:

```text
/uniswap uniswap_quote {"tokenIn":"0x4200000000000000000000000000000000000006","tokenOut":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","tokenInChainId":8453,"tokenOutChainId":8453,"type":"EXACT_INPUT","amount":"1000000000000000","swapper":"0x1111111111111111111111111111111111111111"}
```

## Creative rate-limit policy

Creative generation now has intentionally split limits so the direct API path stays primary:

- `POST /api/agent/creative` uses `RATE_LIMITS.agentCreative` (`30/min` per IP).
- `POST /api/openclaw/execute` for creative tools (`referral_og`, `share_page_copy`, `quest_reward`, `metadata_bundle`) also enforces `RATE_LIMITS.openclawCreativeAdapter` (`20/min` per actor+IP).

Why this split:

- Direct creative endpoint is the canonical path and gets the higher budget.
- OpenClaw creative adapter is a compatibility layer, so it is intentionally stricter.
- Both limits are independently tunable without changing creative contract behavior.
