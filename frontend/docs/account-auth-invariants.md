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
