> ## Documentation Index
> Fetch the complete documentation index at: https://docs.base.org/llms.txt
> Use this file to discover all available pages before exploring further.

# Technical Guidelines

> Ensure your mini app is built for the Base app

## Complete Metadata

Metadata includes your Base Build app registration plus the homepage metadata returned by your chosen app URL. Complete, valid metadata is required for indexing, category placement, and high-quality embeds.

**Acceptance Criteria**

* The app URL homepage returns `200 OK`
* The homepage `<head>` includes `<meta name="base:app_id" ... />`
* The homepage `canonical` and `og:url` match the same app origin being registered
* Dashboard metadata fields, images, and text are complete and valid

**How to Implement**

* Register the correct app URL in Base Build
* Serve the app ID meta tag from the homepage head on that URL
* Implement [embed metadata](/mini-apps/core-concepts/embeds-and-previews#implementation)

<Note>
  Do not rely on `/.well-known/farcaster.json` for Base Build ownership. Validate the live app URL directly and verify it in <a href="https://base.dev/">base.dev</a>.
</Note>

## In-app Authentication

Users must remain in the Base app throughout the authentication flow. Eliminate flows that bounce users out of the Base app.

**Acceptance Criteria**

* No external redirects
* No email / phone verification
* Users can explore before sign‑in when possible

**How to Implement**

* Follow the [Authentication guide](/mini-apps/core-concepts/authentication)
* Prefer in‑app SIWF/Quick Auth or wallet auth;

## Client-Agnostic

There must be no client‑specific behaviors or wording that degrade the experience in the Base app. You must also ensure that you don't redirect the user to another client for functionality supported in the Base app.

**Acceptance criteria**

* Do not hardcode client‑specific URLs (e.g., Farcaster‑only links)
* Use neutral language in UI (e.g. use "Share to Feed" instead of "Share to Farcaster")
* Eliminate buttons that deeplink to other clients for features supported in the Base app

**How to Implement**

* Update all links according to the [Links](/mini-apps/technical-guides/links) guide
* Review the [Base App Compatability](/mini-apps/troubleshooting/base-app-compatibility) guide for functionality not supported in the Base app. All other functionality must keep users in the Base app.

## Sponsor Transactions

Sponsor transaction fees to remove friction and reduce drop‑off for new users. For mini apps on Base, we recommend using the [Base Paymaster](/onchainkit/paymaster/quickstart-guide).

**Acceptance criteria**

* Transactions are sponsored via a paymaster

**How to Implement**

* Recommended: [Base Paymaster](/onchainkit/paymaster/quickstart-guide)

<Note>
  Claim free gas credits on <a href="https://base.dev">base.dev</a>.
</Note>

## Batch Transactions (EIP-5792)

Batch sequential actions where applicable to minimize signatures and reduce friction. Use EIP‑5792 capabilities to send multiple calls in one request.

**Acceptance criteria**

* Where applicable, combine sequential actions into a single batch (e.g. approve + swap)

**How to Implement**

* See [Batch Transactions](/base-account/improve-ux/batch-transactions)
* Provider APIs: [`wallet_sendCalls`](/base-account/reference/core/provider-rpc-methods/wallet_sendCalls), [`wallet_getCapabilities`](/base-account/reference/core/provider-rpc-methods/wallet_getCapabilities)
