# Telegram Canonical Link Preservation

This document preserves the current Telegram Mini App link flow that is known
to work:

- Telegram user proves launch context inside the Mini App
- email is verified inline through Privy
- the verified email resolves the canonical 4626 account
- the Privy embedded EOA remains the per-account signer
- the canonical Coinbase Smart Wallet remains the execution wallet
- Telegram becomes a linked identity on that canonical account

If future simplification work conflicts with this document, preserve this flow
unless product explicitly changes the identity model.

## Non-negotiable outcome

The working outcome is not "Telegram linked somehow." The working outcome is:

1. Telegram Mini App proof is fresh and verified.
2. Email OTP happens inline inside Telegram WebView.
3. The verified email resolves the canonical 4626 account.
4. The active Privy session resolves to the verified-email 4626 account.
5. Telegram is linked to that Privy user and persisted in app storage.
6. The account keeps its canonical CSW / embedded-EOA model.

Telegram must never become the canonical recovery key or replace verified email.

## Current working implementation

### 1. Route admission

`/telegram/link` is intentionally isolated from general waitlist/app routing.

Authoritative files:

- `frontend/src/App.tsx`
- `frontend/src/app/AppPrivyShell.tsx`
- `frontend/src/app/accessRuntime.tsx`
- `frontend/src/app/accessShared.tsx`
- `frontend/src/lib/telegramMiniAppLink.ts`
- `frontend/src/pages/TelegramLink.tsx`

Required behavior:

- valid Telegram Mini App context or Telegram link query context is enough to
  enter the flow
- route admission is allowed to use async Telegram bootstrap helpers before the
  reducer starts, as long as those helpers do not mutate machine state
- general waitlist gating must not take control once the Telegram flow starts
- query-derived/stored `tgLinkToken` context must survive until Telegram proof
  is captured into reducer-owned state
- Telegram query params must only be stripped after that proof capture succeeds
- route/provider simplification must not remount the flow or reset its state

### 2. Fresh Telegram Mini App proof

The frontend does not trust ambient Telegram context. It exchanges `initData`
for a short-lived server session token before doing anything else.

Frontend:

- `frontend/src/lib/telegramWebApp.ts`
- `frontend/src/pages/TelegramLink.tsx`

Backend:

- `frontend/api/_handlers/telegram/_miniapp-session.ts`
- `frontend/server/_lib/telegramTrading.ts`

Current contract:

- frontend calls `POST /api/telegram/miniapp/session`
- backend verifies `initData`
- backend enforces replay protection
- backend issues a short-lived `sessionToken`
- frontend stores and reuses that session only while it remains fresh

This step must remain separate from OTP and backend binding.

### 3. Inline email OTP through Privy

The Mini App performs email verification inline with `useLoginWithEmail()`.

Authoritative files:

- `frontend/src/pages/TelegramLink.tsx`
- `frontend/src/pages/telegramLinkFlow.ts`

Current rules:

- OTP is sent from the `sending_email_code` state
- OTP is verified from the `verifying_email_code` state
- no Privy popup/modal flow is allowed inside Telegram WebView
- OTP success does not mean the canonical account is ready yet

### 4. Explicit `wait_for_privy_sync`

After OTP succeeds, the flow waits for Privy readiness and canonical account
hydration before attempting any Telegram bind.

Authoritative files:

- `frontend/src/pages/TelegramLink.tsx`
- `frontend/api/_handlers/telegram/_link-ready.ts`
- `frontend/server/_lib/accountsIdentity.ts`

Current behavior:

- the frontend enters `wait_for_privy_sync`
- it waits for `privy.ready`, `privy.authenticated`, `privy.user`, and a usable
  access token
- it polls `POST /api/telegram/link/ready` with the verified email
- the backend verifies the Privy bearer, runs `syncEmailIdentity`, and returns
  a narrow readiness payload only when the active Privy session resolves to
  that verified email
- this state does **not** prove canonical wallet execution readiness or embedded
  EOA owner confirmation

This explicit wait state is one of the reasons the flow currently works. Do not
collapse it into a hidden background assumption.

### 5. Privy-side Telegram link

Once the canonical account is ready, the frontend ensures the active Privy user
is linked to Telegram.

Authoritative files:

- `frontend/src/pages/TelegramLink.tsx`

Current behavior:

- frontend enters `bind_telegram.ensure_privy_link`
- if the current Privy user already has the matching Telegram account, it skips
  this step
- otherwise it calls `useLinkAccount().linkTelegram({ launchParams: { initDataRaw } })`

This step is intentionally before backend completion.

### 6. Backend completion and persistence

The final bind is not complete until backend persistence succeeds.

Frontend:

- `frontend/src/pages/TelegramLink.tsx`

Backend:

- `frontend/api/_handlers/telegram/_link-complete.ts`
- `frontend/server/_lib/accountsIdentity.ts`
- `frontend/server/_lib/walletSync.ts`
- `frontend/server/_lib/telegramTrading.ts`

Current behavior in `POST /api/telegram/link/complete`:

- verifies the Privy session for accounts
- syncs email identity for the Privy user
- syncs wallets and resolves canonical wallet state
- re-validates the Telegram Mini App `sessionToken`
- if present, claims the single-use link-start token and checks that it matches
  the active Telegram user/chat
- runs Telegram merge/conflict preflight
- upserts `telegram_user_links`
- finalizes link-token consumption on success
- returns both the Telegram link record and canonical account payload

Important details:

- `linkToken` is optional; the flow must still work when no link-start token is
  present
- same-user retries must remain idempotent
- an already-consumed same-user token must be treated as success, not as a hard
  failure

This endpoint is the authoritative persistence boundary for Telegram link
completion.

### 7. Canonical CSW / embedded EOA meaning

Telegram linking is allowed to finish even if canonical wallet setup is not yet
complete.

Authoritative files:

- `frontend/server/_lib/walletSync.ts`
- `frontend/server/_lib/canonicalCswDelegation.ts`
- `frontend/server/_lib/telegramTrading.ts`

Current meaning:

- the Privy embedded EOA is the account-scoped signer created through Privy
- the canonical Coinbase Smart Wallet remains the target execution wallet
- Telegram link records may be `pending_wallet_setup` until canonical wallet
  setup is complete
- wallet-dependent features stay gated until canonical owner confirmation is
  complete
- owner confirmation truth comes from the canonical delegation / confirm-owner
  path, not from `wait_for_privy_sync` and not from link completion alone

Do not make Telegram linkage depend on immediate CSW completion if the product
still wants email-first account creation.

## Files that must stay aligned

If one of these changes, review the whole chain:

- `AGENTS.md`
- `frontend/docs/account-auth-invariants.md`
- `frontend/docs/telegram-miniapp-link-architecture.md`
- `frontend/src/app/AppPrivyShell.tsx`
- `frontend/src/app/accessShared.tsx`
- `frontend/src/pages/TelegramLink.tsx`
- `frontend/src/pages/telegramLinkFlow.ts`
- `frontend/src/lib/telegramMiniAppLink.ts`
- `frontend/src/lib/telegramWebApp.ts`
- `frontend/api/_handlers/telegram/_link-ready.ts`
- `frontend/api/_handlers/telegram/_miniapp-session.ts`
- `frontend/api/_handlers/telegram/_link-complete.ts`
- `frontend/server/_lib/telegramTrading.ts`
- `frontend/server/_lib/accountsIdentity.ts`
- `frontend/server/_lib/walletSync.ts`

## Maintenance rules

Keep these rules explicit during refactors:

- preserve the single authoritative frontend state machine
- preserve the explicit `wait_for_privy_sync` state
- preserve the async Telegram route/bootstrap admission logic needed before the
  reducer starts
- preserve the two-step backend contract:
  - Mini App session verification
  - verified-email readiness
  - backend completion
- preserve single-use, claim-bound, consumed-on-success Telegram link tokens
  when a link token is present
- preserve same-user idempotency for already-linked / already-consumed retries
- preserve conflict handling for Telegram identities already attached elsewhere
- preserve telemetry for session verify, OTP send/verify, Privy sync, Privy
  Telegram link, token claim/consume, and backend completion
- preserve `/telegram/link` as an isolated routing surface
- preserve query-derived/stored Telegram link context until proof capture
- do not move OTP out of the Mini App
- do not replace verified email with Telegram as the canonical key

## Tests to keep green

At minimum, keep these flows covered:

- `frontend/src/pages/TelegramLink.test.tsx`
- `frontend/src/pages/telegramLinkFlow.test.ts`
- `frontend/src/App.access.test.ts`
- `frontend/api/__tests__/telegramEndpoints.test.ts`
- `frontend/api/__tests__/telegramLinkReady.test.ts`
- `frontend/api/__tests__/telegramLinkComplete.test.ts`

## What can be simplified safely

The current flow can be simplified structurally, but not semantically.

Safe simplifications:

- reduce provider/shell scope around `/telegram/link`
- consolidate frontend side-effect orchestration, as long as the reducer remains
  the single source of truth
- extract state-scoped effects into a dedicated hook without changing state
  boundaries
- narrow telemetry plumbing, as long as phase-level observability remains
- replace polling implementation details, as long as the flow still waits for
  verified-email account readiness explicitly

## What is the more efficient or optimal path?

There is no better shortcut than the current semantic order. The optimal path
is to keep the same identity guarantees while reducing coordination overhead.

The current implementation already uses the preferred optimization:

- `wait_for_privy_sync` polls a narrow `POST /api/telegram/link/ready`
  readiness endpoint instead of the broader `/api/accounts/me` payload

But even if you do that, keep all of the following:

- fresh Telegram Mini App proof
- inline email OTP
- verified-email account resolution
- Privy-side Telegram link
- backend completion with optional token claim/consume and persistence

Do not collapse the flow into one opaque call that hides these boundaries.
