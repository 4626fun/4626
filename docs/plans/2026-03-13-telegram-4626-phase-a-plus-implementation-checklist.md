# Telegram 4626 Phase A+ Implementation Checklist

> **Execution note:** Follow this plan task-by-task.

**Goal:** Ship Phase A+ foundation for Telegram-native 4626 trading: link status/unlink, read commands, onboarding menu, and audit/schema plumbing.

**Execution Status:** Completed on 2026-03-13 (expanded through Phases B/C + Stars tips-first).

**Architecture:** Reuse the existing Telegram webhook as the execution surface and add a dedicated Telegram server helper for schema/read-model operations. Keep write trading flows out of scope for this phase and hard-scope all new command responses to 4626 data (vault registry, CCA strategy references, Telegram action audit tables).

**Tech Stack:** Vercel API handlers, TypeScript, Postgres via `server/_lib/postgres`, Vitest for API tests.

---

## Scope For This Slice

- [x] Create implementation checklist doc
- [x] Add Telegram schema and DB helpers (`telegram_user_links`, `telegram_action_tokens`, `telegram_action_audit`, `telegram_chat_vault_scope`)
- [x] Wire webhook commands for:
  - `/link`, `/status`, `/unlink`
  - `/portfolio`, `/vaults` (`/list` alias), `/auctions`, `/mybids`, `/signals`
- [x] Add API endpoints:
  - `POST /api/telegram/unlink`
  - `GET /api/telegram/portfolio`
- [x] Update Telegram menu/inline callbacks for new read/setup actions
- [x] Add/expand tests for webhook + route registration + endpoint behavior

## Task 1: Telegram DB Foundation

**Files:**
- Create: `frontend/server/_lib/telegramTrading.ts`

**Checklist:**
- [x] Add `ensureTelegramTradingSchema(db)` with idempotent `CREATE TABLE IF NOT EXISTS` + index creation for:
  - `telegram_user_links`
  - `telegram_action_tokens`
  - `telegram_action_audit`
  - `telegram_chat_vault_scope`
- [x] Add helpers:
  - `getTelegramLinkStatus(telegramUserId)`
  - `revokeTelegramLink(telegramUserId, reason?)`
  - `getTelegramPortfolioSummary(telegramUserId)`
  - `listTelegramScopedVaults(chatId, limit?)`
  - `listTelegramAuctions(chatId, limit?)`
  - `listTelegramSignals(chatId, limit?)`
  - `listTelegramUserBids(telegramUserId, limit?)`
- [x] Add lightweight formatting-safe null handling for empty/no-db cases.

## Task 2: Webhook Command Wiring

**Files:**
- Modify: `frontend/api/_handlers/telegram/_webhook.ts`
- Test: `frontend/api/__tests__/telegramWebhook.test.ts`

**Checklist:**
- [x] Add command detection for the new Phase A+ read/setup commands.
- [x] Route new commands before fallback Keepr command execution.
- [x] Add `/start` onboarding message variant that includes read/setup shortcut menu.
- [x] Expand inline keyboard/menu callbacks for:
  - link status/unlink
  - portfolio/vaults/auctions/signals
- [x] Ensure callback query mapping supports new menu actions.
- [x] Keep existing `/help` + topic callbacks fully backward compatible.

## Task 3: Telegram API Endpoints

**Files:**
- Create: `frontend/api/_handlers/telegram/_unlink.ts`
- Create: `frontend/api/_handlers/telegram/_portfolio.ts`
- Modify: `frontend/api/_handlers/_routes.ts`

**Checklist:**
- [x] Implement `POST /api/telegram/unlink`.
- [x] Implement `GET /api/telegram/portfolio`.
- [x] Register routes in static loader map.
- [x] Return consistent `ApiEnvelope` success/error shape.

## Task 4: Tests (Red -> Green)

**Files:**
- Modify: `frontend/api/__tests__/telegramWebhook.test.ts`
- Create (if needed): `frontend/api/__tests__/telegramEndpoints.test.ts`

**Checklist:**
- [x] Write failing tests for:
  - `/status` response path
  - `/unlink` response path
  - `/portfolio` response path
  - `/vaults`, `/auctions`, `/signals`, `/mybids` response paths
  - callback menu actions for new buttons
- [x] Verify tests fail before implementation.
- [x] Implement minimal behavior to pass.
- [x] Keep existing Telegram webhook tests passing.

## Task 5: Verification

**Commands:**
- `pnpm -C frontend test -- api/__tests__/telegramEndpoints.test.ts api/__tests__/telegramWebhook.test.ts api/__tests__/waitlistVerifySocial.test.ts`
- `pnpm -C frontend typecheck`
- `pnpm -C frontend exec eslint api/_handlers/telegram/_webhook.ts api/__tests__/telegramWebhook.test.ts api/__tests__/telegramEndpoints.test.ts api/_handlers/waitlist/_verify-social.ts`

**Checklist:**
- [x] Run targeted Telegram tests.
- [x] Run lint and address issues in touched files.
- [x] Report exact pass/fail evidence in output summary.
