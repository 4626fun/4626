# Waitlist Entry & Email Rules Matrix

This document maps the main onboarding/waitlist entry paths and how email requirements are enforced.

## Why this exists

We have multiple entry points (web, Base app, CSW-first) and multiple identity states (signed-in, wallet-linked, email-linked). This matrix is intended to prevent regressions where one path accidentally enforces the wrong email rule.

## Terms

- **Real email**: any normal user email address.
- **Synthetic email**: fallback identity email used for wallet-only flows.
  - Current domain: `@wallet.4626.fun`
  - Legacy domain: `@noemail.4626.fun`
  - Legacy historical formats: `solinfer-*`, `wallet-*`, `anon-*`, `0x*@example.com`

## Entry-path matrix

| Entry path | Typical identity state | Contact preference | Email requirement | Expected behavior |
|---|---|---|---|---|
| Marketing waitlist (`/#waitlist`) with typed email | no wallet required | `email` | Real email required | Signup succeeds with real email |
| Marketing waitlist, wallet-only continuation | wallet/csw linked, no email typed | `wallet` | Real email **not** required | Client submits synthetic `@wallet.4626.fun` email |
| Base app / CSW direct entry, no email | CSW present, email absent | `wallet` | Real email **not** required | Signup allowed with synthetic email and wallet signal |
| Creator flow with verification signal | wallet/farcaster/solana/verifications present | `wallet` or `email` | If `email`, real required; otherwise optional | Creator signup proceeds if verification exists |
| Any flow with `contactPreference === email` | any | `email` | Real email required | Synthetic email must be rejected |
| Synthetic email + no verification signal | none | not meaningful | Real email required | Request rejected to prevent anonymous synthetic-only rows |

## API-side rules (authoritative)

`POST /api/waitlist` enforces:

1. Basic email shape must be valid.
2. Synthetic email is allowed only for non-email contact flows.
3. Synthetic email requires at least one non-email verification/contact signal.
4. Synthetic email is treated as lower quality than a real email during dedupe/adoption decisions.

## Domain-constraint compatibility

Some DB environments enforce a check constraint that disallows `@noemail.4626.fun`.
To remain compatible, wallet-only synthetic generation must use `@wallet.4626.fun`.

## Future changes checklist

When touching onboarding/waitlist logic, validate all of the following:

1. **Client generation**: synthetic fallback domain.
2. **API validation**: synthetic detection + contact preference checks.
3. **Profile resolution ranking**: synthetic domains ordered consistently in `_waitlist`, `_me`, and `_update-email`.
4. **Deploy/session coupling**: CSW-first users should not be blocked on email before deploy preflight.
5. **Regression tests**: run waitlist and deploy-session auth tests.

