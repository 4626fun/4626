---
title: CreatorOVault Module Immutability and Recovery
sidebar_position: 21
---

# CreatorOVault Module Immutability and Recovery

## Commitment

CreatorOVault modules (core, strategies, admin) are configured via `setModulesOnce`. Once set, the module addresses **cannot be changed** — there is no `setModules` or upgrade path. This is a deliberate product and security commitment: it prevents a compromised owner from swapping in malicious module logic post-deploy.

## Why immutable

The vault delegates all external function bodies to three module contracts via `delegatecall`. The modules execute against the vault's own storage. If module addresses were mutable, a single compromised owner key could silently replace all vault logic without redeploying the vault or migrating any funds.

Immutability means:
- **No facet replacement.** This is not a Diamond EIP-2535 pattern with upgradeable facets.
- **No owner-initiated logic swap.** `setModulesOnce` is literally one-way.
- **Module addresses are part of the vault's security identity.** They are set at deploy time and permanent.

## Bug recovery procedure

If a critical bug is found in a CreatorOVault module after `setModulesOnce` has been called, recovery is **not** a facet replacement. The recovery path is:

1. **Deploy a new vault** with corrected module contracts.
2. **Migrate funds and liquidity** from the old vault to the new vault:
   - Withdraw all assets from strategies (or `emergencyWithdrawFromStrategies`).
   - Transfer Creator Coin balances to the new vault.
   - Re-deploy idle funds to strategies in the new vault.
   - Transition liquidity positions (CCA pool, Uniswap V4 positions) to the new vault address.
3. **Remap frontend and indexer** to the new vault address:
   - Update `profiles.csw_address` or vault address references in the frontend.
   - Update indexer/keeper to track the new vault.
   - Update any on-chain references (gauge controller, lottery manager, fee router) to point at the new vault.

This is an operational migration, not a code-level hotfix. Plan for coordinated downtime and communication to holders.

## What cannot be done

- **Cannot swap modules.** `setModulesOnce` is one-way by design.
- **Cannot `delegatecall` to arbitrary code.** Only the three configured module addresses are used.
- **Cannot pause and patch.** `setPaused(true)` halts operations but does not change logic.

## Pre-deploy verification

Before calling `setModulesOnce`, verify:
1. Module contracts are compiled and audited.
2. Module addresses match the intended deployed bytecode (verify via `forge inspect` or on-chain code hash).
3. The vault's storage layout matches what the modules expect (storage slots are shared via `delegatecall`).
4. All module functions reachable through the vault's external interface have been tested via the vault (not just directly against the module).

## CI guards

Two static guards protect the vault's module-delegation pattern:

- **`pnpm guard:ovault-delegate-epilogues`** — ensures every `nonReentrant` external/public function calls `_delegateAndReturn()` (not `_delegate()`). Prevents the P1 DoS where an assembly `return` bypasses the `nonReentrant` epilogue and permanently locks the function.
- **`amoe/tools/ci/check_ovault_size_warn.sh`** — warns at 23,500 B and fails at 24,000 B. Ensures the vault stays deployable under the EIP-170 24,576-byte cap with a safety margin.

## References

- `contracts/vault/CreatorOVault.sol` — `_delegate()`, `_delegateAndReturn()`, `setModulesOnce()`
- `docs/operations/contract-size-gate.md` — EIP-170 size gate policy and CI wiring
- `docs/audits/x-ray/contract-audit-pass-2026-06.md` — June 2026 audit pass (module split rationale, size measurements)
- Commit `19ad35b21` — fix: migrateStrategy nonReentrant epilogue bypass (P1 DoS)
