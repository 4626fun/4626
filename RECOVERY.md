# CSW Recovery Playbook

How to install a new owner onto a Coinbase Smart Wallet (CSW) from
`/add-owner` on 4626.fun.

## What actually works

There is exactly one supported path:

1. The CSW must already have at least one **EOA owner** in its on-chain owner
   list (an `address` owner, not a passkey/WebAuthn owner).
2. The user connects a wallet (Toshi, MetaMask, an imported key, etc.) whose
   address matches one of those EOA owners.
3. That EOA signs `personal_sign` over the user-operation hash. The signature
   is wrapped as a `secp256k1` `SignatureWrapper` (owner-index + 65-byte
   ECDSA) and submitted via Coinbase's `wallet_sendPreparedCalls`.
4. The Coinbase bundler executes `addOwnerAddress(privyEoa)` on the CSW.
   Gas is sponsored via the 4626 paymaster proxy.

This is implemented in
`frontend/src/lib/wallet/onboardingWallet.ts` →
`_submitOwnerViaPreparedCallsWithEoaOwner`, and surfaced in the UI through
`useAccountSetupController.submitOwnerInstallViaOnchainEoa`.

## What does NOT work

All of the self-auth lanes below have been removed because they are
demonstrably broken on phone Chrome and Coinbase Wallet's in-app browser:

- `wallet_sendCalls` (csw → csw self-call) — blocked at
  `keys.coinbase.com` by a popup React `useMemo` guard:
  > Self calls are not allowed
- `wallet_sendPreparedCalls` with a wrapped-signature self-call — Coinbase
  bundler returns `types.Alias` JSON unmarshal errors.
- HackMD-shape `{preparedCalls, signature, context}` — bundler returns
  `invalid character 'x' after top-level value`.
- viem typed/non-typed `UserOperation` self-call — same upstream popup
  guard.
- `eth_sendTransaction(csw → csw)` — reverts `Unauthorized` because the
  CSW is not an owner of itself.
- Self-built UserOp + Relay `/execute` — requires a private key the user
  does not hold.

If the CSW has zero EOA owners, none of the above can work, and `/add-owner`
cannot install a new owner from a phone or any browser. The only recovery in
that case is the original passkey from `keys.coinbase.com` on the device
where it was provisioned.

## On-chain reference

Active CSW (Base, chain id 8453):

- CSW: `0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef`
- owner[0]: passkey (Coinbase canonical WebAuthn) — cannot be used from
  external browsers
- owner[1]: EOA `0x5e1a0afa913ad95aa3762b18ea9add73d31313cf`
- owner[2]: EOA `0xcf8d17ce01b73637ef936fe7c47ba7100b820142`
- target Privy EOA to install: `0xb2aad65a5402714bf428a66731ae62ba5c45cac0`
- EntryPoint v0.6: `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`

To use `/add-owner` for this CSW the user must connect a wallet whose
address matches owner[1] or owner[2].

## In-app-browser caveat

Coinbase Wallet / Base App's in-app browser substitutes a session key that
is not an owner of the CSW. Owner installs must be performed in a regular
browser tab (Safari, Chrome). The page detects this and surfaces an
"Open in browser" link.

## Files

- UI: `frontend/src/pages/AddOwner.tsx`
- Controller: `frontend/src/features/accountSetup/useAccountSetupController.ts`
  - exports `onchainEoaOwnerCandidates`, `connectedOnchainEoaOwner`,
    `submitOwnerInstallViaOnchainEoa`
- Lane impl: `frontend/src/lib/wallet/onboardingWallet.ts`
  - `_submitOwnerViaPreparedCallsWithEoaOwner` — only canonical install
    path (strict 65-byte ECDSA recovered to the connected EOA owner)
  - `_submitOwnerViaPreparedCalls` — kept solely for `CswSignatureProbe`
    (dev tool); not used by `/add-owner`
  - `sendPreparedOwnerTx` — lane chooser for non-self-auth callers
    (e.g. external co-owner flow on `/accounts`)
- Paymaster proxy: `https://4626.fun/api/paymaster`
