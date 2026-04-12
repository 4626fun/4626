# Telegram Typed Client Spike Decision

## Scope

- Timebox: 2-hour spike
- Goal: evaluate whether a typed Telegram Bot API client can improve wrapper type safety without changing runtime webhook behavior
- POC surface: `frontend/api/_handlers/telegram/webhook/telegramApi/interactions.ts`

## Selection Criteria

1. Method/type parity for current calls (`sendMessage`, `editMessageText`, `answerCallbackQuery`, `answerInlineQuery`, `setWebhook`, `setMyCommands`, `setChatMenuButton`)
2. ESM + Node compatibility with current frontend/Vercel toolchain
3. Runtime adapter friction (can we preserve existing wrapper contracts and JSON behavior)
4. Maintenance signal (recent releases, active package updates)

## Package Fit Snapshot

### `wrappergram`

- npm package available (`1.3.0`)
- ESM + type exports present
- Dependencies: `@gramio/files`, `@gramio/types`
- Unpacked size: ~18.9 KB
- Last release signal in npm time metadata: 2025-04

### `@effect-ak/tg-bot-client`

- npm package available (`1.5.0`)
- ESM + type exports present
- Dependencies: `@effect-ak/tg-bot-api`
- Unpacked size: ~28.7 KB
- Last release signal in npm time metadata: 2026-04
- API surface is generated from Telegram Bot API with strongly typed method inputs/outputs

## POC Changes

- Added dependency: `@effect-ak/tg-bot-client`
- Updated `interactions.ts` payload typing from broad `Record<string, unknown>` to typed payload extraction from `ExecuteMethod`:
  - `TelegramCallbackQueryPayload`
  - `TelegramPreCheckoutPayload`
- Preserved runtime behavior:
  - kept direct `fetch` + JSON body
  - kept existing endpoint URLs
  - kept existing error message shape and truncation behavior

No call-site changes were required in `frontend/api/_handlers/telegram/_webhook.runtime.ts`.

## Verification Results

- `pnpm --dir frontend exec vitest api/__tests__/telegramWebhook.test.ts --run`
  - PASS (117/117)
- `pnpm --dir frontend lint -- api/_handlers/telegram/webhook/telegramApi/interactions.ts`
  - PASS
- `pnpm --dir frontend typecheck`
  - FAIL due to pre-existing unrelated errors in `src/pages/TelegramLink.tsx`
  - no new typecheck failures introduced by `interactions.ts` changes

## Decision

### Go (typed contracts), No-Go (runtime client execution)

Adopt **`@effect-ak/tg-bot-client` as a type source** for incremental wrapper hardening.

Do **not** switch runtime method execution in current wrappers to the client executor yet.

### Why runtime execution is No-Go right now

1. The client executor serializes method inputs as `FormData`, while current wrappers and tests expect JSON request bodies for these ack paths.
2. The client payload builder drops falsey values (`if (!value) continue`), which can omit required `ok: false` in `answerPreCheckoutQuery` failure cases.

Both issues create behavior risk for existing webhook flows unless an additional compatibility layer is introduced.

## Migration Estimate (If Continuing)

- `interactions.ts`: complete (types-only hardening)
- `inline.ts`: 30-45 min
- `messaging.ts`: 30-45 min
- `server/_lib/telegramBotApi.ts`: 45-60 min
- Total incremental effort: ~2.5 to 3.5 hours (excluding upstream/runtime refactor)

## Rollback Plan

1. Remove `@effect-ak/tg-bot-client` from `frontend/package.json`
2. Revert `interactions.ts` type aliases back to local payload types
3. Run:
   - `pnpm --dir frontend exec vitest api/__tests__/telegramWebhook.test.ts --run`
   - `pnpm --dir frontend lint -- api/_handlers/telegram/webhook/telegramApi/interactions.ts`

This returns the module to pre-spike behavior with no routing or auth invariant impact.
