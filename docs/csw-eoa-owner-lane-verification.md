# CSW EOA-owner submission lane: end-to-end verification

> **Canonical reference:** [docs/ACCOUNT_MODEL.md](./ACCOUNT_MODEL.md). This lane is the production path for population (c) (Zora CSW with an EOA owner) — see ACCOUNT_MODEL.md §2 and §5.1.

**Status:** active runbook
**Audience:** anyone with control of a CSW on-chain EOA owner private key who
wants to confirm `_submitOwnerViaPreparedCallsWithEoaOwner` actually works in
their environment.

This doc is meant to be followed top-to-bottom. Every step has an expected
outcome and a troubleshooting note.

## What this lane does (one paragraph)

Bypasses the Base App popup by asking a wagmi-connected EOA wallet — whose
address is already in the CSW's on-chain owner array — to sign the userOpHash
directly. The bundler's `validateUserOp` path runs `ecrecover(userOpHash, sig)`
with no `replaySafeHash` wrap (`CoinbaseSmartWallet.sol:191`), so the lane signs
the raw hash and wraps it as `SignatureWrapper(ownerIndex, sig)` for the bundler
to route through `ecrecover`. The signature is recovered locally before
submission; if recovery does not land on the connected EOA, the lane fails fast
with a clear message instead of a `-32507` bundler revert.

## 1. Prerequisites

- A wagmi-compatible wallet that exposes `personal_sign`. Tested with
  MetaMask, Rabby, WalletConnect-mediated wallets, Privy embedded wallets.
- Control of one of the **on-chain EOA owner private keys** for the CSW you
  are testing. For the canonical CSW
  `0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef` on Base, eligible owners are:
  - `0x5E1a0AFa913aD95aA3762b18Ea9AdD73d31313cf`
  - `0xCf8D17Ce01B73637ef936fe7c47bA7100b820142`
- A live preview of the app with the dev probe accessible at
  `app.4626.fun/dev/csw-signature-probe`.
- Optional but recommended: a separate Coinbase / Base App session connected
  in the same browser. The lane's `cswRequest` transport prefers a
  Coinbase-like connector for the `wallet_prepareCalls` /
  `wallet_sendPreparedCalls` RPCs (these are Coinbase-only RPCs and arbitrary
  wallets will return *method not supported*). If only the EOA wallet is
  connected and it does not implement those RPCs, the lane will fail-fast on
  `wallet_prepareCalls` with that exact error, surfacing the missing-Coinbase-provider
  state.

## 2. Connect the EOA owner

1. Disconnect Base App from the app (clear any active CSW session).
2. Open the chosen wagmi wallet (MetaMask / Rabby / etc.) on Base mainnet.
3. Connect to the app via that wallet. The wagmi `useAccount().address`
   should match exactly one of the on-chain EOA owner addresses listed above.
4. Open `/dev/csw-signature-probe`, paste the CSW into the address field, and
   click *load owner slots*.
5. Click *snapshot wallet session*. Expected:
   - `warningState: green` with message *"Provider is operating on the CSW
     directly"* — *only if* `eth_accounts[0]` happens to equal the CSW
     (uncommon for EOA wallets; typical only when a Coinbase session is
     active for the same CSW).
   - More commonly, `warningState: amber` with `eth_accounts[0]` equal to
     **your EOA owner address** (not the CSW). For the EOA-owner lane that
     is the correct state — the wallet is operating on the EOA, not the CSW.
     The amber message wording is targeted at the Base App sub-account case
     and slightly mis-reads in this scenario; what matters is that
     `eth_accounts[0]` matches the on-chain owner address. (Future polish:
     differentiate "matches an on-chain EOA owner" from "matches a
     sub-account substitution".)

If `eth_accounts[0]` does not match an on-chain owner, you have connected the
wrong wallet — check the wagmi `useAccount().address` and reconnect.

## 3. Run the EOA-owner submission lane

The submission lane is wired into `useAccountSetupController.ts` as
`submitOwnerInstallViaOnchainEoa`. The button surface lives in the account-setup
view (`frontend/src/features/accountSetup/AccountSetupWorkspaceView.tsx`); the
controller exposes:

- `onchainEoaOwnerCandidates` — every EOA owner from `cswOwnersState.owners`
- `connectedOnchainEoaOwner` — the candidate whose address matches the
  current wagmi account, or `null` if none match
- `submitOwnerInstallViaOnchainEoa(txRequest)` — runs the lane

When `connectedOnchainEoaOwner` is non-null, the UI exposes the *Sign with
on-chain EOA owner* path. Click it. The lane resolves two transports:

- **`signerRequest`** — the wagmi connection whose accounts include the
  on-chain EOA owner. This is the only key that can produce a valid
  `personal_sign` over the userOpHash.
- **`cswRequest`** — a Coinbase / Base App connector that handles
  `wallet_prepareCalls` / `wallet_sendPreparedCalls`. If the EOA connector is
  itself Coinbase-like (rare), reused. Otherwise the controller scans
  `wagmiConnections` for any connector whose id matches `coinbaseWalletSDK`
  / `base-account` / contains *coinbase*, and uses it for `cswRequest`.

Then it calls `_submitOwnerViaPreparedCallsWithEoaOwner` with the resolved
transports, the on-chain owner address and index, the prepared transaction
target, and `executionMode: 'canonicalSmartWallet'`. The expected event log
sequence (subscribe via `onStageEvent` or watch the prepared-calls events panel
on the probe page if you adapt it):

```
prepare_calls:start    executionMode=canonicalSmartWallet signer=<EOA> csw=<CSW>
prepare_calls:done     hashToSign=<userOpHash>
personal_sign:start    address=<EOA>
personal_sign:done     sigBytes=65
send_prepared_calls:start  ownerIndex=<N>
send_prepared_calls:done   txHash=<0x…>
```

(Stage names mirror the existing `OwnerApprovalStageEvent` taxonomy in
`onboardingWallet.ts`. If a stage is missing in your run, that is where the
failure occurred.)

## 4. Expected outcomes

- **Probe verdict turns green** when you re-run *probe personal_sign* with the
  EOA wallet connected: *"Wallet key matches owner[1]"* or *"matches owner[2]"*,
  recovery row `recoveredDirect(userOpHash)` lands on the connected EOA address.
- **Submitter guard does not throw.** Either `ok` (recovered === parsed owner)
  or `skipped_code_bearing` if the parsed slot is a passkey (it should not be —
  EOA owners decode to 20-byte addresses).
- **Bundler accepts the userOp.** `wallet_sendPreparedCalls` returns a
  `callsId`; the subsequent `wallet_getCallsStatus` poll returns a 200-class
  status with a real `transactionHash`.
- **On-chain owner array is unchanged.** This lane does *not* add owners — it
  uses an existing owner. Run `ownerCount` / `ownerAtIndex(N)` after the
  receipt and confirm equality with the pre-submission snapshot, unless your
  prepared transaction was itself an `addOwnerAddress` call.

## 5. Troubleshooting

**`wallet_prepareCalls` fails with *method not supported*.**
The EOA connector does not implement Coinbase's `wallet_prepareCalls` RPC. Two
fixes: keep a Coinbase / Base App session connected in parallel (the lane will
auto-prefer it as `cswRequest`); or implement a server-side prepare endpoint
that proxies to the Coinbase RPC and adapt the lane to use that as `cswRequest`.

**Recovery does not land on the connected EOA.**
The lane will throw *"EOA-owner signature recovered to 0x…, not the expected
on-chain owner 0x…. The connected wallet may be signing with a substituted key.
Connect 0x… directly and retry."* This means the wagmi connector you selected
is itself substituting a key (e.g. an embedded wallet that derives a different
key per session). Inspect `wagmi useConnections()` — log which connection ended
up matching `connectedOnchainEoaOwner` and verify it is the connector you
expect. The probe verdict block on `/dev/csw-signature-probe` will help: with
the suspect connector active, run *probe personal_sign* and check the
`recoveredDirect(userOpHash)` row.

**Wagmi connector signs with EIP-191 instead of raw.**
Some connectors prepend the EIP-191 message prefix even when given a 32-byte
hex hash. The dual-recovery guard in `_submitOwnerViaPreparedCallsWithEoaOwner`
recovers against both `userOpHash` and `EIP-191(userOpHash)` when checking
match-against-owner. Verify the green verdict still fires at the probe;
recovery row `recoveredDirect(userOpHash)` may be `null` while
`recoveredPrefixed(EIP191(userOpHash))` lands on the EOA. The bundler runs
plain `ecrecover(userOpHash, sig)` though — if your wallet *only* supports
EIP-191, the bundler will reject. Switch to a wallet that supports raw hex
signing (Rabby, MetaMask with `personal_sign`-as-raw-hash, Privy embedded).

**Verdict stays red even with the EOA wallet connected.**
You are probably looking at the wrong wagmi connection. The controller picks
`signerConnection` via:

```ts
wagmiConnections.find((conn) =>
  conn.accounts.some((acct) =>
    String(acct).toLowerCase() === connectedOnchainEoaOwner.ownerAddress.toLowerCase(),
  ),
)
```

Log `wagmiConnections` and check that exactly one connection's `accounts`
contains the owner address, lowercased. If multiple connections include the
same address, the first match wins; reorder by disconnecting unused
connections.

**`wallet_sendPreparedCalls` returns a status that never resolves.**
The lane polls `wallet_getCallsStatus` for `PREPARED_CALLS_STATUS_TIMEOUT_MS`
(see `onboardingWallet.ts`). If it times out, the call is still pending on
the bundler — wait, then check the bundler dashboard / Coinbase developer
console for the eventual status. Do not retry blindly; you may end up with two
parallel userOps for the same nonce.

## 6. Sign-off checklist

Tick when verified:

- [ ] EOA wallet connected; wagmi `useAccount().address` matches an on-chain
      owner.
- [ ] `/dev/csw-signature-probe` *snapshot wallet session* shows
      `eth_accounts[0]` equal to the on-chain owner address.
- [ ] *probe personal_sign* run; verdict is **green**;
      `recoveredDirect(userOpHash)` lands on the connected EOA.
- [ ] Submitter guard does not throw on submission.
- [ ] `wallet_sendPreparedCalls` returned a `callsId`; status polled to a
      200-class result with a `transactionHash`.
- [ ] Receipt visible on Basescan; `from` is the EntryPoint, the inner call
      target is the CSW, and the call data matches the prepared transaction.
- [ ] Pre/post `ownerCount` and `ownerAtIndex(N)` snapshots match expectation
      (unchanged for non-owner-add operations; updated as expected for
      owner-add operations).

Once all boxes are ticked, the EOA-owner lane is verified end-to-end for the
selected CSW + owner pair. Future submissions can use the same wallet without
re-running the full checklist; spot-check the snapshot panel + verdict if a
session looks suspicious.
