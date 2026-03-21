# Canonical Ajna Keeper (Creator CSW-Sent) Design

Date: 2026-03-10
Status: Approved
Owner: Frontend Platform + CRE

> Historical note (2026-03-20): this design predates the current email-first account model. The verified email is now the canonical 4626 identity. In this document, "canonical account" should be read as "canonical execution wallet (CSW)." See [frontend/docs/account-auth-invariants.md](/home/akitav2/projects/4626/frontend/docs/account-auth-invariants.md).

## Context

The repo already enforces a canonical wallet invariant:

- the creator's canonical Coinbase Smart Wallet (CSW) is the canonical execution wallet for onchain actions
- Privy EOAs and Privy smart wallets are signer/owner identities, not the canonical asset-holding account
- ERC-4337 UserOps should use the canonical CSW as the sender/account of record

The nested Ajna integration is now the only supported Ajna model in the repo:

```text
CreatorOVault
  -> ERC4626StrategyAdapter
    -> AjnaERC4626Vault
      -> AjnaVaultAuth
      -> AjnaVaultBuffer
      -> Ajna pool
```

Current automation does not align with the desired wallet model:

- `CRE` is single-wallet today and assumes one configured keeper EOA or one configured ERC-4337 smart wallet
- Ajna automation is modeled as a generic keeper actor rather than "the creator's canonical wallet acting through an offchain executor"
- there is no persisted per-vault signer context that ties a vault to the creator's canonical CSW plus the Privy embedded signer that can operate it

The desired direction is to keep the creator's canonical CSW as the canonical onchain actor for Ajna automation and make the offchain keeper service only the orchestrator that signs through the same `Privy embedded EOA -> canonical CSW` relationship already used elsewhere in the product.

## Goals

- Keep the creator's existing canonical Coinbase Smart Wallet as the canonical sender for Ajna automation.
- Use the existing Privy embedded EOA relationship as the signing bridge into that canonical CSW.
- Make Ajna automation opt-in, revocable, and auditable per vault.
- Refactor `CRE` from a single-wallet keeper into a per-vault canonical-sender router.
- Start with the smallest safe canonical-wallet automation surface and expand only after the signer plane is proven.

## Non-Goals

- No protocol co-owner added to creator wallets.
- No fallback to a protocol wallet, generic keeper EOA, or alternate sender when canonical execution fails.
- No arbitrary wallet execution from creator CSWs.
- No broad reuse of this signer plane outside Ajna automation in v1.
- No automatic migration of creators whose canonical wallet identity changes.

## Chosen Approach

Per-vault canonical-wallet automation using the same identity split already present in the repo:

- sender: the creator's existing Zora-linked canonical Coinbase Smart Wallet
- signer bridge: the creator's Privy embedded EOA (or equivalent Privy server signer handle) that is an onchain owner of that CSW
- executor: the offchain Ajna keeper service, which resolves the correct signer context per vault and submits the UserOp from the canonical CSW

This means the keeper is "the creator's canonical wallet" in the onchain sense, while the backend service is only a multi-tenant execution plane.

This is preferred over:

1. A separate automation wallet, because that breaks the product goal that the canonical CSW is the actor.
2. Protocol co-ownership of creator wallets, because that introduces unnecessary custody risk.

## Architecture

The platform needs a new first-class concept: `vault automation signer context`.

Each opted-in vault stores:

- `vault_address`
- `profile_id`
- `canonical_csw_address`
- `embedded_eoa_address`
- `privy_wallet_id` or equivalent signer handle
- `authorization_source` (initially `privy_embedded_eoa`)
- `automation_enabled`
- `automation_scope`
- `last_owner_check_at`
- `revoked_at`
- vault-specific Ajna metadata:
  - `ajna_adapter_address`
  - `ajna_inner_vault_address`
  - `ajna_auth_address`
  - `ajna_pool_address`
  - `oracle_address`

At runtime, `CRE` no longer answers "what is the keeper wallet?" globally. Instead, for each vault action it answers:

1. Which creator/vault is this action for?
2. What canonical CSW should be the sender?
3. Which Privy-backed embedded EOA is allowed to sign for that CSW?
4. Is automation still enabled and still within scope?

This is a multi-tenant signer-router design, not a singleton keeper-wallet design.

## Consent And Security Model

Automation is off by default and must be explicitly enabled per vault.

Consent binds together:

- creator profile
- vault address
- canonical CSW address
- embedded EOA signer identity
- Ajna contract addresses for that vault
- granted automation scope

Revocation must be immediate and simple:

- creator disables automation in the app, or
- owner relationship between embedded EOA and canonical CSW can no longer be proven

Every action must be audit-logged with:

- creator/profile identifier
- vault address
- sender CSW
- embedded EOA signer
- target contract
- selector
- args hash
- tx hash / UserOp hash
- decision reason / workflow name

The critical rule is that the backend never receives open-ended authority over the creator's wallet. It can only submit an allowlisted set of Ajna maintenance calls for the vaults whose signer contexts explicitly permit it.

## Allowed Action Surface

### V1

Only allow the smallest safe nested Ajna policy action:

- `AjnaVaultAuth.setMinBucketIndex(uint256)`

This gives us canonical-wallet execution without immediately granting the full move surface.

### Later Expansion

If the canonical signer plane proves stable, expand to the full nested Ajna keeper surface:

- inner-vault rebalance calls like `move`, `moveToBuffer`, and `moveFromBuffer`

Even then, execution remains constrained to:

- registered vault Ajna contracts only
- allowlisted selectors only
- healthy-state keeper runs only

## Backend And Runtime Flow

### Launch-time

When a creator launches a vault:

1. Resolve and persist canonical wallet identity:
   - canonical CSW
   - Privy embedded EOA
2. Ask for explicit consent to enable Ajna automation from that canonical wallet.
3. Persist the vault automation signer context with the initial scope.
4. Persist the vault's Ajna topology addresses.

### Keeper-time

For each Ajna evaluation or action:

1. Select a vault that requires evaluation.
2. Load its automation signer context.
3. Verify automation is enabled and not revoked.
4. Verify the embedded EOA is still an owner of the stored canonical CSW.
5. Verify the target contract and selector are allowed for that vault and scope.
6. Simulate as the canonical CSW sender.
7. Sign via the stored Privy-backed embedded EOA.
8. Submit the UserOp with `sender = canonical_csw_address`.
9. Persist the audit trail and result.

If any canonical-wallet invariant cannot be proven, the keeper does nothing.

## Failure Handling

Hard-stop conditions:

- embedded EOA is no longer an owner of the canonical CSW
- Privy signer is unavailable, revoked, or mismatched
- stored Ajna addresses no longer match onchain or deployment records
- requested selector is outside the vault's automation scope
- simulation fails for the canonical sender
- repeated permission or execution failures trip a per-vault circuit breaker

There is no fallback sender. Failure means skip, log, and alert.

## Rollout Plan

### Phase 0: Persistence only

- add signer-context storage and consent state per vault
- no automated sends

### Phase 1: Manual canonical send

- prove one operator-triggered `setMinBucketIndex` path from the creator's canonical CSW using the stored Privy signer context

### Phase 2: Scheduled canonical policy automation

- let `CRE` run the existing nested Ajna `setMinBucketIndex` flow on a schedule for opted-in vaults

### Phase 3: Full canonical Ajna keeper

- evaluate expansion to the upstream move surface (`move`, `moveToBuffer`, `moveFromBuffer`) from the canonical CSW

## Risks And Mitigations

- Multi-tenant signer routing is materially more complex than today's single-wallet `CRE`.
  - Mitigation: phase the rollout and prove the canonical sender model manually before scheduling it.
- Privy signer drift could silently make automation unsafe.
  - Mitigation: re-check owner relationship before every send and auto-disable on mismatch.
- Canonical-wallet execution could expand beyond Ajna accidentally.
  - Mitigation: enforce vault-scoped target/selector allowlists server-side and refuse arbitrary calldata.
- Operators may expect a fallback keeper wallet when canonical execution fails.
  - Mitigation: explicitly forbid fallback senders in both code and docs.

## Verification

Success for the initial implementation means:

- vault launch persists per-vault canonical signer context
- automation can be enabled and revoked per vault
- a manual `setMinBucketIndex` action can be submitted from the creator's canonical CSW through the stored Privy signer context
- `CRE` resolves sender context dynamically per vault instead of using one global smart wallet
- every failure mode hard-stops without falling back to a non-canonical sender

Required verification for implementation:

- frontend/API tests for signer-context persistence, consent toggles, and canonical-wallet validation
- `CRE` unit tests for dynamic sender resolution, owner revalidation, selector allowlists, and audit logging
- at least one end-to-end proof on a test/staging vault where the tx sender is the creator's canonical CSW
