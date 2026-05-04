# CSW Recovery Playbook

How to install a new owner onto a Coinbase Smart Wallet (CSW) from
`/add-owner` on 4626.fun.

## What actually works

The primary recovery path is the Coinbase passkey/WebAuthn owner signing a
replayable smart-wallet UserOp:

1. Open `https://4626.fun/add-owner` in a normal browser, not a wallet in-app
   browser, so the `keys.coinbase.com` popup can run.
2. The app prepares `addOwnerAddress(privyEoa)` for the user's canonical CSW.
3. The self-auth lane wraps that inner call as
   `executeWithoutChainIdValidation([addOwnerAddress(...)])`.
4. `wallet_prepareCalls` returns a UserOp with Base replayable nonce key
   `8453` and a chain-id-free hash for signing.
5. `personal_sign` opens the Coinbase passkey flow. On the verified March 9
   success, the WebAuthn assertion was performed by Toshi (`org.toshi`) on
   the user's Android device and returned a `SignatureWrapper` for owner[0].
6. `wallet_sendPreparedCalls` submits the prepared UserOp and the CSW emits
   `AddOwner` for the new EOA owner.

This is implemented in `frontend/src/lib/wallet/onboardingWallet.ts`:

- `sendPreparedOwnerTx(...)` handles the production `/add-owner` submission.
- In self-auth mode (`signerAddress === canonicalSmartWalletAddress`), it uses
  the replayable prepared-calls lane and preserves the WebAuthn signature blob.
- `_submitOwnerViaPreparedCallsWithEoaOwner(...)` is a separate fallback for
  users who can connect an existing on-chain EOA owner. It is not the passkey
  lane because it intentionally requires a 65-byte ECDSA signature.

## Confirmed March 9 reference

Active CSW (Base, chain id 8453):

- CSW: `0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef`
- owner[0]: Coinbase passkey / WebAuthn owner
- owner[1]: EOA `0x5e1a0afa913ad95aa3762b18ea9add73d31313cf`
- owner[2]: EOA `0xcf8d17ce01b73637ef936fe7c47ba7100b820142`
- target Privy EOA to install: `0xb2aad65a5402714bf428a66731ae62ba5c45cac0`
- EntryPoint v0.6: `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`
- Replayable nonce key: `8453` (`0x2105`)
- Known userOpHash: `0x70255628ea8816f84e6d0657cabfdca810d1024e0d147ce75c3c6174dc2c5b1a`
- Known transaction prefix: `0x801b9d4b...`

The decoded success signature was 672 bytes total:

- Outer shape: `SignatureWrapper{ ownerIndex: 0, signatureData: WebAuthnAuth }`
- `clientDataJSON.type`: `webauthn.get`
- `clientDataJSON.origin`: `android:apk-key-hash:EAOWwOQABhsQXdlgGi5hBOadx7TY6ZX_CqJlpoxf1hk`
- `clientDataJSON.androidPackageName`: `org.toshi`
- Decoded challenge:
  `0x612d732fd2cd5b4b00490a23d475d1b72e6c9ede60aaec21393900548aa5e27a`

Use `scripts/recovery/decode-userop-signature.mjs` to decode future
signatures and verify whether the passkey/WebAuthn owner or an EOA owner
actually signed.

## Known broken or fallback lanes

- `wallet_sendCalls` (`csw -> csw` self-call): blocked by the Coinbase popup
  self-call guard: "Self calls are not allowed".
- HackMD-style `{ preparedCalls, signature, context }` payloads: rejected by
  the bundler JSON parser.
- `eth_sendTransaction(csw -> csw)`: reverts `Unauthorized`; the CSW does not
  authorize itself as a direct caller.
- Server-side self-built UserOp + Relay using an EOA private key: not viable
  for this user because they do not have either EOA private key.
- EOA-owner prepared-calls lane: supported only when the user can connect an
  existing EOA owner and produce a 65-byte ECDSA signature. It is a fallback,
  not the canonical passkey lane.

## In-app-browser caveat

Coinbase Wallet / Base App in-app browsers can block or substitute the popup
signing context. Owner installs should be performed in a regular external
browser tab. The page detects wallet webviews and surfaces an "Open in browser"
link.

## Files

- UI: `frontend/src/pages/AddOwner.tsx`
- Controller: `frontend/src/features/accountSetup/useAccountSetupController.ts`
- Lane implementation: `frontend/src/lib/wallet/onboardingWallet.ts`
- Signature decoder: `scripts/recovery/decode-userop-signature.mjs`
