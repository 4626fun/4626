# Account And Auth Invariants

> **Repo-wide canonical:** [docs/_internal/ACCOUNT_MODEL.md](../../docs/_internal/ACCOUNT_MODEL.md) folds the invariants in this file together with the user-population taxonomy, schema, and existing-flows inventory. This file remains the authoritative source for the *invariants themselves* (ACCOUNT_MODEL.md cites these verbatim); for end-to-end account-model decisions consult ACCOUNT_MODEL.md.

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

Canonical architecture reference: `docs/_internal/4626-connection-methods.md`. Canonical wallet invariants: `.cursor/rules/ERC-4337-Wallet-Invariants.mdc`. Server-side delegation mechanics: `.cursor/rules/csw-agent-lifecycle.mdc`.

Shared prerequisites (apply to every connection method):

1. authenticate / create account through Privy
2. verify email OTP
3. create or resolve the Privy embedded EOA
4. resolve or create the canonical Coinbase Smart Wallet (or an external EOA; Telegram users defer wallet setup to the browser handoff)

How the account becomes execution-ready then depends on the track — user-initiated frontend transactions and server-side automation use different paths, and must not be conflated.

### User-initiated frontend execution (CSW path, `executionMode === 'canonical'`)

This is the path used for swaps, vault interactions, and other user-triggered writes submitted from `app.4626.fun`.

After the shared prerequisites above:

5. install the Privy embedded EOA as a direct owner on the parent CSW via `addOwnerAddress` (the `legacy-owner-install` path; surfaced as "Enable 4626 signing" in the waitlist/account-setup UI)
6. verify on-chain that the embedded EOA is an owner of the parent CSW (`resolveEmbeddedOwnerOnCanonicalCsw`)

Rules:

- the ERC-4337 `sender` / `msg.sender` for user-initiated frontend writes is the **parent CSW** (`profiles.csw_address`), not a sub-account
- sponsored swaps use `canonical4337` with the parent CSW as sender and the Privy embedded EOA as signer
- the Privy embedded EOA **is** installed as a direct owner on the parent CSW on this track (`legacy-owner-install`)
- if the user does not yet have a CSW, route them to Base app with the referral flow, then resume embedded-owner signing setup for the canonical parent CSW when they return
- do not treat wallet setup as complete until the embedded EOA is confirmed as an on-chain owner of the parent CSW
- features that require canonical execution stay gated until `canonicalSignerGate.ready` (embedded EOA detected, canSign, and `ownerCheckStatus === 'owner'`)
- after verified email, the default web setup surface is `/waitlist`; `/accounts` is reserved for advanced settings, recovery, and secondary identity controls
- **Flag-gated sub-account lane:** when `WAITLIST_SUBACCOUNT_FLOW_ENABLED=1` and a distinct `profiles.base_sub_account` is registered, swaps may route through the sub-account via `wallet_sendCalls`. This is a swap-only fallback, not the deploy default. The sub-account's `setToOwnerAccount()` path is the alternative, not the primary track.

### User-initiated frontend execution (external EOA path, `executionMode === 'eoa'`)

For users connecting with MetaMask / Rabby / WalletConnect:

- no sub-account (EOAs are not smart contract wallets)
- `msg.sender` is the user's EOA directly; `sendTransaction` is used
- the Privy embedded EOA still exists but is unused for transaction signing on this track

### Server-side automation (agent, ERC-8004 identity, deploy-session)

Server-side automation is unchanged and uses direct owner delegation on the parent CSW:

- ERC-4337 `sender` is the parent CSW
- the delegated owner is a Privy **server** wallet (not the user's embedded EOA), added via `addOwnerAddress`
- the fallback ladder, `/api/wallet/confirm-owner` semantics, and approval telemetry below apply to this track
- full mechanics in `.cursor/rules/csw-agent-lifecycle.mdc`

### Server-side owner-install runtime policy

For server-side canonical self-auth approval (connected signer equals canonical CSW), the
runtime fallback ladder is fixed:

1. sponsored UserOp with typed-data signing
2. sponsored UserOp without typed-data signing
3. `wallet_sendCalls` fallback (with capability payload retry compatibility)

Do not reorder this sequence without a deliberate product/runtime decision.

### Server-side owner confirmation semantics

Owner-install completion on the server-side track is evaluated by `/api/wallet/confirm-owner` using both:

- onchain owner check result
- tx lifecycle classification across configured Base RPCs

`confirmationState` must be interpreted as:

- `owner_confirmed`: owner installed (terminal success)
- `pending_tx`: tx not yet confirmed (retry/backoff state)
- `owner_not_found_yet`: tx/indexing lag state (retry/backoff state)
- `tx_failed`: tx reverted/failed (terminal failure)

Server-side features requiring canonical execution remain gated until `owner_confirmed`.

This endpoint is not part of the user-initiated frontend track — user-initiated frontend readiness is determined by parent CSW + embedded EOA owner confirmation (`legacy-owner-install`), not by `/api/wallet/confirm-owner`.

### Server-side owner-approval observability

Server-side owner approval emits run-scoped stage telemetry with `approvalRunId` across:

- account setup controller orchestration (`preflight`, `prepare`)
- onboarding execution lanes (`userop_typed`, `userop_nontyped`, `send_calls`, `confirm_owner`)
- ERC-4337 helper lane telemetry enrichment

This telemetry is required for production diagnosis of the server-side track and should be preserved when refactoring account setup or wallet execution paths.

### Related docs

- User-initiated and server-side architecture overview: `docs/_internal/4626-connection-methods.md`
- Owner-install reference methods runbook (legacy/server lanes and current relay path): `docs/_internal/operations/wallet/owner-install-reference-methods.md`
- User-initiated troubleshooting: `docs/_internal/troubleshooting/activate-account-signing.md`

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

- `docs/_internal/operations/operations/messaging/telegram-canonical-link-preservation.md`
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
- Multiple `useEffect`s are acceptable when they are keyed by explicit machine
  state and guarded against re-entry.
- Async Telegram route/bootstrap helpers may admit the flow, but they must not
  mutate machine state mid-session.

### Verification Semantics

- Email is not considered verified until:
  1. OTP is valid AND
  2. the active Privy session resolves to the same verified email AND
  3. the Telegram readiness check succeeds

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

1. `frontend/src/pages/telegram/TelegramLink.tsx` admits the user into an isolated
   Telegram route and starts the reducer in
   `frontend/src/features/telegram-link/telegramLinkFlow.ts`.
2. `frontend/src/lib/telegramWebApp.ts` exchanges Telegram `initData` for a
   short-lived backend `sessionToken` through
   `POST /api/telegram/miniapp/session`.
3. Email OTP runs inline through Privy `useLoginWithEmail()`.
4. The flow enters explicit `wait_for_privy_sync` and does not proceed until
   `POST /api/telegram/link/ready` resolves the verified email to the active
   Privy-backed 4626 account.
5. If needed, the frontend links Telegram to the active Privy user through
   `useLinkAccount().linkTelegram(...)`.
6. The frontend calls `POST /api/telegram/link/complete`, which re-validates
   the Telegram Mini App session, syncs account/wallet identity, optionally
   claims and consumes the single-use link token, and persists
   `telegram_user_links`.
7. Canonical CSW setup remains a separate concern from Telegram linkage; the
   link may complete before CSW setup is finished, but execution-gated features
   stay blocked until canonical owner confirmation succeeds.

## Simplification Guidance

There is no safer shortcut than the current semantic order above.

The main acceptable optimization is structural:

- reduce route/provider complexity around `/telegram/link`
- keep one authoritative reducer/state machine
- keep `wait_for_privy_sync` explicit even if the readiness transport changes
- preserve query/stored Telegram link context until Mini App proof capture

The following are not acceptable optimizations:

- replacing inline OTP with Privy modal/popup auth
- binding Telegram before verified-email account resolution
- removing Mini App session verification
- removing single-use token claim/consume semantics
