# Account And Auth Invariants

This document is the authoritative product model for 4626 account creation, sign-in, recovery, and identity linking.

If code or UX conflicts with this document, the code/UX should change unless product explicitly decides otherwise.

## Core rules

- Verified email is the canonical 4626 identity and recovery key.
- No account is fully created until email OTP verification completes.
- Privy is the auth/session backend for email OTP and session management.
- The Privy-backed signup/auth flow should also create the user's embedded EOA.
- Every fully onboarded account must have a Privy embedded EOA.
- Telegram is a linked identity and acquisition channel, not the canonical recovery key.
- Telegram Mini App verification remains required for Telegram-launched flows.
- Website sign-in defaults to email OTP.

## Entry-point model

Users may start from any product surface:

- website
- Base app
- Telegram Mini App
- Zora cross-app

All of those entry points must converge into the same account model.

The system must not create separate mental models like:

- "Telegram account"
- "website account"
- "Base app account"

There is only one 4626 account. Different entry points attach different identities to it.

## Canonical account key

The canonical cross-surface account key is:

- verified email

That means:

- sign-in and recovery on the website are email-first
- account merge decisions are resolved against verified email
- Telegram alone is not sufficient as the canonical recovery key

## Telegram rules

Telegram has two separate roles:

1. acquisition / onboarding surface
2. linked identity on an existing 4626 account

Telegram Mini App `initData` is still required for Telegram-launched flows because it proves:

- the request really came from Telegram
- which Telegram user launched it
- which Telegram chat context launched it

But Telegram Mini App verification does **not** replace email as the canonical account key.

### Required Telegram flow

When a user starts from Telegram:

1. Verify Telegram Mini App session server-side.
2. Collect email inside the Mini App.
3. Verify email by OTP through Privy.
4. Resolve the 4626 account by verified email.
5. Attach Telegram identity to that account.
6. Finish account creation only after OTP success.

### Existing email behavior

If the verified email already belongs to an existing 4626 account:

- attach Telegram to that existing account after verification
- do not create a second account

### Conflict behavior

If the Telegram identity is already linked to a different account:

- do not silently auto-merge
- block the action
- require explicit recovery / merge UX

## Normal web auth surface

On normal web, auth should expose:

1. Continue with email
2. Continue with Base
3. Continue with Zora

The intended priority is:

- email OTP as the default path
- Base as the wallet-native path
- Zora as the Zora-native path

Base and Zora are entry/login methods or linked identity sources. They do not define separate account systems.

If a user authenticates through Base or Zora but still has no verified email, they must complete email OTP before the account is considered fully created.

## Base and Zora rules

- Base Account users should use the Base-native auth path.
- Zora users should use the Zora cross-app path.
- Both paths must resolve into the same verified-email-based 4626 account model.
- Do not use Zora as the fallback path for Base-only users.

## Canonical wallet invariant

Account identity and execution wallet topology are separate concerns.

The intended order is:

1. authenticate / create account through Privy
2. verify email OTP
3. create or resolve the Privy embedded EOA
4. resolve or create the canonical Coinbase Smart Wallet
5. add the Privy embedded EOA as an owner on that CSW
6. confirm owner status onchain

Rules:

- if the user has a canonical CSW, the Privy embedded EOA must be installed as an owner on it
- if the user does not yet have a CSW, route them to Base app with the referral flow, then resume owner-installation when they return
- do not make CSW existence a prerequisite for account creation
- do not treat CSW linkage as complete until owner confirmation succeeds
- features that require canonical CSW execution must stay gated until this owner-installation step is complete

### Session implementation notes

These are implementation constraints that preserve the product model above:

- `useSiweAuth()` is the shared app-session restoration path and should remain the single place that rehydrates the 4626 bearer/cookie-backed session.
- Multiple UI consumers may read auth state, but they should not add independent `/api/auth/me` polling or bridge loops around the shared hook.
- A connected owner EOA and a canonical CSW-backed app session are allowed to differ during canonical execution flows; wallet/session mismatch alone is not a reason to force a new session.
- Features that require canonical submit should gate on the canonical-session checks instead of trying to auto-heal every mismatch in the background.

## Website rules

Website auth should be simple:

1. user enters email
2. user receives OTP
3. user signs in

Do not assume Telegram is the primary website sign-in method.

If product later wants web Telegram login, that is a separate deliberate feature and must still resolve into the same verified-email-based account model.

## Legacy policy

Do not keep conflicting legacy onboarding/auth paths just because they already exist.

If an older flow violates these invariants, it should be:

- removed
- replaced
- or migrated

Compatibility is less important than preserving one clear account model.

## Telegram Mini App Implementation Invariants

The Telegram Mini App flow must follow these implementation-level guarantees:

The current preserved implementation is documented in:

- `docs/telegram-canonical-link-preservation.md`
- `frontend/docs/telegram-miniapp-link-architecture.md`

### Required States

The flow must be implemented as an explicit state machine with at least:

- `verify_telegram_session`
- `collect_email`
- `sending_email_code`
- `enter_email_code`
- `verifying_email_code`
- `wait_for_privy_sync`
- `bind_telegram`
- `success`
- `expired_or_error`

### State Ownership

- There must be a single source of truth for flow state.
- UI must map 1:1 to state machine state.
- Do not derive verification state from multiple async sources.

### Verification Semantics

- Email is not considered verified until:
  1. OTP is valid AND
  2. canonical account is resolved AND
  3. session is fully hydrated

- “Verified” UI must not render before all conditions above are met.

### Telegram Binding

- Telegram identity must only be attached after:
  - verified email
  - canonical account resolution
- Telegram must never become the canonical identity.

### Failure Handling

- Expired or invalid Telegram session must produce explicit error state.
- OTP failure must be recoverable without restarting the flow.
- Privy sync delays must not cause regression to earlier states.

### Observability

- The Telegram Mini App flow must emit transition-level telemetry from one authoritative state machine.
- Telemetry must cover Mini App session verification outcome, Privy/account sync timing, backend completion result, and link-token claim/consume outcome.
- Observability must preserve transport boundaries: Telegram-specific onboarding/link telemetry stays on the Telegram webhook + Mini App side and must not rely on the Railway XMTP runtime.

### Account Resolution

- Existing email -> attach Telegram
- New email -> create account, then attach Telegram
- No duplicate accounts for same verified email

## Current Preserved Telegram Link Path

This is the current working sequence that must survive simplification work:

1. `frontend/src/pages/TelegramLink.tsx` admits the user into an isolated
   Telegram route and starts the reducer in
   `frontend/src/pages/telegramLinkFlow.ts`.
2. `frontend/src/lib/telegramWebApp.ts` exchanges Telegram `initData` for a
   short-lived backend `sessionToken` through
   `POST /api/telegram/miniapp/session`.
3. Email OTP runs inline through Privy `useLoginWithEmail()`.
4. The flow enters explicit `wait_for_privy_sync` and does not proceed until
   `/api/accounts/me` resolves the verified email to the canonical 4626
   account.
5. If needed, the frontend links Telegram to the active Privy user through
   `useLinkAccount().linkTelegram(...)`.
6. The frontend calls `POST /api/telegram/link/complete`, which re-validates
   the Telegram Mini App session, syncs account/wallet identity, claims and
   consumes the single-use link token, and persists `telegram_user_links`.
7. Canonical CSW setup remains a separate concern from Telegram linkage; the
   link may complete before CSW setup is finished, but execution-gated features
   stay blocked until canonical owner confirmation succeeds.

## Simplification Guidance

There is no safer shortcut than the current semantic order above.

The main acceptable optimization is structural:

- reduce route/provider complexity around `/telegram/link`
- keep one authoritative reducer/state machine
- replace the current `/api/accounts/me` polling loop with a narrower canonical
  readiness signal if desired

The following are not acceptable optimizations:

- replacing inline OTP with Privy modal/popup auth
- binding Telegram before verified-email account resolution
- removing Mini App session verification
- removing single-use token claim/consume semantics
