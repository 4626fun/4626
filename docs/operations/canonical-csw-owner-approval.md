---
title: Canonical CSW Owner Approval
sidebar_position: 7
---

# Canonical CSW Owner Approval

:::caution Scope
This runbook describes the **legacy direct owner-install** activation path.

For **user-initiated frontend execution** (swaps, vault interactions) the current path is sub-account setup, not direct owner delegation — see [4626 Connection Methods](/4626-connection-methods) Section 2. Under the current model the embedded EOA is routed as the *sub-account's* signer via `setToOwnerAccount()` rather than installed as an owner on the parent CSW.

This runbook still applies to:

- The **server-side owner-delegation** track (deploy-session automation and agent identity per `.cursor/rules/csw-agent-lifecycle.mdc`). Note that for that track the delegated owner is a Privy *server wallet*, not the user's embedded EOA, and different endpoints apply.
- Legacy debugging of any activation surface that has not yet migrated to sub-accounts.

Canonical wallet invariants: `.cursor/rules/ERC-4337-Wallet-Invariants.mdc`.
:::

This runbook describes the legacy owner-install step that predates the sub-account execution track. New waitlist/account activation should use the sub-account flow for user-initiated execution.

The product model is fixed:

- the Zora/Base Coinbase Smart Wallet (CSW) remains the canonical asset-holding account
- the Privy embedded EOA is the account-scoped signer created by 4626
- under the legacy model, activation completes by adding the Privy embedded EOA as an owner on the canonical CSW; under the current model, it completes by binding the embedded EOA as the sub-account signer per [4626 Connection Methods](/4626-connection-methods)
- no flow may require exporting or recovering the private key / seed phrase for a Zora-created embedded wallet

## Outcome

The legacy owner-install step is successful only when:

1. the active 4626 user has a verified email and a Privy embedded EOA
2. the canonical CSW is resolved for that account
3. `addOwnerAddress(privyEmbeddedEoa)` is approved on Base
4. `/api/wallet/confirm-owner` confirms the embedded EOA is now an onchain owner of the canonical CSW

This moves a legacy account from linked/setup-only into the `legacy-owner-install` execution track. Current accounts should become user-execution-ready through a distinct registered sub-account instead.

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

### Current self-auth behavior

Canonical self-auth no longer falls through to parent-CSW owner install for user-initiated execution. When the connected wallet is the canonical CSW, activation must create or hydrate the app-scoped sub-account and bind the Privy embedded EOA with `setToOwnerAccount()`. If that sub-account path is canceled or mismatched, setup stops cleanly.

Server-side agent/deploy-session owner installation is separate and uses `eth_sendTransaction` for the CSW self-call. Do not use `wallet_sendCalls` for `addOwnerAddress`.

## Confirmation states

`POST /api/wallet/confirm-owner` now returns `confirmationState` alongside
`isOwner` so clients can distinguish indexing delay from terminal failures.

Possible values:

- `owner_confirmed` — owner is installed onchain
- `pending_tx` — submitted tx not confirmed yet across configured Base RPCs
- `owner_not_found_yet` — tx is confirmed/unknown but owner not indexed yet
- `tx_failed` — tx is confirmed failed/reverted

UI and retry behavior should use this state, not only `isOwner`.

## Execution track (read via `/api/onboarding/bootstrap` or `/api/accounts/me`)

For reading account state, prefer the `executionTrack` field returned by both
endpoints over deriving the track from individual signals. Possible values:

- `sub-account` — real sub-account is persisted (`profiles.base_sub_account`
  is set and differs from `profiles.csw_address`), and the Privy embedded EOA
  is NOT a direct owner of the parent CSW. This is the current-model shape
  for new accounts.
- `legacy-owner-install` — Privy embedded EOA IS a direct owner of the parent
  CSW (the pre-migration path covered by this runbook), and no real
  sub-account is persisted. Fully functional. Your account may be here if
  it was activated before the sub-account migration landed.
- `migration-pending` — both signals are present. A legacy account that
  subsequently set up a sub-account. The client should prefer the
  sub-account path for new transactions; cleanup of the redundant direct
  ownership can be done later (and is non-urgent).
- `none-yet` — neither signal is present. The account has authenticated but
  has not completed user-facing activation on either track.

Server-side agent / deploy-session delegation is an **orthogonal track**
(see `.cursor/rules/csw-agent-lifecycle.mdc`). The `executionTrack` field
here only describes the user-initiated frontend execution track.

The classifier is pure and unit-tested in
`frontend/server/_lib/wallet/executionTrack.ts`.

## Observability contract

Owner approval emits one run-scoped telemetry stream using `approvalRunId`.

Stage set:

- `preflight`
- `prepare`
- `userop_typed`
- `userop_nontyped`
- `send_calls`
- `confirm_owner`

Each stage event records: run id, stage, status (`start|retry|success|error`),
attempt, execution mode, signer, canonical CSW, and terminal code/message when
available. This is the primary production debugging surface.

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

### Owner-index drift

Symptoms:

- signer is an onchain owner but AA execution still fails
- retries with the same owner index continue to fail

Meaning:

- runtime owner index is stale versus current canonical CSW owner ordering

Action:

- follow `docs/operations/deployment/csw-owner-index-drift-recovery.md`

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
- `docs/operations/deployment/csw-owner-index-drift-recovery.md`
