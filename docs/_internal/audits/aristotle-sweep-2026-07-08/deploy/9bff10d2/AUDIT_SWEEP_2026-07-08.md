# Security Sweep — shared deploy batchers / factories / infra

Date: 2026-07-08
Scope: `batchers/`, `factories/`, `infra/` (12 Solidity files, ~4,180 LOC).
Baseline: prior audit fixes (`F-*`, `M-*`, `AUDIT-2026-07-01-*`, `4626-*`, `L-02`) are already
applied in-tree; this sweep looks for issues that remain after them.

Severity scale: High = attacker (or under-privileged actor) can cause loss / persistent
privilege escalation on live assets; Medium = conditional loss / requires a semi-trusted role
or a narrow window; Low/Informational = hardening / robustness, no direct exploit.

---

## H-1 (High) — Permissionless privileged wiring during the deploy window  *(FIXED)*

File: `batchers/DeploymentBatcher.sol`
Functions: `whitelistPayoutRouterOnWrapper`, `setPayoutRouterShareOftNoFees`

Both functions were declared `external` with **no caller authorization**. Their only guard was
that the *target* wrapper / ShareOFT is currently owned by the batcher — which is exactly true
during the multi-transaction deploy window (between `finalizePhase1WithSalt` and
`finalizePhase2`, which spans several blocks).

Impact during that window, callable by anyone:

* `setPayoutRouterShareOftNoFees(shareOFT, attacker)` → `ICreatorShareOFT(shareOFT).setAddressType(attacker, 2)`
  marks an **arbitrary address fee-exempt (`NoFees`)** on the newly deployed ShareOFT. This is a
  **persistent** privilege that survives the ownership transfer to the treasury at finalize, so
  the attacker permanently bypasses that token's transfer fee/tax logic.
* `whitelistPayoutRouterOnWrapper(wrapper, attacker)` → adds an arbitrary address to the wrapper
  whitelist, bypassing the wrapper's intended access gating.

An attacker only needs to watch the mempool for a deployment in progress and insert one call.

Fix (applied): gate both with the existing `onlyProtocolTreasury` modifier (the protocol
treasury / automation Safe is the actor that drives the deploy script; every other admin-wiring
setter in this contract already uses it). Tagged `FIX: SWEEP-2026-07-08-H1`.
If instead these must be callable by the deployment *owner*, add an `owner` argument and verify
`msg.sender == owner` against `phase1SplitStates[deriveBaseSalt(...)]`; do not leave them open.

---

## M-1 (Medium) — `ccaLaunchArm` is unvalidated in VaultActivationBatcher

File: `batchers/VaultActivationBatcher.sol`
Function: `_executeActivateAndLaunch` (reached by all `batchActivate*` entrypoints)

The `AUDIT-2026-07-01-M16` fix (`_validateRegistryRouting`) forces the caller-supplied `vault`
and `wrapper` to equal the registry's canonical records for `creatorToken`. **`ccaLaunchArm` is
not validated** against any canonical source, yet it receives an ERC-20 approval and a call:

```solidity
IERC20(shareToken).forceApprove(ccaLaunchArm, auctionAmount);
... ICCAStrategy(ccaLaunchArm).launchAuction(auctionAmount, ...);
```

In the identity-funded path `batchActivateWithPermit2For(...WithReserve)`, an account that the
identity has authorized only for `OP_ACTIVATE` can pass a **malicious `ccaLaunchArm`** and set
`auctionPercent` up to 100. The identity's freshly minted share tokens are approved to that
contract, which can `transferFrom` them out — i.e. the operator diverts up to 100% of the
identity's auction allocation to an attacker contract. This defeats the purpose of the M16
routing check, which was added precisely to stop operators from redirecting an activation.
(The self-funded `batchActivate` path is not a cross-user theft because the caller funds it; the
`FromOperator` path funds from the operator; the reserve recipient is already pinned to
`identity`. The exploitable case is the identity-funded operator call.)

Fix: validate the CCA arm the same way as vault/wrapper. Preferred:
```solidity
if (ccaLaunchArm != ICreatorOVaultCcaView(vault).ccaLaunchArm()) revert CcaLaunchArmMismatch(...);
```
using the value the batcher already wired via `ICreatorOVault(vault).setCcaLaunchArm(...)`, or add
a canonical `ccaLaunchArm` getter to `IRegistry4626` and check against it. Do this inside
`_validateRegistryRouting` so every entrypoint is covered.

---

## L-1 (Low) — Module codehash allowlist is optional (delegatecall hot-swap)

File: `batchers/DeploymentBatcher.sol`
Functions: `_validatePhaseModuleCodehash`, `setPhase1Module`, `setPhase2Module`

`phase1Module` / `phase2Module` are invoked with `delegatecall` (they execute against the
batcher's storage). Hot-swap is `onlyProtocolTreasury` and requires the replacement's immutable
`batcher()` to equal `address(this)`, but the codehash allowlist added in `AUDIT-2026-07-01-M17`
is a **no-op when unset**:

```solidity
function _validatePhaseModuleCodehash(address module) internal view {
    bytes32 expected = approvedPhaseModuleCodehashes[module];
    if (expected == bytes32(0)) return; // <- silently skips
    ...
}
```

So a mis-set or compromised treasury key can point the delegatecall target at arbitrary code
without any codehash pin. This is a trust-in-treasury / defense-in-depth issue, not an outsider
exploit. Recommend making the pin mandatory: revert if `expected == bytes32(0)` in
`setPhase1Module` / `setPhase2Module` (require the codehash to be approved first).

---

## L-2 (Low) — Unbounded `abi.decode` of external metadata can brick registration

File: `factories/OVaultFactory4626.sol` (deprecated), `_registerWithRegistry`

`name()` / `symbol()` are fetched with `staticcall` and then `abi.decode(data, (string))` only
guards the `success` flag, not decodability. A token whose `name()` returns `success == true`
with malformed/oversized ABI data makes `abi.decode` revert, blocking `registerDeployment`.
Low impact (contract is deprecated, and `creatorToken` is chosen by an authorized deployer).
Fix: wrap the decode in `try`/`catch` via an interface call, or length-check `data` before
decoding.

---

## Informational

* **I-1** `finalizePhase2` accepts caller-supplied `gaugeController` / `ccaLaunchArm` / `oracle`
  validated only by `code.length > 0` (not bound to `p1state` or the registry). It is gated by
  `_requireOwner(params.owner)` so it is self-affecting only, but binding these to the canonical
  Phase-2 outputs would prevent an owner from wiring a mismatched set by mistake.
* **I-2** `finalizePhase2Execution` calls `forceApprove(wrapper, depositAmount)` before
  `deposit`; if the wrapper ever consumes less than the full amount a residual allowance from
  the batcher to the wrapper is left dangling. Consider a trailing `forceApprove(wrapper, 0)`.
* **I-3** `infra/UniversalBytecodeStore*.store` is permissionless. This is safe because
  `codeId == keccak256(creationCode)` (content-addressed, append-only, no overwrite), so it
  cannot be poisoned; noted only to confirm it was reviewed.
* **I-4** `MAX_DEPOSIT`/`MIN_DEPOSIT` getters on the `DeploymentBatcher` shell are documented as
  informational and can disagree with the enforced bounds in the hot-swappable
  `DeploymentBatcherPhase2Module` (`MIN/MAX_FIRST_DEPOSIT`). Enforcement is in the module; the
  shell getters are cosmetic. No action required beyond the existing docstring.

## Areas reviewed and found sound

* CREATE2 deployers (`factories/Create2Deployer.sol`,
  `factories/UniversalCreate2DeployerFromStore.sol`): access control (`F-13`, `F-22`) present;
  `computeAddress` / `create2` handling and the `try`/`catch` re-deploy path in Phase-1 finalize
  are correct.
* Delegatecall module isolation: Phase-1/Phase-2 modules declare **only immutable** state (no
  storage slots), so delegatecalling them cannot clobber batcher storage; each module guards with
  `address(this) == batcher` (delegatecalled) and the non-delegatecalled helpers guard with
  `msg.sender == batcher`.
* `nonReentrant` coverage on all fund-moving batcher entrypoints; native-fee refund in
  `_bridgeShareAllocationToSolana` is inside the outer `nonReentrant` and refunds `msg.sender`.
* Charm factory governance/protocol-fee/manager fail-closed checks (`StrategyDeploymentBatcher`,
  `DeploymentBatcherPhase3Helper`) and the `Base-only` (`chainid == 8453`) construction guards
  (`L-02`).
* No `tx.origin`, `selfdestruct`, raw `.transfer`/`.send`, or `ecrecover` misuse anywhere in scope.
