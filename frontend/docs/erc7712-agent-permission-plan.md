# ERC-7712 Permission Plan for CreatorVault Agent Stack

This document proposes how to map ERC-7712-style delegated permissions onto the current deploy-session and agent architecture.

## Current baseline (today)

Today, deploy sessions execute server-submitted UserOps in phases (`phase1*`, `phase2*`, `phase3*`, `phase4*`) after a temporary owner path is established for the CSW deploy flow.

Because legacy sessions may not always have valid owner credentials, current handlers now include fallbacks and defensive behavior.

## Goal with ERC-7712

Replace broad temporary-owner authority with narrowly scoped, revocable grants so agents can only do explicitly allowed actions for a limited time window.

## Permission profiles

### 1) Deploy Session Permission (short-lived)

**Purpose**: allow deploy orchestrator calls only for one creator token deployment.

Suggested constraints:

- `validAfter`: now
- `validUntil`: now + 10 minutes (same as current deploy-session TTL)
- `nonce`: deploy-session-specific nonce
- `targets` (allowlist):
  - `creatorVaultBatcher`
  - `vaultActivationBatcher`
  - any protocol deploy helper addresses required by current phase calls
- `function selectors` (allowlist):
  - phase execution selectors currently emitted into `phase1*`, `phase2*`, `phase3*`, `phase4*` call arrays
  - owner-cleanup selector used by cancel/attach-cleanup path (so cleanup is also permission-scoped)
- `value limit`: 0 or bounded max (if nonzero value calls are expected)
- `call count`: bounded (e.g., <= number of planned stage calls)
- `chainId`: 8453 only

### 2) Cancel/Cleanup Permission (short-lived)

**Purpose**: allow only owner-cleanup operation for the active deploy session.

Suggested constraints:

- `validUntil`: short TTL (e.g., 5 minutes)
- target only: CSW account contract
- selector only: owner cleanup/remove function used by cancel path
- `chainId`: 8453 only

### 3) Agent Ops Permission (medium-lived)

**Purpose**: allow CSW-based agent operations (XMTP-side actions) without broad owner access.

Suggested constraints:

- limited target contracts for approved ops
- per-method spend/volume caps
- optional daily budget windows
- explicit revocation path from user settings

## Mapping to current deploy phases

Use existing phase payload structure and convert each stage to an ERC-7712 permission envelope:

- `phase1Calls`
- `phase2CoreCalls`
- `phase2FinalizeCalls`
- `phase2Calls` (legacy)
- `phase3Calls`
- `phase4Calls`

Each stage execution should verify that every call is within the grant’s target+selector constraints before signing/sending UserOps.

## Rollout strategy

1. **Dual path (recommended first step)**
   - Keep existing owner-based fallback.
   - Prefer ERC-7712 permission path when a valid grant exists.

2. **Feature gate**
   - Add env flag (example): `DEPLOY_USE_7712_PERMISSIONS=true`.
   - Roll out to internal users first.

3. **Telemetry**
   - Track permission grant creation failures, grant-expired errors, and fallback frequency.

4. **Decommission broad owner flow**
   - Once stable, restrict owner-install/remove flow to explicit emergency fallback only.

## UX recommendations

- During deploy start, present user-readable permission summary:
  - allowed contracts
  - expiry time
  - max spend/value
  - revoke control
- Expose active grants and revoke button in deploy/settings UI.

## Security checklist

- Grants must be chain-bound (8453).
- Grants must include nonce/replay protection.
- Grants should be shortest practical TTL.
- Enforce strict target+selector allowlist.
- Log every permissioned execution (session id, user, grant id, calls).
- Add explicit emergency revoke flow.

## Why this helps this repo specifically

- Reduces dependence on temporary owner credential state during deploy session lifecycle.
- Minimizes blast radius of compromised server/agent signing context.
- Aligns with CSW + Privy signing model already used for agent identity.


## Standards references (authoritative)

- ERC-4337 / Account Abstraction: https://eips.ethereum.org/EIPS/eip-4337
- EIP-712 Typed Structured Data: https://eips.ethereum.org/EIPS/eip-712
- ERC-1271 Contract Signatures: https://eips.ethereum.org/EIPS/eip-1271
- EIP-6492 Signature Validation for Predeploy Contracts: https://eips.ethereum.org/EIPS/eip-6492
- EIP-2612 ERC-20 Permit: https://eips.ethereum.org/EIPS/eip-2612
- ERC-20 Token Standard: https://eips.ethereum.org/EIPS/eip-20
- ERC-4626 Tokenized Vaults: https://eips.ethereum.org/EIPS/eip-4626

> Note: if ERC-7712 semantics evolve, update this plan only against canonical EIP text and final status at eips.ethereum.org.
