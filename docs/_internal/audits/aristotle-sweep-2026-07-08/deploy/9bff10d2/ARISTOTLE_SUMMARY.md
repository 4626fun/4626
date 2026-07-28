# Summary of changes for run d0b724ac-b020-4f55-85b1-bb4fedd78ba0
Completed a full security sweep of the shared deploy contracts in `batchers/`, `factories/`, and `infra/` (12 Solidity files, ~4,180 LOC), building on the fixes already applied in-tree. Findings, concrete severities, and fixes are written to `AUDIT_SWEEP_2026-07-08.md`.

Key results:

- H-1 (High) — FIXED in `batchers/DeploymentBatcher.sol`. `whitelistPayoutRouterOnWrapper` and `setPayoutRouterShareOftNoFees` were permissionless; their only guard was that the target wrapper/ShareOFT is owned by the batcher, which holds throughout the multi-transaction deploy window. Any attacker watching the mempool could, during that window, mark an arbitrary address fee-exempt (`NoFees`) on a freshly deployed ShareOFT — a privilege that persists after ownership moves to the treasury — or whitelist an arbitrary address on the wrapper. I gated both behind the already-defined `onlyProtocolTreasury` modifier (consistent with every other admin-wiring setter), tagged `FIX: SWEEP-2026-07-08-H1`.

- M-1 (Medium) — reported with a concrete fix (not auto-applied because it needs a project interface method). In `batchers/VaultActivationBatcher.sol`, the M16 routing check validates caller-supplied `vault`/`wrapper` against the registry but not `ccaLaunchArm`, which still receives an ERC-20 approval and call. In the identity-funded Permit2 path, an account authorized only for `OP_ACTIVATE` can pass a malicious `ccaLaunchArm` and `auctionPercent` up to 100 to divert the identity's minted share tokens. Recommended fix: validate `ccaLaunchArm` against `vault.ccaLaunchArm()` (or a registry canonical) inside `_validateRegistryRouting`.

- L-1: the delegatecall module codehash allowlist is a no-op when unset (`setPhase1Module`/`setPhase2Module`); recommend making the pin mandatory.
- L-2: unbounded `abi.decode` of `name()`/`symbol()` can brick registration in the deprecated `OVaultFactory4626`.
- Informational: unbound gauge/cca/oracle in `finalizePhase2` (self-scoped), residual `forceApprove`, permissionless-but-content-addressed bytecode store (safe), and cosmetic MIN/MAX_DEPOSIT getters.

Also documented the areas reviewed and found sound: the CREATE2 deployers' access control and re-deploy path, delegatecall module storage isolation (modules hold only immutables) and their `address(this)==batcher` / `msg.sender==batcher` guards, `nonReentrant` coverage and the Solana bridge refund, Charm governance/fee fail-closed checks, Base-only construction guards, and the absence of `tx.origin`/`selfdestruct`/raw `transfer`/`ecrecover` misuse.

Note: this repo ships only Solidity sources (no Solidity build harness), so the applied edit was verified by inspection — it reuses an existing modifier and changes only the function visibility guard. Changes are committed and pushed.