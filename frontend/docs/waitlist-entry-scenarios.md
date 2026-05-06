# Waitlist Entry & Email Rules Matrix

> **Canonical reference:** [docs/ACCOUNT_MODEL.md](../../docs/ACCOUNT_MODEL.md). The user-population taxonomy in §2 is the canonical view; this matrix is the entry-path layer over it.

This document maps the main onboarding/waitlist entry paths and how email requirements are enforced.

## Why this exists

We have multiple entry points (web, Base app, Zora, Telegram) and multiple identity states (unauthenticated, Privy-authenticated, email-verified, wallet-finalized). This matrix is intended to prevent regressions where one path accidentally bypasses the verified-email rule.

## Terms

- **Real email**: any normal user email address.
- **Verified email**: an email confirmed through Privy OTP. This is the canonical 4626 identity and recovery key.
- **Wallet finalization**: the stage where the user's execution wallet becomes ready on the appropriate track. For CSW users (`executionMode === 'canonical'`), this means the canonical CSW is resolved and an app-scoped sub-account is created + signer-configured per [docs/4626-connection-methods.md](../../docs/4626-connection-methods.md) Section 2. For external EOA users (`executionMode === 'eoa'`), this means the EOA is connected via wagmi. The separate server-side owner-delegation track (deploy-session, agent) is governed by `.cursor/rules/csw-agent-lifecycle.mdc`.

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

`POST /api/waitlist/bootstrap` and the auth flows enforce:

1. Basic email shape must be valid.
2. Only Privy-verified email can become the canonical account email.
3. Base, Zora, Telegram, and wallet signals may enrich the account, but they do not replace verified email.
4. Wallet-dependent actions stay gated until the appropriate execution-track readiness check succeeds — sub-account persisted + signer configured for CSW users, or connected EOA for external-EOA users, per [docs/4626-connection-methods.md](../../docs/4626-connection-methods.md).

## Future changes checklist

When touching onboarding/waitlist logic, validate all of the following:

1. **Entry-point convergence**: website, Base, Zora, and Telegram must all end at the same verified-email account model.
2. **API validation**: only Privy-verified email may populate canonical account email.
3. **Workspace split**: signed-in `/waitlist` remains the default setup-first workspace; `/accounts` remains the advanced escape hatch.
4. **Wallet finalization**: canonical CSW resolution plus sub-account setup (CSW track) or external EOA connection (EOA track) must remain explicit post-auth steps. Do not regress to a single direct-owner-install model for user-initiated frontend execution — that is now only a server-side concept per `.cursor/rules/csw-agent-lifecycle.mdc`.
5. **Deploy/session coupling**: deploy/session flows must not regress to single-provider or wallet-first authentication prompts. Deploy-session continues to use direct owner delegation (server-side track) and is separate from user-initiated sub-account setup.
6. **Regression tests**: run waitlist, account bootstrap, and deploy-session auth tests.
