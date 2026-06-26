---
name: 4626-onchain-vaults
description: Onchain and vault operations skill for 4626. Use for Solidity, Foundry, deployment pipelines, OFT wiring, VRF, and strategy allocation with preflight-first execution, invariant checks, and standalone runbook detail when repository access is limited.
---

# 4626 Onchain and Vaults

## When to Use This Skill

Use for contract-level changes and deployment/operations tasks involving vault infrastructure, OFT cross-chain wiring, lottery VRF, and strategy management.

Trigger when the user asks to change Solidity/Foundry logic, deployment behavior, OFT/VRF configuration, payout routing, or strategy allocation behavior.

## System Model

- **Vault stack:** vault, wrapper, share token, gauge, launch strategy, oracle.
- **Deployment model:** infrastructure deploy, phased deploy, activation, strategy configuration.
- **Cross-chain model:** OFT peers must be configured bidirectionally.
- **Randomness model:** local or cross-chain VRF mode with explicit configuration state.
- **Strategy model:** weighted allocation, debt accounting, and withdrawal/liquidity constraints.

Core invariants:

1. Creator Coin and Share token identity stay distinct in logic and output.
2. Deployment changes must preserve canonical ownership assumptions.
3. Read-only preflight is mandatory before any write path.
4. High-risk surfaces (bridge, accounting, fee routing) require explicit verification.

## Required Inputs

1. Target chain(s) and environment.
2. Read-only analysis vs write/deploy action.
3. Ownership/authority path.
4. Migration and rollback constraints.
5. Blast radius expectation (single vault vs shared infra).

## Instructions

1. Preserve all hard invariants listed above.
2. Prefer smallest contract-surface change necessary.
3. Use current deploy surfaces:
   - Foundry infra deploy scripts
   - frontend AA deploy flow (`DeployVault.tsx`)
   - multi-phase deployment batcher
4. Perform read-only preflight snapshot before any write:
   - chain identity, owner/admin identity
   - already-deployed state
   - OFT peers both directions
   - VRF mode and endpoint pointers
5. Verify approvals/allowances before strategy or launch paths.
6. Build execution plan by phase:
   - preflight reads
   - write actions (if approved)
   - post-write reads
7. Run:
   - `forge build`
   - `forge test`
   - and frontend checks if UI/API deploy paths are touched.

8. Report:
   - preflight snapshot
   - change set
   - verification evidence
   - rollback posture

## Examples

### Example: OFT Peer Mismatch Fix

- Input:
  - issue: cross-chain message rejection
  - scope: OFT peer wiring
- Expected output:
  - preflight snapshot showing current peers
  - bidirectional correction plan
  - post-change read verification steps

### Example: Strategy Allocation Update

- Input:
  - scope: vault strategy weights and idle reserve
  - constraints: preserve withdrawal safety
- Expected output:
  - invariant-sensitive change set
  - required approvals/allowances checklist
  - forge verification evidence

### Example: No-Repo Fallback

- Input:
  - no repository access, only deployed addresses and desired behavior
- Expected output:
  - read-only-first plan
  - explicit assumptions
  - no unsafe write recommendation without ownership path

## Common Errors

- Wrong: Use retired deploy pathways from historical scripts.
  Correct: Use current deploy surfaces and phased execution.
- Wrong: Configure OFT peers only on one side.
  Correct: Verify bidirectional peer wiring.
- Wrong: Assume approvals/allowances already exist.
  Correct: Check and list required approvals before writes.
- Wrong: Plan writes before preflight reads.
  Correct: Capture chain/owner/deploy state first.
- Wrong: Provide write actions without rollback posture.
  Correct: Include explicit rollback conditions and verification reads.

## Sources

- `AGENTS.md`
- `.cursor/skills/vault-deployment/SKILL.md`
- `.cursor/skills/deploy-vault-operator/SKILL.md`
- `.cursor/skills/yield-strategy-management/SKILL.md`
- `.cursor/skills/lottery-vrf-ops/SKILL.md`
- `.cursor/skills/oft-chain-config/SKILL.md`
- `script/agent-runtime/skills/contracts-change/SKILL.md`
