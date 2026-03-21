# Canonical CSW Sync (Historical Zora-Anchored) Design

> Historical note (2026-03-20): this design predates the email-first account-model reset. The current canonical account identity is the user's verified email. References below to a "canonical account" should now be read as "canonical execution wallet (CSW)." See [frontend/docs/account-auth-invariants.md](/home/akitav2/projects/4626/frontend/docs/account-auth-invariants.md).

## Problem

Users can have multiple EVM smart wallets connected (for example: a Zora-created Coinbase Smart Wallet and a Privy-created cross-app smart wallet). At the time this doc was written, the app enforced a canonical-wallet invariant:

- The canonical execution wallet was assumed to be the user's Zora-origin Coinbase Smart Wallet.
- Privy smart wallets are signer/owner identities only, not the canonical asset-holding account.

Today, we resolve the canonical CSW client-side (see `frontend/src/pages/AccountSettings.tsx`) by intersecting Zora-linked wallets with the locally-known smart wallets. Server-side wallet sync (`frontend/server/_lib/walletSync.ts`) does not perform that intersection, which can cause canonical drift and inconsistent behavior across Swap/Deploy/Account.

## Goals

- Canonical smart wallet selection is consistent across the app.
- Canonical smart wallet is anchored to Zora identity when possible.
- The resolved canonical is persisted server-side so client pages do not need bespoke heuristics.
- When Zora is unavailable, we keep the previously stored canonical (no drift).

## Non-goals

- Changing any URLs or frontend routes.
- Adding new UI for choosing canonical CSW (canonical is derived, not user-configured).
- Blocking authentication if Zora or DB is down (best-effort).

## Historical Decision: Zora Wins When Available

Policy for `syncUserWallets`:

1. Determine the set of candidate EVM smart wallets that are non-Privy.
2. If we can fetch a Zora profile (seeded by `profiles.preprov_zora_handle` when present, else a primary EOA address) and any Zora-linked wallet matches a candidate, choose that wallet as canonical.
3. If Zora inference fails or yields no match, keep the previously stored canonical when one exists.
4. Only when no canonical is stored yet, fall back to the existing Privy-based heuristic.

This ensures that once Zora gives us a confident canonical, we converge to it and persist it, while avoiding oscillation when Zora is unavailable.

## Persistence

- Persist canonical CSW into:
  - `profile_wallets.is_canonical_smart_wallet` (single true row per profile)
  - `profiles.primary_smart_wallet`, `profiles.csw_address`, `profiles.base_sub_account` (legacy columns)

## Error Handling

- Zora fetch failure does not block sync; it is treated as "no Zora signal".
- If `ZORA_SERVER_API_KEY` is missing, Zora inference is skipped.

## Test Plan (high-level)

- Unit test: when Zora returns a linked wallet that intersects with multiple smart-wallet candidates, `syncUserWallets` selects that wallet as canonical.
- Unit test: when Zora is unavailable (or returns no intersection), `syncUserWallets` keeps the persisted canonical even if Privy classification would pick a different candidate.
