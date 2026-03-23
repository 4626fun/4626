# Base Build Migration Checklist (Path A)

This checklist covers the remaining operational steps after removing the old Farcaster manifest dependency and moving Base Build verification to the app homepage.

## 1) Base Build app URL and metadata

- Confirm the app is registered in Base Build / Base.dev.
- Set **App URL** to the production web app URL (`https://app.4626.fun`).
- Do not use `https://4626.fun` as the Base Build URL. That host remains marketing/waitlist.
- Verify icon, tagline, description, and screenshots in Base Build match current brand assets.
- Ensure no workflow depends on `/.well-known/farcaster.json` for Base Build metadata.
- Ensure the app homepage `<head>` includes:

```html
<meta name="base:app_id" content="695a49dc4d3a403912ed8ca5" />
```

- Ensure the app homepage also declares the app origin:
  - `canonical` = `https://app.4626.fun/`
  - `og:url` = `https://app.4626.fun/`

Implementation lives in:

- `frontend/app.html`
- `frontend/vite.config.ts`
- `frontend/vercel.json`

Quick production check:

```bash
curl -sL https://app.4626.fun | sed -n '1,30p'
```

## 2) Distribution and links

- Confirm all public links in docs and campaign surfaces point to the web app URL.
- Remove any remaining Farcaster-specific distribution assumptions from user-facing surfaces.

## 3) Notifications migration follow-up

Implement a wallet-address notification abstraction before wiring Base.dev Notifications:

- Add an internal transport interface (for example `NotificationTransport.send({ walletAddress, title, body, deeplink })`).
- Keep existing callers transport-agnostic (no Farcaster token/FID assumptions).
- Implement Base.dev transport behind the interface when API credentials and docs are finalized.
- Add idempotency key support and audit logs for sends.
- Add allow/deny controls per wallet and environment (dev/staging/prod).

## 4) Verification gates after Base Build cutover

- Confirm `https://app.4626.fun/` returns the app shell instead of the marketing shell.
- Confirm the app shell exposes the `base:app_id` meta tag plus app-origin `canonical` and `og:url`.
- Send a test notification to an allowlisted wallet on staging.
- Confirm delivery reporting and failure logging are visible in server logs.
- Smoke-check the app in Base App browser: wallet connect, SIWE session, deploy flow, admin routes.

## 5) Rollback note

If the Base Build notification transport is not ready at launch time, keep notification sending disabled by default rather than reintroducing manifest-era or Farcaster-specific token paths.
