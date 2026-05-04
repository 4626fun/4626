# CSW Recovery Playbook

How to install a new owner onto a stranded Coinbase Smart Wallet (CSW) when
the wallet was provisioned with only a passkey at `keys.coinbase.com` and the
embedded-wallet flow on `4626.fun` cannot route the install transaction.

## TL;DR

The canonical path is **Coinbase passkey owner[0] signs `executeWithoutChainIdValidation([addOwnerAddress(...)])` via `wallet_prepareCalls` / `wallet_sendPreparedCalls`**. Three other lanes were attempted and discarded; see "Why the other lanes don't work" below.

## Confirmed working transaction (May 4, 2026)

- **CSW:** `0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef`
- **UserOpHash:** `0x70255628ea8816f84e6d0657cabfdca810d1024e0d147ce75c3c6174dc2c5b1a`
- **EntryPoint:** `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` (v0.6)
- **Nonce:** `0x21050000…0001` — `key = 8453` (REPLAYABLE_NONCE_KEY for Base)
- **Owner installed at index 2:** `0xCf8D17Ce01B73637eF936Fe7c47bA7100b820142` (recovery key, ECDSA)
- **Signature shape:** `SignatureWrapper{ ownerIndex: 0, signatureData: <WebAuthn struct> }`
  - WebAuthn `clientDataJSON.type = "webauthn.get"`
  - WebAuthn `clientDataJSON.origin = "android:apk-key-hash:EAOWwOQABhsQXdlgGi5hBOadx7TY6ZX_CqJlpoxf1hk"` (org.toshi)
- **Gas:** Relay solver `0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f` fronted gas (paymaster=0x0 in the userOp; sponsorship resolved off-chain by Relay).
- **Result:** `success: true`, AddOwner event emitted at index 2.

## CSW state after recovery

```
ownerCount        : 3
nextOwnerIndex    : 3
removedOwnersCount: 0

owner[0] : WebAuthn passkey  x=0x983314af… y=0xb47456…  (Coinbase canonical passkey)
owner[1] : ECDSA              0x5e1a0afa913ad95aa3762b18ea9add73d31313cf
owner[2] : ECDSA              0xcf8d17ce01b73637ef936fe7c47ba7100b820142  ← installed via this playbook
```

## The path that works

1. **User opens `4626.fun/add-owner`** (or `keys.coinbase.com` directly for the
   recovery scenario above) on **desktop** so that the Coinbase Wallet SDK can
   open the canonical `keys.coinbase.com` popup. Webviews block this popup.
2. **Sign in** with the Privy session (or the passkey directly, for raw
   recovery).
3. **`wallet_prepareCalls`** — the SDK posts the call to the Coinbase backend,
   which (a) wraps `addOwnerAddress(...)` inside
   `executeWithoutChainIdValidation` so that the resulting userOp uses
   `nonce.key = REPLAYABLE_NONCE_KEY (8453)`, and (b) returns a
   `userOpHashWithoutChainId` for signing.
4. **Passkey signs** the prepared hash. The `keys.coinbase.com` popup performs
   the WebAuthn assertion using the passkey bound to that origin and returns a
   `SignatureWrapper{ ownerIndex: 0, signatureData: WebAuthnAuth }` blob.
5. **`wallet_sendPreparedCalls`** — the SDK ships the signed userOp to
   Coinbase's bundler / Relay's solver. Relay submits `EntryPoint.handleOps`
   on Base, fronts the gas, and returns the userOpHash + tx hash.

The codepath in this repo: `_submitOwnerViaPreparedCallsWithEoaOwner` invoked
from `useAccountSetupController.onEnable4626Signing()`, surfaced on
`/add-owner` via the single "Install signing key" button.

## Why the other lanes don't work

| Lane | Why it fails |
|---|---|
| `eth_sendTransaction(csw → csw)` (direct) | Reverts with `Unauthorized`. CSW's `execute()` requires `msg.sender == EntryPoint`, never the CSW itself. |
| Self-built UserOp + `personal_sign` + Relay | Base App's `personal_sign` returns a session-key ECDSA signature, **not** the passkey. Recovers to addresses that aren't owners → AA24 invalid signature. |
| `wallet_prepareCalls` from inside Base App webview | Backend gas-estimation builds a dummy userOp with `nonce.key = 0`. CSW's `validateUserOp` reverts `InvalidNonceKey(0)` whenever `bytes4(userOp.callData) == executeWithoutChainIdValidation.selector`, surfacing as `AA23 reverted (or OOG)` → "useroperation reverted". |
| `wallet_sendCalls(from: csw, to: csw)` | Coinbase popup blocks self-calls client-side ("Self calls are not allowed"). `addOwnerAddress` is inherently a self-call. |

## Re-running the playbook for another stranded CSW

1. Confirm the CSW has a Coinbase passkey at `owner[0]` (read via
   `ownerAtIndex(0)`; first 64 bytes are an ABI offset, next 64 bytes are
   `length=0x40`, then 32 bytes x and 32 bytes y).
2. Confirm `nextOwnerIndex` and `removedOwnersCount` so you know the slot the
   new owner will land in.
3. Make sure the CSW has > ~0.001 ETH on Base (only as a fallback — Relay
   will normally cover gas).
4. Open `https://4626.fun/add-owner` in a desktop browser logged into the
   account that owns the canonical passkey.
5. Click "Install signing key". Approve in the `keys.coinbase.com` popup
   when the WebAuthn prompt appears.
6. Wait ~10–30 s for Relay to submit. The page will display the on-chain tx
   hash. Verify the `AddOwner` event on Basescan.

## Useful selectors / identifiers

```
EntryPoint v0.6              : 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
REPLAYABLE_NONCE_KEY (Base)  : 8453 (0x2105)
ownerCount()                 : 0x0db02622
nextOwnerIndex()             : 0xd948fd2e
removedOwnersCount()         : 0x36d9cf9b
ownerAtIndex(uint256)        : 0x8ea69029
isOwnerAddress(address)      : 0xa2e1a8d8
addOwnerAddress(address)     : 0x0f0f3f24
executeWithoutChainIdValidation(bytes[]) : 0x2c2abd1e

AddOwner event topic         : 0x38109edc26e166b5579352ce56a50813177eb25208fd90d61f2f378386220220
UserOperationEvent topic     : 0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f
```
