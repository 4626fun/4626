# CSW × Base App reconciliation

> **Canonical reference:** [docs/ACCOUNT_MODEL.md](./ACCOUNT_MODEL.md) covers the strategic decision to drop dapp-side owner-mutation as a product flow for Base App-managed CSWs (see §3 and §5.2). This file is an operator-focused diagnostic runbook that complements that decision; if there's any conflict, ACCOUNT_MODEL.md wins.

Operator-focused triage guide for Coinbase Smart Wallet (CSW) signature failures
when the user is signing inside Base App. Read this first when the probe at
`/dev/csw-signature-probe` shows a red verdict, or when `wallet_sendPreparedCalls`
returns a bundler `-32507` validation revert.

## TL;DR

For the canonical CSW at `0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef` on Base, the
Base App popup signs with a **per-session sub-account key that is not in the CSW's
on-chain owner array**. ERC-1271 and bundler validation both correctly reject it.
There is no client-side fix.

The path forward is the **EOA-owner submission lane** — connect a wallet whose
address is one of the on-chain owners (`0x5E1a0AFa913aD95aA3762b18Ea9AdD73d31313cf`
or `0xCf8D17Ce01B73637ef936fe7c47bA7100b820142`) and sign the userOpHash with
that key. See [the EOA-owner submission lane](#eoa-owner-submission-lane) below
and the step-by-step verification doc at
`docs/csw-eoa-owner-lane-verification.md`.

To confirm the case live, open `/dev/csw-signature-probe`. The "Wallet session
snapshot" panel surfaces the substitution before the popup is even invoked.

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

The Coinbase Wallet SDK (cb-sdk) launches CSW sessions in **sub-account mode**.
See `createSubAccountSigner.ts` in cb-sdk: `eth_accounts` returns the sub-account
address (not the parent CSW), and `personal_sign` is fulfilled by the
sub-account's per-session key. That key is generated client-side, lives in the
session, and **is never written to the CSW's on-chain owner array**. The
substitution is invisible to the dapp unless you read `eth_accounts` directly off
the connector's provider — which is exactly what the probe's
[wallet session snapshot](#how-to-detect-the-substitution) does.

Base App routes user requests through that sub-account pseudo-wallet, which
delegates back to the canonical CSW for execution. When you call `personal_sign`
inside Base App, the popup returns a signature produced by a key that is
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

## How to detect the substitution

Open `/dev/csw-signature-probe` in the failing context.

1. **Wallet session snapshot panel.** Click *snapshot wallet session* (or run any
   probe — the snapshot is captured automatically before each sign). The panel
   reads `eth_accounts`, `eth_chainId`, and best-effort `wallet_getCapabilities`
   directly off the connector's provider, then compares `eth_accounts[0]` to the
   configured CSW. Tri-state:
   - **Green** — `eth_accounts[0] === cswAddress`. The popup will sign as the CSW.
   - **Amber** — `eth_accounts[0] !== cswAddress`. The provider is reporting a
     sub-account address; the popup will sign with the sub-account's ephemeral
     session key. **This is the smoking gun.**
   - **Yellow** — at least one read failed (no provider, RPC error). The probe
     can still run; reconnect and re-snapshot if you need the diagnostic.
   The snapshot is also embedded in `probeResult.walletSession` for the JSON
   dump at the bottom of the page, so it travels with bug reports.
2. **Owner-key verdict turns red.** None of the five recovery rows lands on an
   on-chain owner. See the verdict-row section below.
3. **Ephemeral-candidate sub-line.** When the verdict is red, the probe queries
   `eth_getCode` and `eth_getTransactionCount` for each unique recovered
   address. Zero code AND zero transactions flags an ephemeral candidate —
   consistent with a Base App session key that has never been used on-chain.
4. **Submitter mismatch guard fires on any submission attempt** from the same
   session, with the explicit text *"Signature does not match parsed owner [N]
   (0x…). … Try the EOA-owner submission lane (sendPreparedOwnerCallsWithEoaOwner)."*
   See the next section.

For a passkey signature (WebAuthnAuth tuple), the guard logs *"passkey signature
— skipping EOA recovery preflight"* and proceeds; ECDSA recovery is inapplicable
on that path. The probe's signature-shape classifier (#500) labels the row
`webauthn` and exposes a `passkey challenge view` that decodes the
`clientDataJSON.challenge` and compares it against the signed hash.

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

**Chicken-and-egg caveat.** Base App sub-account session keys are *transient* —
derived per session, not persisted across launches. Adding the current session's
key as an owner only makes that single session usable; the next launch produces
a different key and the on-chain entry is stale. The stable path is to add an
EOA the user controls (a hardware wallet, MetaMask, Rabby, an embedded wallet)
as an owner once, then use the EOA-owner submission lane for any future CSW
mutation.

## Operator runbook

When a user reports "Base App signature is being rejected":

1. Send them to `/dev/csw-signature-probe`.
2. Paste the affected CSW into the address field, click *load owner slots*,
   then *snapshot wallet session*.
3. Read the snapshot block:
   - Amber → confirmed sub-account substitution; jump to step 5.
   - Green → Base App is operating on the CSW directly; the failure is
     elsewhere. Run *probe personal_sign* and capture the JSON dump for triage.
   - Yellow → reconnect Base App and re-snapshot.
4. Run *probe personal_sign* anyway to capture the verdict row, recovery rows,
   ephemeral-candidate signal, and the on-chain ERC-1271 result for the bug
   report. The JSON dump at the bottom of the page (now including
   `walletSession`) is copy-pasteable.
5. Have the user connect one of the on-chain EOA owners (a hardware wallet or
   any wagmi connector holding the owner key). The account-setup controller
   detects the connected owner and exposes the EOA-owner submission lane.
6. Run the EOA-owner submission. Expected end-state:

   ```
   probe verdict     : green ✓ matches owner[N]
   submitter guard   : ok
   bundler           : accepts
   receipt           : 0x…
   on-chain owners[] : unchanged (we are using an existing owner, not adding one)
   ```

For step-by-step instructions a user can follow on their own, see
`docs/csw-eoa-owner-lane-verification.md`.

## References

- PR [#499](https://github.com/wenakita/4626/pull/499) — probe verdict row +
  submitter mismatch guard + EOA-owner submission lane
- PR [#500](https://github.com/wenakita/4626/pull/500) — probe shape recognizer
  + ephemeral session-key heuristic
- `frontend/src/pages/dev/CswSignatureProbe.tsx` — live probe UI
- `frontend/src/lib/wallet/onboardingWallet.ts` — `_submitOwnerViaPreparedCalls`,
  `_submitOwnerViaPreparedCallsWithEoaOwner`, `preflightOwnerKeyMismatch`
- `frontend/src/lib/wallet/walletSessionSnapshot.ts` — wallet session snapshot
  helper (reads `eth_accounts` / `eth_chainId` / `wallet_getCapabilities`)
- `frontend/src/lib/wallet/ephemeralKeyHeuristic.ts` — ephemeral-candidate
  detector (no code + zero txs)
- `frontend/src/lib/wallet/signatureShape.ts` — secp256k1 / webauthn / unknown
  shape classifier
- `frontend/src/lib/wallet/probeVerdict.ts` — owner-key verdict tri-state
- `frontend/src/features/accountSetup/useAccountSetupController.ts` — EOA-owner
  lane wiring (`submitOwnerInstallViaOnchainEoa`,
  `connectedOnchainEoaOwner`, `onchainEoaOwnerCandidates`)
- cb-sdk: `packages/wallet-sdk/src/sign/scw/utils/createSubAccountSigner.ts` —
  sub-account session key generation
- Smart-wallet contract source: `CoinbaseSmartWallet.sol:191` (bundler path),
  `ERC1271.sol:70` (off-chain path)
- `docs/csw-eoa-owner-lane-verification.md` — step-by-step verification doc
  for the EOA-owner lane
