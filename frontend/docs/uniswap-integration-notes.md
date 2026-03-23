# Uniswap Integration Notes

## Environment

Required variables:

- `UNISWAP_API_KEY` (or `UNISWAP_API`) — server-side API key used by `/api/uniswap/*` proxy handlers.
- `UNISWAP_TRADE_API_BASE` (optional) — defaults to `https://trade.api.uniswap.org/v1`.
- `VITE_CDP_PAYMASTER_URL` (optional) — used for canonical smart wallet execution path.

## Local run

```bash
cd frontend
cp .env.example .env
pnpm i
pnpm dev
```

## Capability detection and fallbacks

- **EIP-5792 / EIP-7702** are treated as progressive enhancements via existing `swap5792` / `swap7702` endpoints in the Uniswap client.
- Runtime capability probing lives in `src/lib/uniswap/capabilities.ts` and surfaces support in the UI.
- Default swap execution keeps the canonical smart-wallet ERC-4337 path for compatibility.
- If advanced flows are unavailable for a wallet/provider, the app falls back to approval + standard swap build/execute.

## Runtime posture on `/swap`

- Session restoration is shared through `src/hooks/useSiweAuth.ts`; avoid parallel `/api/auth/me` polling from swap-specific code.
- Admin session checks are route-scoped to `/admin` and should not be introduced into normal swap-route startup.
- Account-context canonical lookup via `/api/waitlist/me` is deferred until a signer exists.
- `ChatWidget` is lazy-activated; idle `/swap` should not mount `XmtpChatProvider`.
- Auto-quote still runs on real input changes.
- Idle stale-quote refresh is intentionally disabled. If a quote expires while the user is reviewing or submitting, `useSwapExecution.ts` rebuilds the quote on demand before execution continues.

These rules exist to keep `/swap` from looking like it is reloading itself because of session churn, provider boot noise, or background requote loops.

## Liquidity feature scope

- Added `liquidityApi` client module and `/api/uniswap/liquidity` proxy to support LP actions:
  - `positions`
  - `quote-create`
  - `create`
  - `add`
  - `remove`
  - `claim`
  - `migrate`
- UI currently exposes quote/create/remove/claim with simple + advanced modes.
- Migrate/add endpoints are wired in the client layer and can be enabled in UI progressively.

## Known limitations

- Upstream endpoint availability may vary by chain/account capabilities.
- LP response shapes differ across upstream revisions; current UI renders raw JSON for position payloads until a finalized schema is locked.
