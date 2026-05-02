# CSW × Base App reconciliation

Operator-focused triage guide for Coinbase Smart Wallet (CSW) signature failures
when the user is signing inside Base App. Read this first when the probe at
`/dev/csw-signature-probe` shows a red verdict, or when `wallet_sendPreparedCalls`
returns a bundler `-32507` validation revert.

## The two CSW signature paths

CSW verifies signatures through **two distinct paths** with different hash
semantics. Mixing them up is the most common source of "signature is correct
but the bundler still rejects it" reports.

| Path | Hash signed | Recovery rule | Source |
| --- | --- | --- | --- |
| Bundler / `validateUserOp` | raw `userOpHash` (no replaySafeHash wrap) | `_isValidSignature(userOpHash, sig)` | `CoinbaseSmartWallet.sol:191` |
| Off-chain ERC-1271 `isValidSignature(hash, sig)` | `replaySafeHash(hash)` (EIP-712 wrap inside the contract) | `_isValidSignature(replaySafeHash(hash), sig)` | `ERC1271.sol:70` |

The same signature **cannot** satisfy both paths. The probe signs raw hashes and
runs an ERC-1271 check on-chain so you can see which path the wallet's signature
shape actually targets.

## Why Base App's popup signs with a substituted key

Base App routes user requests through a "sub-account" pseudo-wallet that
delegates back to the canonical CSW for execution. When you call `personal_sign`
inside Base App, the popup may return a signature produced by a key that is
**not in the CSW's on-chain owner array**. That key is part of the sub-account's
session state, not the canonical wallet.

For wallets where every owner is a passkey (owner[0] in our reference CSW
`0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef`), this mismatch is invisible during
ERC-1271 checks because the popup routes signing back through a passkey
credential that the CSW will accept. For mixed wallets that include EOA owners
(indices 1, 2, …) the substitution surfaces as a bundler failure: the bundler
runs `ecrecover(userOpHash, sig)` and ends up at an address that is not in the
CSW owner array, returning `-32507`.

**No client-side signing change can fix this.** The user's session in Base App
must produce a signature from a key that is on-chain. The two operational
recoveries are:

1. Switch to the on-chain EOA-owner submission lane (below) so the bundler
   `ecrecover` path lands on a real owner.
2. If the user must use Base App, the substituted key has to be added to the
   CSW owner array via `addOwnerAddress` first — see the existing owner-install
   flow in `useAccountSetupController.onAddRabbyCoOwner`.

## Mismatch guard in `onboardingWallet.ts`

The `_submitOwnerViaPreparedCalls` function (`frontend/src/lib/wallet/onboardingWallet.ts`)
runs a pre-flight `preflightOwnerKeyMismatch` check between `personal_sign` and
`wallet_sendPreparedCalls`. The guard:

- Parses the wallet's signature bytes to extract `parsedOwnerIndex` (the CSW
  owner index claimed by the SignatureWrapper).
- Calls `ownerAtIndex(parsedOwnerIndex)` via `eth_call` against the canonical
  CSW.
- If the owner slot decodes as a 20-byte EOA address, calls `eth_getCode` on
  it. If the address has no code, runs `recoverAddress(userOpHash, ecdsaSig)`
  and compares to the parsed owner.
- **Throws** with a clear message if recovery succeeds but the recovered
  address does not match the parsed owner. This is the operator-visible
  signal that the popup substituted a foreign key.
- **Skips** the check (proceeds without blocking) for code-bearing owners
  (smart-contract or passkey) — those go through ERC-1271, which we cannot
  pre-flight statelessly.
- **Surfaces "unknown — proceeding"** when recovery itself throws (malformed
  signature, transient RPC error). The bundler will eventually decide; we
  prefer that to a false-positive block on a legitimate WebAuthn signature.

The error message names the parsed owner address, the recovered address, and
points the user at the EOA-owner submission lane. Surface that text verbatim in
support tickets — it is unambiguous about which key the wallet returned.

## Probe verdict row

`frontend/src/pages/dev/CswSignatureProbe.tsx` shows a single-glance "owner-key
verdict" banner above the detailed result table. States:

- **Green** — at least one of the recovery candidates (raw `userOpHash`,
  on-chain `replaySafeHash`, local `replaySafeHash`, EIP-191 variants of each)
  recovers to an EOA in the CSW owner array. The match path is named in the
  banner detail. This is the only state in which the bundler will accept the
  signature against an EOA owner index.
- **Yellow (unknown)** — either the on-chain owner snapshot could not be
  loaded (call reverted; CSW may be a non-standard fork) or every recovery
  attempt returned `null` (likely a malformed or non-65-byte wrapper).
  Resolve by clicking *load owner slots* and re-running the probe.
- **Red** — at least one recovery returned an address, but no recovered
  address matched any on-chain owner. **This is the substituted-key
  signature.** Use the side-by-side block below the verdict to see exactly
  which recovery hash produced which address, and compare against the loaded
  owner slots.

The verdict reuses the tri-state convention introduced in #496 for
`localReplaySafeMatchesOnchain`: missing data is *yellow*, never *red*.

## EOA-owner submission lane

Bypass the popup entirely by signing the userOpHash with one of the on-chain
EOA owners. Implementation: `_submitOwnerViaPreparedCallsWithEoaOwner` in
`frontend/src/lib/wallet/onboardingWallet.ts`, wired into
`useAccountSetupController` as `submitOwnerInstallViaOnchainEoa`.

For our reference CSW `0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef`, the
on-chain EOA owners are:

- `[1]` `0x5E1a0AFa913aD95aA3762b18Ea9AdD73d31313cf`
- `[2]` `0xCf8D17Ce01B73637ef936fe7c47bA7100b820142`

When to use:

- The probe verdict shows red against Base App.
- The user (or operator) controls one of the EOA owner private keys via a
  standard wagmi connector (MetaMask, Rabby, WalletConnect, Privy embedded).
- You need to add a new owner (e.g. add a Privy embedded EOA via the
  4626-signing flow) but the popup route is broken.

How it works:

1. `cswOwnersState` is loaded from `/api/deploy/smartWalletOwners`. EOA owners
   surface with `isAddressOwner=true` and a non-null `ownerAddress`.
2. The controller derives `connectedOnchainEoaOwner` by intersecting the
   connected wagmi `account.address` with `cswOwnersState.owners`. If the
   user is not connected as one of the EOA owners, this is `null` and the UI
   should disable the submission button and show *"Connect one of: 0x5E1a…,
   0xCf8D…"*.
3. The submission function:
   - Calls `wallet_prepareCalls` exactly as the popup lane does (so the
     bundler builds the userOp and returns the canonical `userOpHash`).
   - Asks the connected EOA's connector to `personal_sign(userOpHash, eoaAddress)`.
     The bundler verifies via `ecrecover(userOpHash, sig)`, so we sign the raw
     hash — no replaySafeHash wrap is applied here.
   - Recovers the signature locally before submission. If recovery does not
     land on the connected EOA, the connector is itself substituting a key
     and we throw with the same operator-friendly text as the mismatch guard.
   - Frames the signature as `{ type: 'secp256k1', data: { address, signature } }`
     and submits via `wallet_sendPreparedCalls`, with `ownerIndex` populated as
     a hint for bundler builds that key off the wrapper field.

Connectors compatibility note: any wagmi connector that exposes
`personal_sign` against a 32-byte hex hash works. WebAuthn-only connectors do
not work for the passkey owner at index 0 — we skip that index because we
cannot prompt a pure EOA connector to perform a WebAuthn signature.

## Reconciling Base App for users who must use it

If the operator decides the user must keep using Base App (for example because
the popup is the only way to surface the canonical CSW session in their
environment), the only durable fix is to add the substituted key as an on-chain
owner. Workflow:

1. Capture the substituted key's address from the probe banner detail
   ("Recovered `0x…`") or from the side-by-side block.
2. Connect a current on-chain EOA owner (or call `addOwnerAddress` directly
   from another tooling lane). The EOA-owner submission lane above is the
   recommended path — it bypasses the popup and goes straight to the bundler
   with a known-good signer.
3. After the new owner appears in `ownerAtIndex(N)`, retry the original Base
   App flow. The mismatch guard will now produce a green verdict because the
   wallet's substituted key matches a real on-chain owner.

This restores Base App as a usable signing lane for that specific user; it
does not generalize across users. Each Base App session that exhibits the
substitution behaviour will need its own owner-add transaction.
