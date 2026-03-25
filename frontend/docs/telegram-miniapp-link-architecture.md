# Telegram Mini App Link & Onboarding Architecture

## Purpose

Define a deterministic, reliable architecture for Telegram Mini App onboarding and account linking.

This flow must work inside Telegram WebView and preserve the 4626 identity model.

Current implementation-preservation notes live in:

- `docs/telegram-canonical-link-preservation.md`
- `frontend/docs/account-auth-invariants.md`

---

## Core Invariants

- Verified email is the canonical identity
- Telegram is a linked identity only
- Email verification occurs inside the Mini App
- All users resolve to a verified-email-based account

---

## Runtime Constraints (Telegram WebView)

- Popup/modal auth flows are unreliable
- App may reinitialize unexpectedly
- Async hydration (Privy) may lag behind UI events
- Network and lifecycle events are less predictable than normal browsers

---

## State Machine

### States

1. `verify_telegram_session`
2. `collect_email`
3. `sending_email_code`
4. `enter_email_code`
5. `verifying_email_code`
6. `wait_for_privy_sync`
7. `bind_telegram`
8. `success`
9. `expired_or_error`

---

## Key State Rules

### `verify_telegram_session`

- Validate Telegram init data
- Reject invalid or expired sessions early

### `collect_email`

- Owns email input state
- Must not reset or flicker

### `sending_email_code`

- Initiates OTP send
- Transitions deterministically

### `enter_email_code`

- Inline OTP input only
- Fully user-controlled

### `verifying_email_code`

- Verifies OTP
- Does NOT assume account/session readiness

### `wait_for_privy_sync`

- Explicit state
- Waits for verified-email account readiness, not full wallet execution
- Uses a dedicated readiness contract instead of the broader account payload
- Must not regress silently

### `bind_telegram`

- Attaches Telegram identity to resolved account

### `success`

- Stable terminal state

### `expired_or_error`

- Explicit failure state
- Must distinguish failure types

---

## Privy Synchronization Model

Important:

OTP success != account ready

Actual sequence:

1. OTP verified
2. Privy processes auth
3. Session becomes available
4. React state hydrates
5. User/account becomes available

The system must explicitly wait for step 5 before proceeding.

---

## Data Ownership

Each state owns its required data:

- email -> owned by `collect_email+`
- otp -> owned by `enter_email_code+`
- telegram session -> owned from initial verification through bind
- account/user -> only valid after Privy sync

No shared mutable global state for these values.

---

## Routing Rules

- `/telegram/link` must not be overridden by waitlist logic
- Valid Telegram context bypasses app gating
- Flow must not depend on general app session restoration
- Async Telegram route/bootstrap helpers are allowed before the reducer starts
- Query/stored Telegram link context must persist until proof capture succeeds

---

## Failure Taxonomy

Explicitly handle:

- invalid Telegram session
- expired Telegram session
- OTP send failure
- OTP verification failure
- Privy sync delay/failure
- Telegram bind failure

Each must map to a visible state.

---

## Anti-Patterns

Do NOT:

- use Privy modal auth
- assume OTP success = logged in
- derive verification state from multiple sources
- reset form state on auth updates
- remount flow due to auth changes
- treat full `/api/accounts/me` hydration as the minimum readiness contract
- hide retries
- bounce between states implicitly

---

## Regression Checklist

Before merging:

- email input does not flicker
- OTP input remains usable
- no snap-back after verification
- verified UI appears only when truly verified
- `wait_for_privy_sync` is visible and stable
- Telegram bind happens only after account readiness
- existing/new account flows both work
- no unintended routing to waitlist logic

---

## Testing Expectations

- deterministic state transitions
- no UI regression under async delays
- stable behavior inside Telegram WebView assumptions
- explicit coverage for Telegram route admission and wait-state readiness
