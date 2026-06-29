---
title: Zora auth (short)
sidebar_label: ca7317af…
sidebar_position: 99
hide_table_of_contents: true
last_updated: '2026-06-28'
audience:
  - developers
  - protocols
stage: use
owner: docs-team
last_reviewed: '2026-06-28'
status: current
---
<div class="audit-transcript-meta">
[← Source sessions](/audits/fable/key-sessions) · [Transcript archive](/audits/fable/transcripts) · [Executive summary](/audits/fable/findings-summary)
</div>
# Zora auth (short)
| Field | Value |
| --- | --- |
| Session ID | `ca7317af-9c86-4fde-a453-5b3c220ff600` |
| Review model | Cursor Fable 5 (`claude-fable-5-thinking-high`) |
:::note Appendix record
Readable export of an agent-assisted review session. Tool outputs and system context blocks are omitted; download the [JSONL archive](/audits/fable-chats-4626-2026-06.zip) for the complete log.
:::
## User

<timestamp>Friday, Jun 12, 2026, 12:28 AM (UTC-7)</timestamp>
Authentication failed
There was an issue connecting your Zora account. Please try again.

## Assistant

The user is seeing a Zora account connection failure. Let me find where that error message comes from in the codebase.

 The user's hitting an authentication error when trying to link their Zora account through the app. I need to track down where this error message is generated in the codebase to understand what's causing the connection failure.

*Tools invoked:* Grep, Grep

## Assistant

*Tools invoked:* Read

## Assistant

This looks like a Privy integration issue with Zora's cross-app authentication. The generic error message suggests the user is encountering this in real-time, so I need to trace where `performZoraCrossAppAuth` is being called and check the related `siweAuthCrossApp` logic. I should also investigate common culprits like an outdated Privy client ID, misconfigured allowed origins, or issues with the dev server setup.

Since the user is running the dev server on port 5174 with `pnpm -C frontend run dev:deploy-dry-run`, I need to verify the Privy configuration is correct for that environment. The key issue is likely either a stale `VITE_PRIVY_CLIENT_ID` that needs a dev server restart, or a mismatch with Privy's custom auth domain at privy.4626.fun and its allowed origins. Let me trace the callers of that auth function and check the Zora app ID configuration.I'm checking the callers and your dev server to determine which environment you're hitting in the Privy cross-app Zora linking lane.

*Tools invoked:* Grep, Read

## Assistant

The error is Privy's generic cross-app failure copy from the Zora linking flow. Let me look at how the account-setup controller invokes it and what configuration it depends on.

 The user's hitting a Zora cross-app auth error on their localhost dev server, and it's coming from Privy's cross-app flow. I need to trace where they're clicking "connect Zora" in the UI and then check how `useAccountSetupController.ts` invokes `performZoraCrossAppAuth`, paying attention to what configuration like app ID, allowed origins, and client ID might be misconfigured.

*Tools invoked:* Grep, Grep

## Assistant

Let me look at the Privy app ID config, the redirect sanitizer, and the rest of the error-handling branch.

 Looking at the error message the user shared, it's coming from Privy's generic authentication failure copy when the cross-app account linking fails. The code already has recovery logic in place—if it detects a recoverable error, it tries an alternative path, and in the catch handlers it rechecks the Zora resolution endpoint before showing the error to the user. So the user encountered this after those fallback attempts were exhausted.

The most likely culprits are Privy's allowed origins configuration—if localhost:5174 (where they're running the dev server) isn't registered in the Privy app's allowed domains, the OAuth redirect will fail. Other possibilities include a stale or mismatched `VITE_PRIVY_CLIENT_ID` in the running dev server, popup blockers interfering with the cross-app modal, or third-party cookie restrictions breaking the flow. I should check the Zora Privy app ID and trace through the redirect URL sanitization logic to see what's being passed.

*Tools invoked:* Read, Read

## Assistant

*Tools invoked:* Grep, Grep

## Assistant

I'm tracing through where the user encountered this error—they likely clicked "Connect Zora" on the waitlist or account setup page, either locally or in production. The error message they're seeing maps to our authentication failure handler, which displays specific copy about the Zora connection issue.

This is happening inside Privy's cross-app OAuth popup flow, and the most likely culprits are popup blocking, third-party cookie restrictions, the user denying consent on Zora's side, or the localhost dev server origin not being allowlisted in our Privy app configuration. There's also a possibility of a stale `VITE_PRIVY_CLIENT_ID` in the running dev server, or the Zora Privy app rejecting our requester app. I need to understand what environment they're running in and whether there's existing documentation on this issue before diving deeper.

Since they're probably testing locally on the deploy-dry-run server at 5174, I should check if the `.env.deploy-dry-run.local` file has the right Privy configuration and whether the loopback session marker shim is working correctly. Let me look for any existing docs on Zora cross-app failures and examine the environment setup.I'm checking for known runbooks and the localhost Privy session shim to debug this cross-app OAuth failure on the deploy-dry-run port.

*Tools invoked:* Grep, Grep

## Assistant

*Tools invoked:* Grep

## Assistant

Let me check the local Privy env configuration since the dev server is running on the deploy-dry-run port.

 Looking at the Privy error the user shared, this appears to be an OAuth authentication failure happening in the cross-app modal when trying to connect to Zora's Privy instance. The most likely culprit is that the origin (whether it's localhost:5174 or a production domain) isn't whitelisted in the Privy app configuration.

Beyond that, I should consider popup blockers or third-party storage restrictions that might be interfering with the cross-app OAuth flow, a stale Privy client ID requiring a dev server restart, or possibly a transient outage on Privy or Zora's end. The code already has fallback logic in place for link-to-login and redirect handling, so the issue is probably environmental rather than a code defect.

I should check the frontend environment variables to see if the Privy client ID is configured and whether 5174 is the port being used locally, then provide the user with targeted remediation steps depending on whether they're testing locally or in production.

*Tools invoked:* Shell, Read

## Assistant

Here's what that error is and what to do about it. The copy "Authentication failed / There was an issue connecting your Zora account" is **Privy's own generic failure message** from the cross-app OAuth handshake — it fires when `linkCrossAppAccount` / `loginWithCrossAppAccount({ appId: ZORA_PRIVY_APP_ID })` can't complete the round trip to Zora's Privy app. It is not a 4626 server error, and our code already treats it as recoverable: `performZoraCrossAppAuth` retries on the companion lane (link ↔ login), and `useAccountSetupController.onLinkZora` re-checks `/api/zora/resolve` afterward — if your Zora signals (handle / canonical CSW / creator coin) already resolve, the link completes without cross-app auth at all, and otherwise it redirects to the Zora handoff page.

The fix depends on where you hit it:

**If this is on localhost (your deploy-dry-run server on `:5174` is running):** cross-app auth is structurally fragile there. The Privy app uses the custom auth domain `privy.4626.fun`, which puts the SDK in server-cookie mode; on loopback the third-party cookies that the cross-app OAuth round trip needs are blocked (the `loopbackSessionMarkerShim` only patches the session marker, not cross-app flows). Two things to check:

1. `localhost:5174` must be in the Privy dashboard's allowed domains/origins for the **Local Dev** client — and the running dev server must have the matching `VITE_PRIVY_CLIENT_ID`. If you've touched Privy env recently, restart the dev server; a stale client ID surfaces exactly as generic auth failures.
2. Even with that, expect localhost cross-app to be flaky. The reliable path locally is the one the controller falls back to anyway: **"Already linked? Refresh signals"** (which hits `/api/zora/resolve` server-side and needs no popup), or test the full link on `app.4626.fun`.

**If this is on production:** the usual culprits are, in order of likelihood:

1. **Popup / third-party storage blocked** — the cross-app flow opens a popup to Zora's Privy auth. Brave shields, Safari "Prevent cross-site tracking", incognito, or in-app browsers (Base App webview) commonly kill it. Retry in a normal Chrome/Firefox tab with popups allowed.
2. **Stale Zora session** — open [zora.co](https://zora.co) in the same browser, make sure you're signed in there, then retry Connect Zora. (This is why the final fallback copy says exactly that.)
3. **Transient Privy/Zora outage** — the message is literally Privy's "try again" copy; a second attempt often just works because of the dual-lane fallback.

One more practical note: if your account already has Zora signals detected (the controller checks this first), the Connect button short-circuits with "Cross-app login was not needed" — so seeing this error means the resolve check came back empty for your session too. If you tell me which host/browser you hit it on (and whether a popup appeared at all), I can dig into the specific lane — but nothing in the local logs shows a server-side failure; the dev terminal is clean.

 The user hit Privy's generic cross-app failure modal, which means the OAuth handoff to Zora's Privy app failed during `linkCrossAppAccount` or `loginWithCrossAppAccount`. I need to figure out whether this happened on localhost:5174 (the deploy-dry-run environment currently running) or in production. The error is coming from Privy's own code when the cross-app account linking fails, and our implementation already has some resilience built in.

On localhost, cross-app auth is especially fragile because it relies on third-party cookies and the auth domain (privy.4626.fun) to complete the OAuth round trip—plain HTTP loopback environments have known limitations here. The most likely scenario is local testing, so I should diagnose whether it's a stale `VITE_PRIVY_CLIENT_ID`, a web origin allowlisting issue, or an upstream rejection from Zora's Privy app. I can check whether Zora's Privy app is refusing our requester app outright.

But I'm also noticing the workspace fact says the cross-app connect handshake works but transact is refused—yet the link flow uses the connect handshake, so it should normally work. The ambiguity here is whether they're hitting this locally or in production, which changes the fix. I should give both scenarios: what the error means, the built-in fallbacks (login retry, `/api/zora/resolve` re-check, Zora handoff redirect), and the env-specific causes. Also, if their Zora signals already resolve, the "Refresh Zora signals" button short-circuits the cross-app auth entirely, so that's a practical workaround to mention.

