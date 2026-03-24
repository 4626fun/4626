# Telegram Link Rebuild Handoff

## Goal

Rebuild the Telegram Mini App account-link flow from first principles so it is reliable inside Telegram's WebView.

## Product invariants

- Verified email is the canonical 4626 identity and recovery key.
- Telegram is a linked identity, not the canonical account.
- Telegram Mini App verification must stay enabled for Telegram-launched flows.
- Telegram onboarding must collect and verify email inside the Mini App.
- After OTP success:
  - if the email is new, create the 4626 account through Privy
  - if the email already exists, attach Telegram to that existing account
- All fully onboarded accounts must resolve into the same verified-email-based 4626 account model.

## Current state

- The prior Telegram link-flow implementation was intentionally removed.
- [TelegramLink.tsx](/home/akitav2/projects/4626/frontend/src/pages/TelegramLink.tsx) is now a placeholder route.
- The deleted files were:
  - `frontend/src/pages/telegramLinkFlow.ts`
  - `frontend/src/pages/TelegramLink.test.ts`

## What went wrong before

- Privy modal flows were unreliable inside Telegram WebView.
- OTP entry state could become disabled after sending the code.
- OTP success could snap back to "Verify your 4626 email" before Privy session sync completed.
- The flow accumulated retries and implicit transitions that obscured the real state.

## Recommended rebuild shape

Build a small explicit state machine with these phases:

1. `verify_telegram_session`
2. `collect_email`
3. `send_email_code`
4. `enter_email_code`
5. `verify_email_code`
6. `wait_for_privy_sync`
7. `bind_telegram`
8. `success`
9. `expired_or_recoverable_error`

Rules:

- Prefer inline OTP inside the Mini App. Do not depend on popup/modal auth.
- Keep UI state directly derived from machine state.
- Do not silently demote from `wait_for_privy_sync` back to `collect_email`.
- Keep Telegram launch/session proof required for final bind.
- Make session-expired and token-consumed states explicit.

## Main files to read

- [App.tsx](/home/akitav2/projects/4626/frontend/src/App.tsx)
- [TelegramLink.tsx](/home/akitav2/projects/4626/frontend/src/pages/TelegramLink.tsx)
- [TelegramMenu.tsx](/home/akitav2/projects/4626/frontend/src/pages/TelegramMenu.tsx)
- [telegramMiniAppLink.ts](/home/akitav2/projects/4626/frontend/src/lib/telegramMiniAppLink.ts)
- [telegramWebApp.ts](/home/akitav2/projects/4626/frontend/src/lib/telegramWebApp.ts)
- [trust.ts](/home/akitav2/projects/4626/frontend/server/_lib/trust.ts)
- [accountsIdentity.ts](/home/akitav2/projects/4626/frontend/server/_lib/accountsIdentity.ts)
- [frontend/api/_handlers/telegram](/home/akitav2/projects/4626/frontend/api/_handlers/telegram)
- [account-auth-invariants.md](/home/akitav2/projects/4626/frontend/docs/account-auth-invariants.md)
- [waitlist-accounts-architecture.md](/home/akitav2/projects/4626/frontend/docs/waitlist-accounts-architecture.md)

## Routing facts

- `/telegram/link` is intentionally app-only and belongs on `app.4626.fun`.
- It is outside the normal accepted-route waitlist gating when valid Telegram Mini App context or link-query context is present.
- Any rebuild should preserve that routing behavior.

## Prompt for the next GPT

```text
You are working in the 4626 monorepo at /home/akitav2/projects/4626.

Task: rebuild the Telegram Mini App account-link flow from first principles so it is reliable inside Telegram's WebView.

Product invariants from AGENTS.md:
- Verified email is the canonical 4626 identity and recovery key.
- Telegram is a linked identity, not the canonical account.
- Telegram Mini App verification must stay enabled for Telegram-launched flows.
- Telegram onboarding must collect and verify email inside the Mini App.
- After OTP success:
  - if the email is new, create the 4626 account through Privy
  - if the email already exists, attach Telegram to that existing account
- All fully onboarded accounts must resolve into the same verified-email-based 4626 account model.

Current problem:
- The old Telegram link flow has been removed because it was unstable.
- Earlier failures included:
  - Privy modal not opening inside Telegram WebView
  - OTP input becoming disabled after sending the code
  - OTP success snapping back to "Verify your 4626 email"
  - hidden retries masking the true state
- We want a simpler deterministic flow with explicit states and minimal hidden retries.

Routing facts:
- /telegram/link is intentionally app-only and should run on app.4626.fun.
- It is allowed when Telegram Mini App context or Telegram link query context is present.
- It should not depend on the normal waitlist-gated app flow when launched correctly from Telegram.

What to do:
1. Audit the current Telegram link path end to end.
2. Propose a simple explicit state machine for:
   - verify Telegram launch/session
   - collect email
   - send OTP
   - verify OTP
   - wait for Privy/account sync
   - bind Telegram identity
   - success / recoverable failure / expired session
3. Implement the new flow with inline OTP inside the Mini App.
4. Keep the UI directly aligned with the true machine state.
5. Add regression tests for the failures listed above.
6. Verify with vitest, eslint, and typecheck.

Please start by reading:
- frontend/src/App.tsx
- frontend/src/pages/TelegramLink.tsx
- frontend/src/pages/TelegramMenu.tsx
- frontend/src/lib/telegramMiniAppLink.ts
- frontend/src/lib/telegramWebApp.ts
- frontend/server/_lib/trust.ts
- frontend/server/_lib/accountsIdentity.ts
- frontend/api/_handlers/telegram/
- frontend/docs/account-auth-invariants.md
- frontend/docs/waitlist-accounts-architecture.md

Output wanted:
- short diagnosis
- rebuild plan
- implementation
- tests
- exact commands run
```
