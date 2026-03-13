# Telegram 4626 Phase A+ Implementation Checklist

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship Phase A+ foundation for Telegram-native 4626 trading: link status/unlink, read commands, onboarding menu, and audit/schema plumbing.

**Architecture:** Reuse the existing Telegram webhook as the execution surface and add a dedicated Telegram server helper for schema/read-model operations. Keep write trading flows out of scope for this phase and hard-scope all new command responses to 4626 data (vault registry, CCA strategy references, Telegram action audit tables).

**Tech Stack:** Vercel API handlers, TypeScript, Postgres via `server/_lib/postgres`, Vitest for API tests.

---

## Scope For This Slice

- [x] Create implementation checklist doc
- [ ] Add Telegram schema and DB helpers (`telegram_user_links`, `telegram_action_tokens`, `telegram_action_audit`, `telegram_chat_vault_scope`)
- [ ] Wire webhook commands for:
  - `/link`, `/linked`, `/unlink`
  - `/portfolio`, `/vaults` (`/list` alias), `/auctions`, `/mybids`, `/signals`
- [ ] Add API endpoints:
  - `POST /api/telegram/unlink`
  - `GET /api/telegram/portfolio`
- [ ] Update Telegram menu/inline callbacks for new read/setup actions
- [ ] Add/expand tests for webhook + route registration + endpoint behavior

## Task 1: Telegram DB Foundation

**Files:**
- Create: `frontend/server/_lib/telegramTrading.ts`

**Checklist:**
- [ ] Add `ensureTelegramTradingSchema(db)` with idempotent `CREATE TABLE IF NOT EXISTS` + index creation for:
  - `telegram_user_links`
  - `telegram_action_tokens`
  - `telegram_action_audit`
  - `telegram_chat_vault_scope`
- [ ] Add helpers:
  - `getTelegramLinkStatus(telegramUserId)`
  - `revokeTelegramLink(telegramUserId, reason?)`
  - `getTelegramPortfolioSummary(telegramUserId)`
  - `listTelegramScopedVaults(chatId, limit?)`
  - `listTelegramAuctions(chatId, limit?)`
  - `listTelegramSignals(chatId, limit?)`
  - `listTelegramUserBids(telegramUserId, limit?)`
- [ ] Add lightweight formatting-safe null handling for empty/no-db cases.

## Task 2: Webhook Command Wiring

**Files:**
- Modify: `frontend/api/_handlers/telegram/_webhook.ts`
- Test: `frontend/api/__tests__/telegramWebhook.test.ts`

**Checklist:**
- [ ] Add command detection for the new Phase A+ read/setup commands.
- [ ] Route new commands before fallback Keepr command execution.
- [ ] Add `/start` onboarding message variant that includes read/setup shortcut menu.
- [ ] Expand inline keyboard/menu callbacks for:
  - link status/unlink
  - portfolio/vaults/auctions/signals
- [ ] Ensure callback query mapping supports new menu actions.
- [ ] Keep existing `/help` + topic callbacks fully backward compatible.

## Task 3: Telegram API Endpoints

**Files:**
- Create: `frontend/api/_handlers/telegram/_unlink.ts`
- Create: `frontend/api/_handlers/telegram/_portfolio.ts`
- Modify: `frontend/api/_handlers/_routes.ts`

**Checklist:**
- [ ] Implement `POST /api/telegram/unlink`.
- [ ] Implement `GET /api/telegram/portfolio`.
- [ ] Register routes in static loader map.
- [ ] Return consistent `ApiEnvelope` success/error shape.

## Task 4: Tests (Red -> Green)

**Files:**
- Modify: `frontend/api/__tests__/telegramWebhook.test.ts`
- Create (if needed): `frontend/api/__tests__/telegramEndpoints.test.ts`

**Checklist:**
- [ ] Write failing tests for:
  - `/linked` response path
  - `/unlink` response path
  - `/portfolio` response path
  - `/vaults`, `/auctions`, `/signals`, `/mybids` response paths
  - callback menu actions for new buttons
- [ ] Verify tests fail before implementation.
- [ ] Implement minimal behavior to pass.
- [ ] Keep existing Telegram webhook tests passing.

## Task 5: Verification

**Commands:**
- `pnpm -C frontend test -- api/__tests__/telegramWebhook.test.ts`
- `pnpm -C frontend test -- api/__tests__/telegramEndpoints.test.ts` (if created)
- `pnpm -C frontend lint`

**Checklist:**
- [ ] Run targeted Telegram tests.
- [ ] Run lint and address issues in touched files.
- [ ] Report exact pass/fail evidence in output summary.
