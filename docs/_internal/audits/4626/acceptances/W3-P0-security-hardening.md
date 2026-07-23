# Wave W3 P0 Security Hardening

Date: 2026-07-22

Scope: confirmed W3 P0 fixes requested for `frontend/` handlers and supporting runtime modules.

## Accepted changes

1. `frontend/server/_lib/hermit/pinataPin.ts`
   - Added SSRF hardening for remote media fetches.
   - Rejects private, link-local, localhost, and DNS-resolved private targets.
   - Follows redirects manually and rejects non-HTTPS redirect hops/final URLs.
   - Requires upstream `Content-Type` to be `image/*` and keeps the supported raster-image allowlist.

2. `frontend/api/_handlers/telegram/webhook/hermitDm.ts`
   - DM lane now defaults off.
   - Enablement now requires both explicit opt-in and a non-empty Telegram user allowlist.
   - DM executor context always uses `telegram:dm:<chatId>` instead of `alfaclub:<roomId>`.
   - Unmapped DM senders are forced to zero-address semantics; operator-only commands are denied.

3. `frontend/api/_handlers/v1/alfaclub/_chat-token.ts`
   - Removed the CRON-secret write/bootstrap path.
   - Token writes now require an authenticated admin session only.

4. `frontend/api/_handlers/keeper/_creSolanaNavIngest.ts`
   - Body `forceWrite` no longer bypasses shadow mode.

5. `frontend/api/_handlers/keeper/_creOracleValidateUpdate.ts`
   - Body `forceWrite` no longer bypasses shadow mode.

6. `frontend/api/_handlers/keeper/jobs/_run.ts`
   - Outbound bearer-call base URL must come from `KEEPER_COORDINATION_BASE_URL`.
   - Removed Host-header derivation fallback.

7. `frontend/api/_handlers/keeper/jobs/_processKeeprActions.ts`
   - Outbound bearer-call base URL must come from `KEEPER_COORDINATION_BASE_URL`.
   - Removed Host-header derivation fallback.

8. `frontend/server/_lib/onchain/solanaLotteryOappSender.ts`
   - Dedicated `SOLANA_LOTTERY_OAPP_SEND_TOKEN` is now required.
   - No fallback to `KPR_API_KEY` or `KEEPR_API_KEY`.

9. `frontend/server/_lib/onchain/solanaLotteryLzTransport.ts`
   - Readiness checks now require the dedicated OApp sender token.

10. `frontend/api/_handlers/telegram/webhook/config.ts`
    - Webhook auth now reads `TELEGRAM_WEBHOOK_SECRET` only.
    - Removed webhook-secret fallback to `TELEGRAM_BOT_CONFIG_SECRET` / `TELEGRAM_LINK_API_SECRET`.

11. `frontend/api/_handlers/telegram/_miniapp-session.ts`
    - Mini App proof verification now requires `TELEGRAM_BOT_TOKEN` specifically.
    - Removed fallback verification against Hermit / AlfaClub bot tokens.

12. `frontend/server/_lib/alfaclub/inverseAkitaChatReactionPolicy.ts`
    - Stake eligibility now requires stake in the message room itself.
    - Auto-discovered rooms are listen-only unless explicitly allowlisted for trading.

13. `frontend/server/_lib/alfaclub/inverseAkitaChatTradeEvent.ts`
14. `frontend/server/_lib/alfaclub/inverseAkitaChatReaction.ts`
    - Username alone no longer qualifies a message as a Chip / system sender.
    - Chip trade handling now requires the sender allowlist match.

15. `frontend/server/_lib/hermit/skillRouter.ts`
    - Strategy opt-in now requires a per-user Arena identity (`identity.source === 'user'`).
    - Room-default identities no longer satisfy `/s optin`.

16. `frontend/server/_lib/alfaclub/chatBridge.ts`
    - First poll for a room now seeds/ingests only.
    - Cron first-poll history no longer replays commands or inverse trade reactions.

## Validation

- `pnpm -C frontend exec vitest run api/__tests__/telegramHermitDm.test.ts api/__tests__/telegramWebhookIngress.test.ts api/__tests__/telegramWebhook.test.ts api/__tests__/telegramEndpoints.test.ts` -> exit `0`
- `pnpm -C frontend exec vitest run api/__tests__/keeperCreHandlers.test.ts api/__tests__/keeperJobs.handler.test.ts` -> exit `0`
- `pnpm -C frontend exec vitest run api/__tests__/alfaclubChatTokenEndpoint.test.ts` -> exit `0`
- `pnpm -C frontend exec vitest run server/_lib/hermit/pinataPin.test.ts server/_lib/hermit/skillRouter.test.ts` -> exit `0`
- `pnpm -C frontend exec vitest run server/_lib/alfaclub/inverseAkitaChatReactionPolicy.test.ts server/_lib/alfaclub/inverseAkitaChatTradeEvent.test.ts server/_lib/alfaclub/chatBridge.test.ts` -> exit `0`
- `pnpm -C frontend exec vitest run server/_lib/onchain/solanaLotteryOappSender.test.ts` -> exit `0`
