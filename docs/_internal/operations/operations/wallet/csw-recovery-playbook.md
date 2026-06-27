---
title: CSW Recovery Playbook
---

# CSW Recovery Playbook

How to install a new owner onto a Coinbase Smart Wallet (CSW) from `/add-owner` on 4626.

This document is migrated from the root `RECOVERY.md` so recovery guidance lives under `docs/operations`.

## What actually works

The primary recovery path is the Coinbase passkey/WebAuthn owner signing a replayable smart-wallet UserOp:

1. Open `https://4626.fun/add-owner` in a normal browser (not in-app browser), so `keys.coinbase.com` popup can run.
2. Prepare `addOwnerAddress(privyEoa)` for the canonical CSW.
3. Wrap inner call as `executeWithoutChainIdValidation([addOwnerAddress(...)])`.
4. Use `wallet_prepareCalls` to produce replayable payload/hash.
5. Use `personal_sign` to trigger passkey flow (`SignatureWrapper` for owner index 0).
6. Submit via `wallet_sendPreparedCalls` and confirm `AddOwner` event.

Implementation anchors:

- `frontend/src/lib/wallet/onboardingWallet.ts`
  - `sendPreparedOwnerTx(...)` (primary production lane)
  - `_submitOwnerViaPreparedCallsWithEoaOwner(...)` (EOA-owner fallback)

## Confirmed reference (March 9)

- CSW: `0xAb6d5C10b03300326cd7fab7267ae192842967b5` (`CANONICAL_CSW_ADDRESS`; migrated 2026-04-23 from `0x4beabd…`)
- EntryPoint v0.6: `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`
- Replayable nonce key: `8453` (`0x2105`)
- Known userOpHash: `0x70255628ea8816f84e6d0657cabfdca810d1024e0d147ce75c3c6174dc2c5b1a`

Decoded success signature shape:

- Outer wrapper: `SignatureWrapper{ ownerIndex: 0, signatureData: WebAuthnAuth }`
- `clientDataJSON.type`: `webauthn.get`
- `clientDataJSON.androidPackageName`: `org.toshi`

Use `scripts/recovery/decode-userop-signature.mjs` to decode signatures and verify whether the signer is a valid on-chain owner.

## Known broken / fallback lanes

- `wallet_sendCalls` self-call (`csw -> csw`) can fail with Coinbase self-call guard.
- HackMD-style `{ preparedCalls, signature, context }` payloads are rejected by bundler JSON parsing.
- `eth_sendTransaction(csw -> csw)` can revert `Unauthorized`.
- Server-side self-built UserOp + Relay is not viable unless user has appropriate EOA private key control.
- EOA-owner prepared-calls lane is fallback-only (requires existing EOA owner + 65-byte ECDSA signature).

## In-app browser caveat

Coinbase Wallet / Base App in-app browsers can block or substitute popup signing context. Owner installs should be performed in a regular external browser tab. The UI should detect webviews and show an “Open in browser” path.

## Related

- `docs/operations/relay-sponsored-owner-mutation-flow.md`
- `docs/operations/archive/coinbase-inapp-signaturewrapper-bug.md`
