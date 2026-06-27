---
title: Relay-Sponsored Owner Mutation Flow
status: historical
doc_template: runbook
---

# Relay-sponsored CSW owner-mutation flow

> **Current runbook:** [Relay owner-mutation kit guide](./relay-owner-mutation-kit-guide.md)

This document is migrated from root `RELAY_OWNER_MUTATION_FLOW.md` so runbooks live under `docs/operations`.

## Why this exists

Several iterations attempted to make `/remove-owner` fully in-wallet and one-click. The repeated failure mode was architectural:

- CSW owner mutation needs a valid owner-signed UserOp.
- Coinbase in-app browser has known constraints for privileged signing/prepared-calls paths.
- Funding and signing do not need to happen in the same wallet/session.

## Working architecture

Use two roles:

- **Wallet A (signer wallet)**: produces signed inner CSW UserOp (passkey/owner context)
- **Wallet B (funder wallet)**: broadcasts Relay-quoted outer tx with plain `eth_sendTransaction`

Relay quote shape should be funder/recipient split:

- `user = funder EOA`
- `recipient = CSW`
- destination execution still lands on CSW

This avoids requiring in-app `wallet_prepareCalls` from the funding side.

## Inner UserOp requirements

- `sender`: CSW
- replay-safe nonce strategy
- `callData`: owner-mutation call lane expected by CSW/EntryPoint path
- `paymasterAndData`: empty when solver pays lane is used
- signature must resolve to a real on-chain owner for declared owner index

## Two-session UX model

### Mode 1 — Sign

- Prepare mutation UserOp
- Sign in passkey-capable context
- Produce execution receipt payload (shareable URL/QR)

### Mode 2 — Submit

- Parse signed receipt
- Call `/api/relay/quote` with explicit `recipient = csw`
- Broadcast quote tx from funder wallet
- Poll relay intent status to final destination hash

## Do not do

- Hand-build `handleOps` and assume `/api/relay/execute` is the right lane for normal user flow
- Depend on in-app `wallet_prepareCalls` for this privileged lane
- Trust signature wrapper without verifying recovered signer against on-chain owner slot
- Force entire flow into one wallet context

## Current implementation anchors

- `frontend/api/_handlers/relay/_quote.ts`
- `frontend/api/_handlers/relay/_execute.ts`
- `frontend/src/lib/wallet/onboardingWalletReplayable.ts`
- `frontend/src/lib/removeOwner/removeOwnerHelpers.ts`
- `frontend/src/pages/RemoveOwner.tsx`

## Related

- `docs/_internal/operations/operations/wallet/relay-owner-mutation-kit-guide.md` — relay-kit + Privy example mapping, quote body templates, lane selection
- `docs/_internal/operations/operations/wallet/csw-recovery-playbook.md`
- `docs/_internal/operations/archive/coinbase-inapp-signaturewrapper-bug.md`
- `docs/_internal/wallet-notes/owner-mutation-decision-2026-05.md`
