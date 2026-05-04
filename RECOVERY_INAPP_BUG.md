# Coinbase Wallet in-app browser: SignatureWrapper claims wrong ownerIndex on Smart Wallet self-call

**Reproduced**: 2026-05-04 against Coinbase Wallet Android (build w/ Chrome 147 webview, Android 16, Samsung Galaxy S23+ SM-S916U).

**Severity**: Major — every owner-install / self-call / userOp from inside Coinbase Wallet's in-app browser fails with the misleading user-facing message **"Error generating transaction — Please make sure you have enough funds to complete the transaction."** The CSW owner state is never modified, but users believe their wallet is broken.

---

## Summary

When a dApp loaded inside Coinbase Wallet's in-app browser calls `eth_signTypedData_v4` against the user's connected canonical Coinbase Smart Wallet, the wallet returns a 224-byte ABI-encoded `SignatureWrapper(uint256 ownerIndex, bytes signatureData)` that:

1. Claims `ownerIndex: 2` in the wrapper
2. But the `signatureData` is a 65-byte ECDSA signature signed by a **session key that is not registered on-chain as owner[2] — or as any owner of the CSW**

`isValidSignature` against the on-chain CSW therefore rejects the signature, and the wallet's own preflight (correctly) detects the mismatch and aborts every subsequent `eth_sendTransaction` / `wallet_sendCalls` from the in-app browser. The user sees only "Error generating transaction" with Cancel/Retry options.

The bug is **in-app-browser-specific**: the same CSW signs and submits successfully via the keys.coinbase.com popup in an external browser tab on the same device.

## Reproduction

### Setup
- CSW: `0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef` on Base (chainId 8453)
- 3 owners on-chain:
  - `[0]` WebAuthn passkey (Coinbase canonical)
  - `[1]` ECDSA `0x5e1a0afa913ad95aa3762b18ea9add73d31313cf`
  - `[2]` ECDSA `0xcf8d17ce01b73637ef936fe7c47ba7100b820142`

### Steps

1. Open Coinbase Wallet on Android (signed in to the Smart Wallet above)
2. Tap the in-app browser, navigate to a dApp that calls `eth_signTypedData_v4`
3. Sign the typed-data prompt with the on-device passkey

### Probe payload used

```json
{
  "domain": {
    "name": "Coinbase Smart Wallet",
    "version": "1",
    "chainId": 8453,
    "verifyingContract": "0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef"
  },
  "types": {
    "ProbeMessage": [{ "name": "note", "type": "string" }]
  },
  "primaryType": "ProbeMessage",
  "message": { "note": "toshi probe — not a UserOp" }
}
```

`hashTypedData` of the above = `0x7467fa4b1d5a9f7c3ac619ec0bf4a140b3a04eaf5c0f4601004eb1cf2798f77f`

### Returned signature (verbatim)

```
0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000411fcfaa050b2d940531711348a2ec3efc1664645738e6cf1ac2fb6d108e84778466ba5802049310f23e7517bbed59f5f8650096b7555444357adf781f68d1dbc01b00000000000000000000000000000000000000000000000000000000000000
```

Decoded as `SignatureWrapper`:

| Field | Value |
| --- | --- |
| `ownerIndex` | `2` |
| `signatureData.length` | `65` (ECDSA, not WebAuthn) |
| `r` | `0x1fcfaa050b2d940531711348a2ec3efc1664645738e6cf1ac2fb6d108e847784` |
| `s` | `0x66ba5802049310f23e7517bbed59f5f8650096b7555444357adf781f68d1dbc0` |
| `v` | `27` |
| `ecrecover(hash, r, s, v)` | `0xd3C6B2290F1BD7cDc4Ffd264eA85908de9460Afc` |

### On-chain check

Confirmed via `isOwnerAddress(0xd3C6B2290F1BD7cDc4Ffd264eA85908de9460Afc)` against the CSW: **`false`**. The recovered key is not an owner. The wrapper claims `ownerIndex: 2` but `ownerAtIndex(2)` returns `0xcf8d17ce01b73637ef936fe7c47ba7100b820142` — a different ECDSA key.

The on-chain `_isValidSignature` therefore rejects the signature, which the wallet's own preflight correctly anticipates → "Error generating transaction".

### Other methods, same session

| Method | Result |
| --- | --- |
| `eth_requestAccounts` | OK — returns the CSW address |
| `wallet_getCapabilities` | OK — reports `paymasterService.supported: true`, `atomicBatch.supported: true`, `atomic.status: 'supported'` for chainId `0x2105` |
| `eth_signTypedData_v4` | OK — but wraps a non-owner key (the bug) |
| `wallet_prepareCalls` | **FAIL** — `ProviderRpcError(1000, "Failed to fetch RPC request")` (popup blocked) |
| `wallet_sendCalls` w/ `paymasterService` capability | Wallet opens "Review request" sheet → user can only Cancel/Retry; fails preflight before signing |
| `eth_sendTransaction` (self-call) | Same "Review request" sheet → "Error generating transaction" |

## Expected behaviour

- Either the wallet should sign with the actual on-chain owner credential (the canonical Coinbase passkey at `owner[0]`, same flow as keys.coinbase.com popup), OR
- The wallet should fail loudly with an explicit "this in-app session has no on-chain owner" error so the dApp can route the user to an external browser, instead of silently producing an invalid SignatureWrapper.

The current behaviour leaves users believing their wallet is broken or underfunded; the on-chain state is fine and the wallet is rejecting its own signature.

## Suggested fix

Either:

1. The in-app browser session should mint a session-key-aware Smart Wallet owner index by adding the session key as an owner before signing, or
2. The in-app session-key signing path should refuse to wrap-as-owner and instead return an unwrapped ECDSA signature so callers can detect "no owner credential available" deterministically, or
3. Restore the keys.coinbase.com popup path inside the in-app browser (e.g. via universal link → external browser hop) so the canonical passkey signer is reachable.

## Workaround shipped

`/add-owner` on the affected dApp now detects `window.ethereum.isCoinbaseWallet === true && window.ethereum.isCoinbaseBrowser === true` and surfaces an "Open in browser" CTA instead of the install button. This is OK for engineer-targeted flows but user-hostile for general onboarding.

## Repro repo / probe tool

A self-contained probe page that runs each method against the connected provider and dumps the raw signature for offline decoding lives at `/dev/toshi-probe`. The decoder script (`scripts/recovery/decode-userop-signature.mjs`, also linked from the dApp's RECOVERY.md) reproduces the table above from the raw hex.

---

*Filed by 4626.fun (info@akita.llc / akitav2@proton.me); will mirror to coinbase/coinbase-wallet-sdk Issues if no triage path is preferred.*
