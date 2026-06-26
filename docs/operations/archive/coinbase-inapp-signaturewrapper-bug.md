---
title: Coinbase In-App SignatureWrapper Bug
status: historical
doc_template: runbook
---

# Coinbase Wallet in-app browser: wrong owner index/signer wrapper

This document is migrated from root `RECOVERY_INAPP_BUG.md` so incident records live under `docs/operations`.

## Summary

When a dApp loaded inside Coinbase Wallet’s in-app browser calls `eth_signTypedData_v4` against a connected canonical CSW, the wallet can return a 224-byte `SignatureWrapper(ownerIndex, signatureData)` that:

1. Claims an on-chain owner index (example observed: `ownerIndex = 2`)
2. Contains `signatureData` that recovers to an address that is **not** the owner at that index (and in repro, not an owner at all)

Result: `isValidSignature` fails on-chain and wallet preflight blocks transaction submission with a misleading “not enough funds / error generating transaction” surface.

## Repro (observed)

> **Note:** Repro captured against pre-migration CSW `0x4beabd…04ef` (April 2026). Current canonical CSW is `CANONICAL_CSW_ADDRESS` (`0xAb6d5…967b5`); signature-path behavior applies to any CSW.

- Environment: Coinbase Wallet Android in-app browser (Chrome WebView)
- CSW (historical repro): `0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef` on Base
- Probe route: `/dev/toshi-probe`

Observed behaviors in this session:

- `eth_requestAccounts`: works
- `wallet_getCapabilities`: works
- `eth_signTypedData_v4`: returns wrapped signature, but owner/signer mismatch
- `wallet_prepareCalls`: fails (`ProviderRpcError(1000, "Failed to fetch RPC request")`)
- `wallet_sendCalls` / `eth_sendTransaction`: review sheet shown, then preflight failure

## Expected behavior

Either:

- sign using a credential that matches the declared on-chain owner index, or
- fail explicitly with a deterministic “session has no installed owner” error

Current behavior is misleading for users and blocks owner mutation flows in in-app browser contexts.

## Workaround in product

On `/add-owner`, when in Coinbase in-app browser, prefer explicit “Open in browser” guidance instead of attempting owner-install submission inline.

## Related

- `docs/operations/csw-recovery-playbook.md`
- `docs/operations/relay-sponsored-owner-mutation-flow.md`
- `scripts/recovery/decode-userop-signature.mjs`
