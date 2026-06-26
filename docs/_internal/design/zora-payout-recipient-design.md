# Zora creator-coin payout-recipient handoff at vault launch

**Terminology note (per AGENTS.md + canonical reference):**  
The on-chain field on Creator Coins is still named `payoutRecipient`. In all prose, comments, and docs it must be qualified as the `creatorCoinPayoutRecipient` (external earnings lane). See the canonical definition in [creatorvault-business-logic-core-structure-audit.md](./audits/creatorvault-business-logic-core-structure-audit.md).

Status: **reference architecture (already implemented)** · Author: computer · Date: 2026-05-05 · Updated: 2026-05-06
Related: [ACCOUNT_MODEL.md](./ACCOUNT_MODEL.md), [owner-mutation-decision-2026-05.md](./owner-mutation-decision-2026-05.md), [sub-accounts-baseapp-design.md](./sub-accounts-baseapp-design.md)

## Heads up: this is a reference doc, not a proposal

A previous version of this file specced building a new "set payout
recipient at vault launch" flow. **That flow already exists** as part of
the `/deploy` phase-2 batch. This file is retained because the design
rationale (why we don't use sub-accounts here, why we don't become a
permanent owner, how population coverage maps to outcomes) is still
useful documentation. But everything in §"What does work" below is a
description of code that is in production, not a TODO.

If you're looking for the canonical account model, read
[ACCOUNT_MODEL.md](./ACCOUNT_MODEL.md) first. The flow described here is
catalogued there as §5.1.

## Use case

When a user launches a 4626.fun vault on top of their Zora creator coin,
we need to call `setPayoutRecipient(newRecipient)` on the creator coin
contract (and `transferOwnership(<CreatorCoinPolicyController>)`
afterwards, so the protocol owns the policy going forward). Both
functions are gated to the creator coin's `owner()`, which is the user's
Zora Coinbase Smart Wallet.

So 4626.fun must produce a transaction where `msg.sender == userZoraCSW`
to two specific calls on the creator coin.

## Why sub-accounts don't work here

A sub-account on the Zora CSW would be a separate contract address.
Calls *from* the sub-account are `msg.sender == subAccount`, not
`msg.sender == zoraCSW`. The hierarchy is:

```
parentCSW ──owns──> subAccount   (parent can act on sub)
parentCSW <──── X ──── subAccount  (sub CANNOT impersonate parent)
```

Funds flow upward via Spend Permissions, but **execution authority does
not.** There is no analogous "execution permission" pattern in
Coinbase's Smart Wallet where a sub-account can make the parent be
`msg.sender` to an arbitrary call. Confirmed from the
[Coinbase Sub Accounts video](https://www.youtube.com/watch?v=xoLBvAB_05w):

> "the user's account has all of the funds and has the hierarchical
> ability to interact with the app account ... the sub wallet only has
> access to the spend permissions in the main wallet"

So a sub-account on the Zora CSW would let 4626.fun hold its own balance
and execute its own logic, but it cannot update fields where the parent
is the authorized signer.

## What does work (and is shipped)

### One-time signed UserOp from the user's existing owner at launch time

Cadence is **once at vault launch**, with the user present in a launch
flow they're already going through. One additional signature is barely
visible UX — and we get to bundle it into the same phase-2 UserOp that
deploys the rest of the stack, so it costs zero extra signatures.

Flow (as actually implemented in `frontend/src/pages/deploy/DeployVault.tsx`):

1. User reaches the vault deploy step in 4626.fun.
2. The page constructs the phase-2 batch. When the creator coin's
   current `payoutRecipient` differs from the deterministic
   `expectedPayoutRouter`, it appends a
   `setPayoutRecipient(expectedPayoutRouter)` call (line 4910–4914).
3. When the creator coin's current `owner()` differs from the
   deterministic `expectedCreatorCoinPolicyController`, it appends a
   `transferOwnership(...)` call (line 4915–4919).
4. **Pre-flight gate**: the page runs
   `publicClient.call({ ..., account: owner })` for both selectors. If
   either simulation reverts (i.e. the connected signer cannot
   authorize the call), deploy throws a clear `Cannot set CreatorCoin
   payout recipient ... from <owner>` error before any signature prompt
   (line 4946–4972 + 5707–5732).
5. The connected wallet (Privy embedded EOA, MetaMask, or a Zora-CSW
   EOA owner) signs the batched UserOp. Submission goes through the CDP
   bundler.
6. The paymaster (`frontend/api/_handlers/paymaster/_paymaster.ts:3285-3300`)
   validates that:
   - the new payout recipient equals `expectedPayoutRouter`
   - the new ownership target equals `expectedCreatorCoinPolicyController`
   - the operation is in `mode === 'deploy_phase2' || 'deploy_phase3'`
   Any other target / selector / mode is rejected.
7. Post-deploy, ownership lives on the
   [`CreatorCoinPolicyController`](../contracts/utilities/routers/CreatorCoinPolicyController.sol),
   which only allows `enforcePayoutRouter()` and a two-step ownership
   handoff. The user's CSW is no longer the coin's owner; the protocol
   policy contract is.

This is the same "Option C" pattern referenced in
[owner-mutation-decision-2026-05.md](./owner-mutation-decision-2026-05.md)
("March-9 lane"), but pointed at `setPayoutRecipient` /
`transferOwnership` on the creator coin instead of `addOwnerAddress` on
the CSW.

### Why not "4626.fun becomes a permanent owner of the Zora CSW"

Considered and rejected. Becoming a permanent owner of every user CSW
would let us call `setPayoutRecipient` autonomously without the user
signing each time. But:

- **Cadence is one-shot at launch.** The user is already there signing
  the deploy. The marginal UX cost of bundling these two calls into the
  same UserOp is zero; the marginal capability cost of permanent
  ownership is "we now hold an owner key on every user's wallet." Bad
  ratio.
- **Custody implications.** An owner key on user CSWs makes 4626.fun a
  partial custodian. ToS coverage, KMS, audit logging, revocation UX,
  probably an MSB conversation — none of that is needed for one
  signature at launch.
- **Operational risk.** A leaked or misused 4626.fun key affects every
  user who granted ownership.

That argument may flip if we ever need autonomous post-launch authority
(rebalancing, daily updates). Today, no.

## Population coverage

| Population (per [ACCOUNT_MODEL.md §2](./ACCOUNT_MODEL.md#2-user-populations)) | Outcome at deploy time |
|---|---|
| (a) Privy email-only | N/A — they don't have a Zora creator coin to launch from. |
| (b) Base App user (passkey-only parent CSW) | Fails the pre-flight `publicClient.call` simulation because the parent CSW's owner-mutating UserOps are blocked by Base App's session middleware. Deploy throws before any signature prompt. |
| (c) Zora CSW with EOA owner | **Works.** The connected EOA is a registered owner of the Zora CSW; the simulation succeeds; the batch signs cleanly. |
| (d) Zora CSW without EOA owner | Same as (b) — pre-flight simulation fails, deploy throws. The user must complete the ownership handoff inside Zora's own UI before retrying. |

## What actually remains

The only real gap is **user-facing copy for populations (b) and (d)**
when the pre-flight simulation fails. The current error message is
correct but generic; a dedicated UI surface would route them to the
right next step (Zora's UI for the payout-recipient update). That's a
copy + linkout PR, not a flow rebuild.

Everything else in this doc describes shipped code.

## Decision summary

| Question | Answer |
|---|---|
| Is this a sub-account flow? | No |
| Does 4626.fun become an owner of any user CSW? | No |
| How many user signatures at vault launch? | Zero extra — bundled into the existing phase-2 UserOp |
| Population covered today? | (a) N/A · (c) full · (b)+(d) blocked at pre-flight with a clear (but improvable) error |
| What's the only remaining work? | Copy + UI for the (b)/(d) pre-flight failure path |
