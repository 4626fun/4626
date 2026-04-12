---
title: Canonical CSW Owner Approval
sidebar_position: 7
---

# Canonical CSW Owner Approval

This runbook describes the owner-install step used by the waitlist/account activation flow.

The product model is fixed:

- the Zora/Base Coinbase Smart Wallet (CSW) remains the canonical execution wallet
- the Privy embedded EOA is the account-scoped signer created by 4626
- activation completes by adding the Privy embedded EOA as an owner on the canonical CSW
- no flow may require exporting or recovering the private key / seed phrase for a Zora-created embedded wallet

## Outcome

The owner-install step is successful only when:

1. the active 4626 user has a verified email and a Privy embedded EOA
2. the canonical CSW is resolved for that account
3. `addOwnerAddress(privyEmbeddedEoa)` is approved on Base
4. `/api/wallet/confirm-owner` confirms the embedded EOA is now an onchain owner of the canonical CSW

This is what moves the account from linked/setup-only into wallet-ready execution.

## Canonical rule

Do not migrate the user onto a new smart wallet just because 4626 created an embedded EOA.

The canonical CSW from Base/Zora stays canonical. 4626 only adds its embedded EOA as an additional owner.

## Execution modes

The flow has two valid approval modes.

### 1. Canonical smart-wallet mode

Use this when the connected signer is the canonical CSW itself.

Expected shape:

- prepared tx target: canonical CSW
- calldata: `addOwnerAddress(privyEmbeddedEoa)`
- execution: Coinbase smart-wallet user-op / native smart-wallet send path

This is a smart-wallet self-call. `to == canonicalCswAddress` is expected in this mode.

### 2. External current-owner mode

Use this when the connected signer is a different wallet that is already an owner of the canonical CSW.

Expected shape:

- prepared tx target: canonical CSW
- calldata: `addOwnerAddress(privyEmbeddedEoa)`
- execution: direct Base transaction from the current owner wallet

## Current API boundaries

These endpoints are the stable contract for the flow:

- `POST /api/wallet/prepare-add-privy-owner`
- `POST /api/wallet/confirm-owner`

`prepare-add-privy-owner` returns a prepared call against the canonical CSW.

`confirm-owner` is the authoritative onchain confirmation step and must remain the truth source for whether the embedded EOA is installed.

## Current client execution boundary

Current implementation anchors:

- `frontend/src/features/accountSetup/useAccountSetupController.ts`
- `frontend/src/lib/wallet/onboardingWallet.ts`

Rules:

- canonical-smart-wallet execution must go through the repo-native ERC-4337 / Coinbase smart-wallet path
- direct-owner execution may use plain `sendTransaction`
- the client must not silently choose a stale linked wallet over the actually connected signer
- canonical-smart-wallet execution must reject prepared targets that do not match the canonical CSW

## Session and paymaster expectations

Canonical smart-wallet mode depends on a live 4626 session for the same-origin paymaster/bundler proxy.

Required behavior:

- bridge Privy auth into the 4626 app session before submitting the user-op
- prefer same-origin paymaster resolution
- surface smart-wallet/paymaster-specific errors instead of generic “insufficient funds” messaging when the sponsor session is stale or rejected

## Failure modes

### Wrong signer connected

Symptoms:

- owner check fails
- user sees “Connect owner wallet” / “not a current owner”

Meaning:

- the wallet is not an existing owner of the canonical CSW

### Base network mismatch

Symptoms:

- authority check cannot complete
- approval stays blocked

Meaning:

- the connected signer is not on Base

### Stale sponsor session

Symptoms:

- user-op path fails before submission
- paymaster/auth errors
- wallet UI may show misleading gas/funds errors

Meaning:

- the 4626 session used by the paymaster proxy is stale or missing

### Prepared target mismatch

Symptoms:

- canonical-smart-wallet path rejects before submit

Meaning:

- prepared owner-install payload does not target the canonical CSW and should be treated as invalid

## Support posture

If this flow is failing in production, collect:

1. the canonical CSW address shown in activation
2. the connected signer address shown in activation
3. whether the flow entered canonical smart-wallet mode or external current-owner mode
4. exact wallet prompt error text
5. whether `/api/wallet/confirm-owner` eventually returns `isOwner: true`

## Related docs

- `frontend/docs/account-auth-invariants.md`
- `frontend/docs/waitlist-accounts-architecture.md`
- `docs/guides/troubleshooting/activate-account-signing.md`
