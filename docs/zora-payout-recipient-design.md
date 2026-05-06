# Zora creator coin payout recipient update at vault launch

Status: **proposed** · Author: computer · Date: 2026-05-05
Related: [sub-accounts-baseapp-design.md](./sub-accounts-baseapp-design.md), [owner-mutation-decision-2026-05.md](./owner-mutation-decision-2026-05.md)

## Use case

When a user launches a 4626.fun vault on top of their Zora creator coin, we need to call `setPayoutRecipient(newRecipient)` on the creator coin contract. That function is gated to the creator coin's `owner()`, which is the user's Zora Coinbase Smart Wallet.

So 4626.fun must produce a transaction where `msg.sender == userZoraCSW` to a specific call on the creator coin.

## Why sub-accounts don't work here

A sub-account on the Zora CSW would be a separate contract address. Calls *from* the sub-account are `msg.sender == subAccount`, not `msg.sender == zoraCSW`. The hierarchy is:

```
parentCSW ──owns──> subAccount   (parent can act on sub)
parentCSW <──── X ──── subAccount  (sub CANNOT impersonate parent)
```

Funds flow upward via Spend Permissions, but **execution authority does not**. There is no analogous "execution permission" pattern in Coinbase's Smart Wallet where a sub-account can make the parent be `msg.sender` to an arbitrary call. Confirmed from the [Coinbase Sub Accounts video](https://www.youtube.com/watch?v=xoLBvAB_05w):
> "the user's account has all of the funds and has the hierarchical ability to interact with the app account ... the sub wallet only has access to the spend permissions in the main wallet"

So a sub-account on the Zora CSW would let 4626.fun hold its own balance and execute its own logic, but it cannot update fields where the parent is the authorized signer.

## What does work

### Option C (chosen): one-time signed UserOp from the user's existing owner at launch time

Cadence is **once at vault launch**, with the user present in a launch flow they're already going through. One additional signature is barely visible UX.

Flow:

1. User reaches the "Launch vault" step in the 4626.fun UI.
2. We construct a `executeBatch([{ target: creatorCoin, value: 0, data: setPayoutRecipient(newRecipient) }])` call against the user's Zora CSW.
3. The user's connected wallet (Privy, MetaMask, or whatever exposes one of the existing EOA owners of the Zora CSW) signs a UserOp authorizing it.
4. The UserOp is submitted via the CDP bundler.
5. On success, we mark the vault as launched and proceed to the user-facing confirmation.

This is exactly the March-9 lane pattern shipped in PR #523, but pointed at a different inner call (`setPayoutRecipient` instead of `addOwnerAddress`) and a different target (the creator coin contract instead of the Zora CSW itself).

### Why not Option B (4626.fun becomes a permanent owner of the Zora CSW)

Considered and rejected for this use case. Option B would let us call `setPayoutRecipient` autonomously without the user signing each time. But:

- **Cadence is one-shot at launch.** The user is already there signing. The marginal UX cost of Option C is one signature; the marginal capability cost of Option B is "we now hold an owner key on every user's wallet." Bad ratio.
- **Custody implications.** An owner key on user CSWs makes 4626.fun a partial custodian. Every additional capability we'd grant ourselves needs ToS coverage, KMS, audit logging, revocation UX, and probably a registered MSB conversation. None of that is needed for one signature at launch.
- **Operational risk.** A leaked or misused 4626.fun key affects every user who granted ownership.

Option B remains viable if we ever need autonomous post-launch authority (rebalancing, daily updates). Reconsider then.

## Population coverage

Zora CSWs come in two shapes:

1. **Has at least one EOA owner the user controls** — Option C works directly. They sign with that EOA.
2. **Only has Coinbase-managed signers (passkeys, no user EOA)** — Option C's signature step has nowhere to go because Base App's session middleware blocks owner-mutating UserOps from third-party dapps (per [owner-mutation-decision-2026-05.md](./owner-mutation-decision-2026-05.md)).

For population (2), the user would need to do the payout-recipient update from inside Base App / Zora's own UI, where the wallet client allows owner-authorized calls without session-key restrictions. We surface a clear instruction for that population rather than failing silently.

**TODO:** Pull from Supabase the ratio of Zora CSWs in our mapping that fall into population (1) vs. (2). The design changes meaningfully if (2) is more than ~20% of users.

## Implementation notes

This is **not a sub-account flow.** It's a single signed call. Most of the infrastructure already exists in the repo:

- The bundler submission path: `frontend/src/lib/aa/coinbaseErc4337.ts` (`sendCoinbaseSmartWalletUserOperation`).
- The owner-detection logic: existing `isOwnerAddress` reads.
- The `executeBatch` ABI helpers: in the page probe, will lift to a shared module.

What's new:

- A small UI surface inside the vault launch flow that:
  1. Detects the user's Zora CSW from the profile.
  2. Confirms the connected wallet is one of its EOA owners (read `isOwnerAddress`).
  3. If yes: shows the `setPayoutRecipient(<vault address>)` action and signs.
  4. If no: shows the population (2) fallback copy directing the user to update payout recipient inside Zora's UI.
- An ABI for the Zora creator coin's `setPayoutRecipient` function. Lift from Zora's published creator coin contract.

## Out of scope for v1

- Population (2) automation. Manual hand-off in the launch flow with clear copy.
- Re-running `setPayoutRecipient` after launch (e.g., if vault address changes). v1 is one-shot at launch.
- Bundling `setPayoutRecipient` with the vault deployment in a single UserOp. Could be a follow-up optimization once the basic flow ships.

## Decision summary

| Question | Answer |
|---|---|
| Is this a sub-account flow? | No |
| Does 4626.fun become an owner of any user CSW? | No |
| How many user signatures at vault launch? | One (or zero if it can be bundled with the deploy) |
| Population covered by v1? | Zora CSWs with at least one user-controlled EOA owner |
| Population deferred? | Zora CSWs with only Coinbase-managed signers (Base App session-middleware block) |
