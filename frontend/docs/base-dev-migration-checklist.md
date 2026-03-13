# Base.dev Migration Checklist (Path A)

This checklist covers the remaining operational steps after removing miniapp runtime/auth/manifest/webhook code.

## 1) Base.dev app metadata

- Confirm the app is registered in Base.dev.
- Set **Primary URL** to the production web app URL (`https://app.4626.fun`).
- Verify icon, tagline, description, and screenshots in Base.dev match current brand assets.
- Ensure no workflow depends on `/.well-known/farcaster.json` for Base App metadata.

## 2) Distribution and links

- Confirm all public links in docs and campaign surfaces point to the web app URL.
- Keep optional Farcaster distribution surfaces only where intentionally supported (for example mention tooling), without miniapp host assumptions.

## 3) Notifications migration follow-up

Implement a wallet-address notification abstraction before wiring Base.dev Notifications:

- Add an internal transport interface (for example `NotificationTransport.send({ walletAddress, title, body, deeplink })`).
- Keep existing callers transport-agnostic (no Farcaster token/FID assumptions).
- Implement Base.dev transport behind the interface when API credentials and docs are finalized.
- Add idempotency key support and audit logs for sends.
- Add allow/deny controls per wallet and environment (dev/staging/prod).

## 4) Verification gates after Base.dev cutover

- Send a test notification to an allowlisted wallet on staging.
- Confirm delivery reporting and failure logging are visible in server logs.
- Smoke-check the app in Base App browser: wallet connect, SIWE session, deploy flow, admin routes.

## 5) Rollback note

If Base.dev notification transport is not ready at launch time, keep notification sending disabled by default rather than reintroducing miniapp token paths.
