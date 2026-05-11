# Relay-sponsored CSW owner-mutation flow

**Status:** specification — implementation lands in PR #578.

**Audience:** future maintainers (human or LLM) working on `/remove-owner`,
`/add-owner`, or any other CSW owner-mutating page that wants to route through
Relay Protocol.

## Why this doc exists

Between May 4 and May 11, 2026 we shipped seven PRs (#571 → #577) trying to
make `/remove-owner` work. Each iteration found one more architectural
constraint and added a partial fix:

| PR | What it tried | Why it failed |
|----|---------------|---------------|
| #571 / #572 | hand-build `handleOps` calldata, POST to `/api/relay/execute` | depository never credited; AA24 on solver simulation |
| #573 | switch to wagmi public client, attribute per-slot read errors | unrelated cosmetic; root cause still AA24 |
| #574 | surface full Relay revert reason in the UI | confirmed AA24 from solver simulation |
| #575 | force passkey via `requireWebAuthnOwnerSignature: true` | Coinbase Wallet's `personal_sign` never returns a passkey signature in self-auth |
| #576 | switch to `wallet_prepareCalls` (passkey path documented by Coinbase) | Coinbase in-app browser cannot make those RPCs (see `inAppBrowser.ts`) |
| #577 | fixup: normalize hex value to decimal in quote body | works, but #576's `prepareCalls` path is still blocked in-app |

The root architectural mistake repeated across all these attempts: we were
trying to do **both** the funding and the signing from the same browser session
inside the CSW's own wallet. That cannot work, because:

- The CSW is a smart contract. To execute a tx, it needs a UserOp signed by an
  installed owner.
- The Coinbase Wallet **in-app browser** can sign neither passkey UserOps (no
  WebAuthn navigator access) nor session-key UserOps (the wallet returns
  signatures from rotated keys that aren't installed on-chain).
- The Coinbase Wallet **in-app browser** also blocks `wallet_prepareCalls` and
  `wallet_sendPreparedCalls` with `Failed to fetch RPC request` (see
  `frontend/src/lib/wallet/inAppBrowser.ts` lines 4–21).

## The working architecture

The Relay-sponsored owner-mutation flow has **two distinct on-chain actions**,
and they can — and should — be performed by **two different wallets**:

```
┌─────────────────────────────┐         ┌──────────────────────────────────┐
│  Wallet A (signer wallet)   │         │  Wallet B (funder wallet)        │
│  ─────────────────────────  │         │  ──────────────────────────────  │
│  Holds: CSW passkey         │         │  Holds: any EOA with small ETH   │
│  Browser: REGULAR mobile    │         │  Browser: anywhere (in-app OK)   │
│           (Safari / Chrome) │         │                                  │
│                             │         │                                  │
│  Action: SIGN the inner     │         │  Action: BROADCAST the outer     │
│  CSW UserOp via WebAuthn    │         │  tx via plain eth_sendTransaction│
│  passkey                    │         │                                  │
└──────────────┬──────────────┘         └──────────────┬───────────────────┘
               │                                       │
               │ produces signed UserOp                │ produces tx hash
               │ (`signature: 0x...`)                  │ on Base
               │                                       │
               ▼                                       ▼
        ┌─────────────────────────────────────────────────────┐
        │ Relay /quote/v2 (cross-chain or same-chain swap)    │
        │                                                     │
        │ Input:   {user: WalletB-EOA, recipient: CSW,        │
        │           originChainId: anywhere,                  │
        │           destinationChainId: 8453 (Base),          │
        │           txs: [{to: CSW, data: handleOps(...)}],   │
        │           amount: <tiny ETH for solver fee>}        │
        │                                                     │
        │ Output:  step[0].id == "swap" or "deposit"          │
        │          items[0].data == {                         │
        │            from: WalletB-EOA,                       │
        │            to:   RelayRouterV3 / RelayDepository,   │
        │            data: 0xcd6e13f7 multicall(...),         │
        │            value: <amount>,                         │
        │            maxFeePerGas, maxPriorityFeePerGas       │
        │          }                                          │
        └─────────────────────────────────────────────────────┘
```

Once the funder broadcasts the quoted tx, Relay's solver picks up the deposit,
calls `RelayRouterV3.multicall(...)` (or `EntryPoint.handleOps` directly), and
the CSW's pre-signed UserOp executes — including the owner mutation.

## Verified probe results (May 11 2026)

Direct calls to `https://api.relay.link/quote/v2` confirm the response shape:

### Same-chain (origin = destination = Base), funder = CSW

```
step[0].id = "swap"
items[0].data:
  from:   CSW (0x4beA…04EF)
  to:     RelayRouterV3 (0xb92fe925…fff4f)
  data:   0xcd6e13f7… (multicall(...))
  value:  0
  maxFeePerGas: 6500000
  maxPriorityFeePerGas: 1000000
```

This is the shape PR #576 used. **The "from" being the CSW means the CSW
itself must execute the multicall** — which requires `wallet_prepareCalls`,
which is blocked in-app. ❌

### Same-chain (origin = destination = Base), funder = EOA, recipient = CSW

```
step[0].id = "swap"
items[0].data:
  from:   FUNDER-EOA
  to:     RelayRouterV3
  data:   0xcd6e13f7… (multicall(...))  (← includes inner handleOps)
  value:  <amount>  (the fee the funder pays Relay)
```

**The "from" is the funder EOA**, so the funder broadcasts a plain
`eth_sendTransaction`. No `wallet_prepareCalls`. No passkey from the funder
wallet. The funder's wallet — even Coinbase Wallet's in-app browser — can do
this trivially. ✅

### Cross-chain (origin = mainnet, destination = Base), funder = EOA, recipient = CSW

```
step[0].id = "deposit"
items[0].data:
  from:   FUNDER-EOA (on mainnet)
  to:     RelayDepository on Base (0x4cD00E…BC31)
  data:   0x49290c1c… (depositNative(user, orderId), 68 bytes)
  value:  ~0.0000293 ETH
```

This is the shape from the working historical reference UserOp
[0xa6b54357…b4c3](https://basescan.org/tx/0x34edd28dd9611f4e06374dfe87645de4fc3fd94c83f96b5b1406c6ee10d2aadf)
— deposit on origin chain, solver picks it up, executes the owner mutation on
Base via [0xa9a06340…9a36](https://basescan.org/tx/0xa9a06340a7725063f1dd9b0a29af6c72f4fbfe3a408b28dd28e2fd2db7649a36). ✅

## What needs to be in the inner signed UserOp

Whatever lane Relay returns, the inner UserOp inside the multicall must be a
properly-signed CSW UserOp:

- `sender:` CSW address
- `nonce:` replayable key `0x2105_…_<seq>` so the same signed UserOp can be
  broadcast on any chain (the chain-id-bound nonce is harder to coordinate
  across two sessions)
- `callData:` `executeWithoutChainIdValidation([<inner action calldata>])`
- `callGasLimit / verificationGasLimit / preVerificationGas:` non-zero but
  small (the working reference used `150_000 / 1_000_000 / 0`)
- `maxFeePerGas / maxPriorityFeePerGas:` **zero** when Relay's solver pays gas
- `paymasterAndData:` `0x` (Relay's solver eats gas; no separate paymaster)
- `signature:` a 224-byte `SignatureWrapper(ownerIndex, signatureData)` whose
  `signatureData` is a WebAuthn assertion that recovers to `ownerAtIndex(0)`
  (the passkey) OR a 65-byte ECDSA that recovers to `ownerAtIndex(N)` for some
  installed EOA owner N.

The hash being signed is `getUserOpHashWithoutChainId(userOp)` (i.e. the
EntryPoint hash with chainId zeroed). This is what
`executeWithoutChainIdValidation` validates against.

## The two-session UX

`/remove-owner` should expose two modes:

### Mode 1 — Sign

For a user opening the page from a regular browser with passkey access:

1. Page reads on-chain owner slots, computes the target slot to remove.
2. Page builds the inner CSW UserOp (callData = `removeOwnerAtIndex(...)`,
   nonce = replayable, gas/fee = zero).
3. Page computes `getUserOpHashWithoutChainId(userOp)`.
4. User clicks **"Sign with passkey"**. Page calls WebAuthn directly via
   `navigator.credentials.get(...)` to sign the hash with the passkey
   (`ownerAtIndex(0)`) — bypassing the wallet's RPC layer entirely so the
   in-app browser limitation doesn't apply if the page is being driven from
   a regular browser session.
5. Page wraps the WebAuthn assertion in `SignatureWrapper(ownerIndex=0, …)`.
6. Page presents an **execution receipt** the user can copy or share —
   a single URL parameter or QR code containing the signed UserOp +
   target chain ID + a recommended funder amount.

### Mode 2 — Submit

For a user opening the page (or a deep link) from any wallet that can send a
plain tx:

1. Page parses the execution receipt to recover the signed UserOp.
2. Page calls `/api/relay/quote` with `user = <connected EOA>`,
   `recipient = <CSW from the receipt>`, `txs = [{to: CSW, data: handleOps(...)}]`.
3. Page presents the quoted tx (`to`, `value`, gas) and a **"Submit"** button.
4. User clicks Submit. Page calls `eth_sendTransaction` (or
   `wallet_sendCalls` for AA wallets) with the quoted shape.
5. The funder's wallet broadcasts the tx. Relay's solver picks it up and
   executes the inner UserOp on Base.
6. Page polls `check.endpoint` (the `/intents/status/v3?requestId=…` URL Relay
   returns in the quote) to surface the eventual destination tx hash.

## What NOT to do

Lessons from the broken iterations:

- **Don't hand-build `handleOps` and POST to `/api/relay/execute`.** That path
  is for cases where Relay's solver wallet is the actual broadcaster (which
  requires a per-orderId depository credit you'd have to arrange separately).
  Use `/api/relay/quote` and let the funder broadcast the quoted tx.
- **Don't use `wallet_prepareCalls` inside Coinbase Wallet's in-app browser.**
  It returns `Failed to fetch RPC request` 100% of the time.
- **Don't use `personal_sign` and trust the recovered address.** Coinbase
  Wallet's self-auth `personal_sign` returns a signature from whatever its
  current session key is, claiming `ownerIndex` based on its client-side state
  — but the session key rotates and the ECDSA recovers to an address that's
  not installed on-chain. Always verify the recovered address against the
  on-chain owner bytes before accepting the signature.
- **Don't assume `requireWebAuthnOwnerSignature: true` forces a passkey
  prompt.** It only filters out non-passkey-shaped responses; if the wallet
  refuses to return one, the lane just fails with no signature.
- **Don't try to do the whole flow in one click in one wallet.** The signing
  wallet (passkey) and the funding wallet (ETH-holding EOA) are different
  contexts with different security models. Separating them is the architecture.

## /api/relay/quote proxy contract (updated in PR #578 follow-up)

The proxy at `frontend/api/_handlers/relay/_quote.ts` previously hard-coded
`recipient: body.user`, which silently overrode any client-side `recipient`.
It now accepts optional `recipient`, `originChainId`, and `destinationChainId`
fields and forwards them to Relay, while keeping the legacy default behavior
(`recipient = user`, `origin = destination = chainId`) when those fields are
absent. The funder-EOA lane MUST pass `recipient: cswLower` explicitly so
Relay routes the multicall execution back to the CSW rather than to the
funder.

## Removed lane: CSW self-call via direct eth_sendTransaction

**Tried in PR #580. Reverted in PR #583.**

The theory (from session `248b841e` notes): when the connected wallet IS the
CSW (self-auth), a plain `eth_sendTransaction` where `from === to === CSW`
and `data === executeWithoutChainIdValidation([...])` would be recognised by
Base App's native handler, signed locally with the on-device passkey, and
submitted via its own bundler with no popup.

The reality, verified on-chain by `eth_call` simulation on 2026-05-11:

```
eth_call({from: CSW, to: CSW, data: executeWithoutChainIdValidation([…])})
  → revert 0x82b42900  // selector for Unauthorized()
```

The CSW's `executeWithoutChainIdValidation` is `onlyEntryPoint`-gated:

```solidity
function executeWithoutChainIdValidation(bytes[] calldata calls)
  public payable onlyEntryPoint { … }

modifier onlyEntryPoint() {
  if (msg.sender != entryPoint()) revert Unauthorized();
  _;
}
```

When the CSW broadcasts a tx to itself, `msg.sender === csw ≠ entryPoint`,
so the modifier reverts. Base App's gas estimator catches this revert during
pre-simulation and surfaces it as the misleading "make sure you have enough
funds" warning (the wallet can't compute a gas estimate for a tx that always
reverts, so it falls back to a generic insufficient-funds string).

The other `execute` / `executeBatch` methods on CSW are
`onlyEntryPointOrOwner`-gated, which checks `_isOwner(msg.sender)` — i.e.
the call must come from a stored owner. The CSW is NOT one of its own owners
unless explicitly added (verified: owners[0..3] on our reference CSW are a
passkey + 3 EOAs, none equal to the CSW itself). So `executeBatch` from CSW
to itself reverts identically.

**The only way to reach any of these methods is via a UserOp through the
EntryPoint.** That means a bundler. Which means `wallet_prepareCalls` (blocked
in-app) or the funder-EOA Relay lane.

Do not re-attempt this lane.

## Open questions for future work

- The first iteration of PR #578 implements Mode 2 fully but Mode 1 only via
  the existing `personal_sign` lane (no direct WebAuthn). Once we verify the
  funder-EOA submission lane works end-to-end, the next PR should replace the
  `personal_sign` signing path with `navigator.credentials.get(...)` directly
  to truly unlock the passkey from any browser, including in-app.
- The execution receipt format should be a single URL parameter so the
  workflow is shareable via QR code or message. We could also persist it in
  Supabase for cross-device handoff (sign on phone, submit from laptop).
- We currently always quote with origin = destination = Base. Once Mode 2 is
  validated, expose an "origin chain" selector so users can fund from cheaper
  L2s (Optimism, Arbitrum) or from mainnet.
