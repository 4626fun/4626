# Waitlist Entry & Email Rules Matrix

This document maps the main onboarding/waitlist entry paths and how email requirements are enforced.

## Why this exists

We have multiple entry points (web, Base app, Zora, Telegram) and multiple identity states (unauthenticated, Privy-authenticated, email-verified, wallet-finalized). This matrix is intended to prevent regressions where one path accidentally bypasses the verified-email rule.

## Terms

- **Real email**: any normal user email address.
- **Verified email**: an email confirmed through Privy OTP. This is the canonical 4626 identity and recovery key.
- **Wallet finalization**: the stage where the user's canonical CSW is resolved and the Privy embedded EOA is installed as an owner when needed.

## Entry-path matrix

| Entry path | Typical identity state | Contact preference | Email requirement | Expected behavior |
|---|---|---|---|---|
| Website waitlist / app entry | no auth yet | `email` | Verified email required | User signs in with Privy email OTP before the account is considered created |
| Base app entry | Base context present, email absent | `email` | Verified email required | User can start in Base, but must finish email OTP before account creation completes |
| Zora cross-app entry | Zora identity present, email absent | `email` | Verified email required | Zora can seed wallet/profile signals, but verified email still gates account creation |
| Telegram Mini App entry | Telegram session present, email absent | `email` | Verified email required | Telegram can prove chat/user context, but account creation/linking still requires email OTP |
| Existing account with verified email | signed in | `email` | Already satisfied | User stays on the signed-in `/waitlist` workspace for Zora/CSW setup; `/accounts` remains the advanced recovery and secondary-identity surface |
| Any flow without verified email | any | `email` | Not satisfied | Account remains incomplete and wallet-dependent actions stay gated |

## API-side rules (authoritative)

`POST /api/waitlist/join` and the auth/bootstrap flows enforce:

1. Basic email shape must be valid.
2. Only Privy-verified email can become the canonical account email.
3. Base, Zora, Telegram, and wallet signals may enrich the account, but they do not replace verified email.
4. Wallet-dependent actions stay gated until canonical CSW resolution and owner-install checks are complete when required.

## Future changes checklist

When touching onboarding/waitlist logic, validate all of the following:

1. **Entry-point convergence**: website, Base, Zora, and Telegram must all end at the same verified-email account model.
2. **API validation**: only Privy-verified email may populate canonical account email.
3. **Workspace split**: signed-in `/waitlist` remains the default setup-first workspace; `/accounts` remains the advanced escape hatch.
4. **Wallet finalization**: canonical CSW resolution and embedded-EOA owner install must remain explicit post-auth steps.
5. **Deploy/session coupling**: deploy/session flows must not regress to single-provider or wallet-first authentication prompts.
6. **Regression tests**: run waitlist, account bootstrap, and deploy-session auth tests.
