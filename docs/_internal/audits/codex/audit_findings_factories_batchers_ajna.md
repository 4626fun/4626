# Security Audit: Factories, Batchers, Ajna, Registry

**Audited Contracts:** 18 files across batchers, factories, infra helpers, core registry, and Ajna 4626 vault  
**Scope:** Deployment safety, access control, reentrancy, registry integrity, bytecode store safety, Ajna integration, tax hook configuration, Permit2 integration, gas griefing  
**Solidity Version:** ^0.8.20  

---

## Summary Table

| ID | Severity | Contract | Title |
|----|----------|----------|-------|
| F-01 | HIGH | `DeploymentBatcher` | Arbitrary vault/wrapper/shareOFT accepted in Phase 2 — no origin binding |
| F-02 | HIGH | `DeploymentBatcher` | `pendingAuctions` can be bricked by repeated `finalizePhase2` with different `version` strings |
| F-03 | HIGH | `AjnaERC4626Vault` | `deposit` emits `netAssets` but charges fee on full `assets` — ERC-4626 event non-compliance leads to off-chain accounting errors |
| F-04 | HIGH | `AjnaVaultAuth` | Single-step admin transfer — `setAdmin` can permanently lock vault to zero/wrong address |
| F-05 | MEDIUM | `DeploymentBatcher` | `_finalizePhase1InternalSplit` — ShareOFT `catch` fallback silently reuses unrelated pre-deployed contract |
| F-06 | MEDIUM | `DeploymentBatcher` | Unbounded `_toLower` / `_toUpper` string loops — gas griefing via long `shareSymbol` |
| F-07 | MEDIUM | `VaultActivationBatcher` | `batchActivateWithPermit2For` — operator can front-run identity with a stale Permit2 signature |
| F-08 | MEDIUM | `AjnaERC4626Vault` | `totalAssets()` unbounded loop over `_buckets` array — gas exhaustion / DoS |
| F-09 | MEDIUM | `AjnaERC4626Vault` | `withdraw` and `redeem` are restricted to `swapper` only — breaks ERC-4626 standard compliance |
| F-10 | MEDIUM | `AjnaVaultLibrary.ensureBufferRatio` | Integer division truncation allows buffer drain to near-zero in specific conditions |
| F-11 | MEDIUM | `CreatorRegistry` | `setRemoteOFTPeer` can silently corrupt `remoteOFTToToken` reverse mapping on update |
| F-12 | MEDIUM | `TaxHookConfigurator` | No fee cap check in `configureCreatorPool` vs `updateFeeBps` — 10% cap bypass via initial config |
| F-13 | MEDIUM | `UniversalCreate2DeployerFromStore` | Any caller can deploy arbitrary bytecode from the store — missing deployer access control |
| F-14 | MEDIUM | `StrategyDeploymentBatcher` | `batchDeployStrategies` restricted to `protocolOwner` but `protocolOwner = msg.sender` at construction — deployer script EOA permanently owns it |
| F-15 | LOW | `DeploymentBatcher` | `setSolanaConfig` and `setOVaultRuntimeConfig` use `NotOwner` error but no `Ownable` pattern — access control inconsistency |
| F-16 | LOW | `DeploymentBatcher` | Vesting contract deployed with `new` (not CREATE2) — address unpredictable, not deterministic |
| F-17 | LOW | `CreatorOVaultFactory` | Legacy deployer registration accepts any addresses — no code existence check on registered contracts |
| F-18 | LOW | `BribesFactory` | `createBribeDepot` salt derived purely from vault address — predictable CREATE2 address, front-runnable on first deploy |
| F-19 | LOW | `AjnaERC4626Vault` | `maxWithdraw` and `maxRedeem` only consider buffer — silently understates available assets when bucket liquidity exists |
| F-20 | LOW | `AjnaVaultAuth` | `retrieveFees` transfers to `admin` not arbitrary address — but accepts any `token`, risks draining vault collateral tokens |
| F-21 | LOW | `DeploymentBatcherPhase3Helper` | `address(this)` used as temp owner for AjnaVaultAuth then transferred — if transfer fails, auth is permanently locked to helper |
| F-22 | LOW | `Create2Deployer` | Completely permissionless — any caller can deploy any bytecode at any salt |
| F-23 | INFO | `OFTBootstrapRegistry` | `chainId` parameter silently ignored — misleading interface |
| F-24 | INFO | `UniversalBytecodeStoreV2` | `get()` reconstruction loop offset hardcodes `1` for STOP prefix — fragile coupling to `_SSTORE2V2` implementation detail |
| F-25 | INFO | `CreatorRegistry` | `getAllCreatorCoins()` unbounded array — gas DoS on large registries |
| F-26 | INFO | `DeploymentBatcher` | Phase 1 split state does not expire — stale state can block re-deployments for same `(creatorToken, owner, version)` |
| F-27 | INFO | `AjnaERC4626Vault` | No event emitted for fee collection — fee routing to `AUTH.admin()` is opaque |
| F-28 | INFO | `StrategyDeploymentFactories` | `AjnaERC4626StrategyFactory.deploy` sets `swapper` to the adapter then transfers `admin` to `owner` — but `setSwapper` can only be called by admin, creating a window where swapper is unset if transfer reordered |

---

## Detailed Findings

---

### F-01 — HIGH: Arbitrary vault/wrapper/shareOFT accepted in Phase 2 — no origin binding

**Contract:** `DeploymentBatcher.sol`  
**Lines:** 1082–1099 (`finalizePhase2`, `finalizePhase2WithPermit2`), 1135–1205 (`_deployPhase2Core`)

**Description:**  
`finalizePhase2` accepts `Phase2FinalizeParams` which contains caller-supplied `vault`, `wrapper`, `shareOFT`, `gaugeController`, `ccaStrategy`, and `oracle` addresses. The only binding checks are:
1. Each address must have `code.length > 0`.
2. The caller must be `params.owner`.

There is **no verification that these addresses were deployed by the batcher's Phase 1 / Phase 2 core calls**. An attacker who controls `params.owner` could supply a malicious vault, wrapper, or shareOFT that:
- Has `onlyAdapterAuthorized` checks set to a malicious swapper.
- Implements `ICreatorOVaultWrapper.deposit()` to redirect deposited creator tokens.
- Already has an `AuctionAlreadyPending` state collision with a legitimate deployment.

```solidity
// Line 1146–1148: Only checks code exists, not that batcher deployed it
if (params.vault.code.length == 0 || params.wrapper.code.length == 0 || params.shareOFT.code.length == 0) {
    revert Phase1Missing();
}
```

**Attack Scenario:**  
1. Attacker deploys a malicious `wrapper` that on `deposit()` silently steals tokens.
2. Attacker calls `finalizePhase2` with the legitimate `creatorToken` and their malicious `wrapper`.
3. Batcher calls `IERC20(params.creatorToken).forceApprove(params.wrapper, params.depositAmount)` and `ICreatorOVaultWrapper(params.wrapper).deposit(params.depositAmount)`.
4. Attacker drains up to `MAX_DEPOSIT` (50M tokens) of creator tokens.

**Recommended Fix:**  
Verify `vault`, `wrapper`, and `shareOFT` were recorded in `phase1SplitStates[baseSalt]` before proceeding:
```solidity
Phase1SplitState storage state = phase1SplitStates[baseSalt];
if (state.vault != params.vault || state.wrapper != params.wrapper || state.shareOFT != params.shareOFT) {
    revert Phase1StateMismatch();
}
```
Similarly validate `gaugeController`, `ccaStrategy`, `oracle` against a Phase2 state record.

---

### F-02 — HIGH: `pendingAuctions` can be bricked by replaying Phase 2 finalize with different version

**Contract:** `DeploymentBatcher.sol`  
**Lines:** 1248–1260 (`_finalizePhase2Internal`)

**Description:**  
The `baseSalt` is derived from `(creatorToken, owner, block.chainid, version)`. Two different calls with different `version` strings produce different `baseSalt`s. However, a valid `pendingAuctions[baseSalt]` check only verifies the slot for that specific `baseSalt`. 

The check at line 1250 prevents a double-finalize for the **same salt**, but a creator can legitimately call `finalizePhase2` with a different `version` string, creating a **second** `pendingAuctions` entry. This:
1. Leaves batcher holding the first batch of 40% shareOFTs indefinitely (locked, no cleanup).
2. Creates orphaned `lpReserveAmount` tokens transferred to `params.ccaStrategy` with no recovery path.
3. If the same `creatorToken`+`owner` is used with `version=""` and `version="v2"`, two completely separate vault stacks are wired in the registry — inconsistent state.

```solidity
// Line 1249–1256: AuctionAlreadyPending only blocks same baseSalt
PendingAuction storage pending = pendingAuctions[baseSalt];
if (pending.amount != 0) revert AuctionAlreadyPending();
pendingAuctions[baseSalt] = PendingAuction({...});
```

**Attack Scenario:**  
A legitimate creator calls `finalizePhase2(..., version="v1", ...)` creating a pending auction. Before calling `launchDeferredAuction`, the creator (or an attacker with owner keys) calls `finalizePhase2(..., version="v2", ...)` with a different set of contracts. The first 40% auction allocation is now stranded inside the batcher with no recovery function.

**Recommended Fix:**  
- Add a per-`creatorToken`+`owner` (version-independent) global pending auction guard.
- Or: store and enforce that a `creatorToken` can only have one live auction at a time across all versions.
- Add an admin `recoverStrandedAuction(bytes32 baseSalt)` function callable only by `protocolTreasury`.

---

### F-03 — HIGH: `deposit` emits `Deposit` event with `netAssets` instead of `assets` — ERC-4626 non-compliance

**Contract:** `AjnaERC4626Vault.sol`  
**Lines:** 142–164

**Description:**  
ERC-4626 mandates that the `Deposit` event emits `assets` as the **gross** input amount. `AjnaERC4626Vault.deposit()` charges an entry fee (`toll`) and then emits `Deposit(msg.sender, receiver, netAssets, shares)` where `netAssets = assets - fee`. This understates the actual input and breaks off-chain indexers, accounting tools, and any integration that relies on event data for balance reconciliation.

```solidity
// Lines 155–163
uint256 fee = _feeFromTotal(assets, AUTH.toll());
uint256 netAssets = assets - fee;
shares = super.previewDeposit(netAssets);

_sendFee(fee);
_bufferDeposit(netAssets);
_mint(receiver, shares);

emit Deposit(msg.sender, receiver, netAssets, shares); // BUG: should emit `assets`, not `netAssets`
```

Similarly in `mint()` at lines 166–188: `emit Deposit(msg.sender, receiver, netAssets, shares)` where `netAssets` omits the fee component.

**Attack Scenario:**  
Off-chain integrators (accounting, front-ends, MEV bots) observe `Deposit` events and track total assets deposited. With underreported values, a fee extraction attack can be masked — depositing and immediately withdrawing with the fee invisible to event monitors.

**Recommended Fix:**  
```solidity
emit Deposit(msg.sender, receiver, assets, shares); // emit gross input per ERC-4626 spec
```
Track fee separately in a `FeeCharged` event.

---

### F-04 — HIGH: Single-step admin transfer in `AjnaVaultAuth` — irrecoverable loss of control

**Contract:** `AjnaVaultAuth.sol`  
**Lines:** 76–80

**Description:**  
`setAdmin` immediately overwrites `admin` to the new address with no two-step confirmation. If called with a wrong address (typo, zero address is blocked but mistyped address is not), the vault auth is permanently bricked:
- All admin-gated functions become inaccessible: `pause`, `setSwapper`, `setKeeper`, `setBufferRatio`, `setToll`, `setTax`, `setDepositCap`.
- The vault cannot be paused in an emergency.
- Fee routing cannot be updated.

```solidity
function setAdmin(address nextAdmin) external onlyAdmin {
    if (nextAdmin == address(0)) revert ZeroAddress();
    admin = nextAdmin; // immediate transfer, no acceptance step
    emit AdminSet(nextAdmin);
}
```

**Attack Scenario:**  
A governance multisig accidentally calls `setAdmin(wrongAddress)`. The vault auth is permanently locked. All Ajna vault operations that require auth config become frozen.

**Recommended Fix:**  
Implement two-step transfer:
```solidity
address public pendingAdmin;

function transferAdmin(address newAdmin) external onlyAdmin {
    pendingAdmin = newAdmin;
}

function acceptAdmin() external {
    if (msg.sender != pendingAdmin) revert NotAuthorized();
    admin = pendingAdmin;
    pendingAdmin = address(0);
    emit AdminSet(admin);
}
```

---

### F-05 — MEDIUM: `_finalizePhase1InternalSplit` catch block silently reuses unrelated pre-deployed contract

**Contract:** `DeploymentBatcher.sol`  
**Lines:** 1035–1045

**Description:**  
When `create2Deployer.deploy(state.shareOftSalt, codeIds.shareOFT, shareOftArgs)` reverts (e.g., salt already used), the catch block derives the expected address and proceeds **if any code exists there**, regardless of whether that code is the expected ShareOFT or a completely different contract:

```solidity
try create2Deployer.deploy(state.shareOftSalt, codeIds.shareOFT, shareOftArgs) returns (address deployedShareOFT) {
    out.shareOFT = deployedShareOFT;
} catch {
    // Reuse existing contract at that address
    address existingShareOFT = create2Deployer.computeAddress(state.shareOftSalt, shareOftInitCodeHash);
    if (existingShareOFT.code.length == 0) revert Phase1ShareOFTMissing();
    out.shareOFT = existingShareOFT; // accepted without verifying it IS a ShareOFT
}
```

The code uses `shareOftInitCodeHash` to compute the expected address — but the catch is entered precisely when deployment fails, which could be because the salt was used by a **different** initcode (different `codeId` or different args). In that case `existingShareOFT.code.length > 0` but it's not the correct ShareOFT.

**Attack Scenario:**  
An attacker front-runs the ShareOFT deployment at the computed salt with a malicious ERC-20 contract. Phase 1 finalization then wires the malicious contract as the official shareOFT: `setRegistry`, `setVault`, `setMinter(wrapper, true)` — giving the malicious contract minting rights.

**Recommended Fix:**  
Verify the existing contract's initcode hash or check a known function selector:
```solidity
// Verify the preimage matches
bytes32 expectedHash = keccak256(bytes.concat(bytecodeStore.get(codeIds.shareOFT), shareOftArgs));
address expectedAddr = create2Deployer.computeAddress(state.shareOftSalt, expectedHash);
require(existingShareOFT == expectedAddr, "ShareOFT address mismatch");
```

---

### F-06 — MEDIUM: Unbounded string loops in `_toLower`/`_toUpper` — gas griefing via long `shareSymbol`

**Contract:** `DeploymentBatcher.sol`  
**Lines:** 1535–1554

**Description:**  
`_toLower` and `_toUpper` iterate over every byte of the input string without a length cap. They are called on `params.shareSymbol` which is a user-supplied `calldata` string with no length validation:

```solidity
function _toLower(string memory input) internal pure returns (string memory) {
    bytes memory b = bytes(input);
    for (uint256 i = 0; i < b.length; i++) { // unbounded
        ...
    }
}
```

Called inside `_deployPhase1CoreInternal` (line 941) and `_finalizePhase1InternalSplit` (line 1005), which are themselves called by `deployPhase1CoreWithSalt` and `finalizePhase1WithSalt` — both `external nonReentrant` functions. The caller must be `params.owner` so this is not a fully open attack vector, but any authorized owner can supply a 64KB+ string to grief the gas cost of phase 1 operations, potentially blocking them from completing within the block gas limit.

**Recommended Fix:**  
Add a maximum symbol length check:
```solidity
if (bytes(params.shareSymbol).length > 32) revert SymbolTooLong();
```

---

### F-07 — MEDIUM: `batchActivateWithPermit2For` — authorized operator can drain identity tokens via stale signature

**Contract:** `VaultActivationBatcher.sol`  
**Lines:** 267–323

**Description:**  
The flow allows any address that passes `isAuthorizedOperator(msg.sender, OP_ACTIVATE)` to call `batchActivateWithPermit2For`. The permit is signed by `identity` and consumed via `ISignatureTransfer(permit2).permitTransferFrom(permit, details, identity, signature)`. Permit2's single-use nonce prevents exact replay, but the operator controls:

1. **`depositAmount`**: Can set to any value `<= permit.permitted.amount`. The permit may be signed for the maximum amount, allowing the operator to choose how much to pull.
2. **`auctionPercent`**: Operator chooses what fraction goes to the auction.
3. **`vault`**, **`wrapper`**, **`ccaStrategy`**: These are operator-supplied and only checked against `IOwnable(vault).owner() == identity`. If `identity` owns multiple vaults or a malicious vault is deployed with `identity` as owner, the operator can route tokens through unintended contracts.

The `ccaStrategy` parameter is entirely operator-chosen with no registry validation. An operator could pass a malicious `ccaStrategy` that does not launch a real auction.

```solidity
// Lines 291–293: operator authorization
if (msg.sender != identity) {
    if (!IOperatorAuthorizableVault(vault).isAuthorizedOperator(msg.sender, OP_ACTIVATE)) {
        revert NotAuthorizedOperator();
    }
}
// Line 302: pulls from identity based on operator-supplied amount
ISignatureTransfer(permit2).permitTransferFrom(permit, details, identity, signature);
// Lines 308–319: operator chooses ccaStrategy, wrapper, auctionPercent
```

**Recommended Fix:**  
- Validate `ccaStrategy` and `wrapper` against the CreatorRegistry for `identity`'s registered token.
- Do not allow operator to choose `auctionPercent` freely — derive it from on-chain protocol constants.

---

### F-08 — MEDIUM: `totalAssets()` unbounded loop — DoS via bucket accumulation

**Contract:** `AjnaERC4626Vault.sol`  
**Lines:** 73–80

**Description:**  
`totalAssets()` iterates over all tracked `_buckets`:

```solidity
function totalAssets() public view override returns (uint256 assets) {
    assets = bufferAssets();
    uint256 bucketCount = _buckets.length;
    for (uint256 i = 0; i < bucketCount; i++) { // O(n) over all buckets
        uint256 bucketIndex = _buckets[i];
        assets += AjnaVaultLibrary.lpToAssets(AJNA_POOL, bucketIndex, bucketLp[bucketIndex]);
    }
}
```

`_buckets` grows on every `moveFromBuffer` call to a new bucket index. An authorized `swapper` can call `moveFromBuffer` to many distinct bucket indexes. With Ajna's 7,388 bucket range, this loop can grow until `totalAssets()` exceeds the block gas limit. Since `totalAssets()` is called in `deposit`, `maxDeposit`, `previewDeposit`, `maxMint`, and `previewMint`, this DoSes all deposit paths.

**Recommended Fix:**  
Cap the maximum number of tracked buckets (e.g., 50):
```solidity
uint256 public constant MAX_BUCKETS = 50;
// in _trackBucket:
if (_buckets.length >= MAX_BUCKETS) revert TooManyBuckets();
```

---

### F-09 — MEDIUM: `withdraw` and `redeem` restricted to `swapper` — ERC-4626 standard violation

**Contract:** `AjnaERC4626Vault.sol`  
**Lines:** 190–243

**Description:**  
Both `withdraw` and `redeem` carry the `onlyAdapterAuthorized` modifier:

```solidity
modifier onlyAdapterAuthorized() {
    if (msg.sender != AUTH.swapper()) revert NotAuthorized();
    __;
}
```

ERC-4626 requires that `withdraw(assets, receiver, owner)` and `redeem(shares, receiver, owner)` be callable by the `owner` or an approved spender. This vault gates them to a single configured address (`swapper`). This breaks:

1. **ERC-4626 compliance**: Standard integrations (front-ends, aggregators) that call `withdraw` or `redeem` directly will revert.
2. **Emergency exit**: If `swapper` is set to `address(0)` (which `setSwapper` allows — there is no zero-address check at line 82–85), no withdrawals are possible.
3. **Allowance-based flows**: `_spendAllowanceIfNeeded` logic is dead code since `msg.sender` must be `swapper` anyway.

```solidity
// AjnaVaultAuth.sol line 82-85: swapper can be set to address(0)
function setSwapper(address nextSwapper) external onlyAdmin {
    swapper = nextSwapper; // no zero-address check
    emit SwapperSet(nextSwapper);
}
```

**Recommended Fix:**  
- Add zero-address check to `setSwapper`.
- Clearly document that this vault is not a standard ERC-4626 vault (withdrawals gated to swapper).
- Consider exposing an emergency withdraw path callable by `admin` when paused.

---

### F-10 — MEDIUM: `ensureBufferRatio` integer truncation allows near-complete buffer drain

**Contract:** `AjnaVaultLibrary.sol`  
**Lines:** 23–32

**Description:**  
```solidity
function ensureBufferRatio(uint256 totalAssets, uint256 currentBufferAssets, uint256 assetsLeavingBuffer, uint256 ratioBps)
    internal pure
{
    if (ratioBps == 0) return;
    uint256 remainingBufferAssets = currentBufferAssets - assetsLeavingBuffer;
    uint256 minBufferAssets = (totalAssets * ratioBps) / 10_000; // integer division truncation
    if (remainingBufferAssets < minBufferAssets) revert BufferRatioViolated();
}
```

For small `totalAssets` and `ratioBps < 10_000`, `(totalAssets * ratioBps) / 10_000` can truncate to 0. Example: `totalAssets = 9`, `ratioBps = 1000` (10%) → `minBufferAssets = 0`. The check passes even when `remainingBufferAssets == 0`, defeating the buffer protection entirely.

**Recommended Fix:**  
Use ceiling division:
```solidity
uint256 minBufferAssets = Math.ceilDiv(totalAssets * ratioBps, 10_000);
```

---

### F-11 — MEDIUM: `setRemoteOFTPeer` update path can corrupt `remoteOFTToToken` mapping

**Contract:** `CreatorRegistry.sol`  
**Lines:** 441–461

**Description:**  
When updating an existing remote OFT peer for a `(_token, _chainEid)`:

```solidity
address oldRemoteOFT = remoteOFTPeers[_token][_chainEid];
if (oldRemoteOFT != address(0)) {
    delete remoteOFTToToken[oldRemoteOFT]; // clears old reverse mapping
} else {
    remoteOFTChains[_token].push(_chainEid); // adds to chain list
}
remoteOFTPeers[_token][_chainEid] = _remoteOFT;
remoteOFTToToken[_remoteOFT] = _token; // sets new reverse mapping
```

If `oldRemoteOFT` was also registered as the remote OFT for a **different** token (e.g., via an admin error or cross-chain address reuse), the `delete remoteOFTToToken[oldRemoteOFT]` wipes the other token's reverse mapping. The new write `remoteOFTToToken[_remoteOFT] = _token` then points to the wrong token if `_remoteOFT == oldRemoteOFT` of another token.

Additionally, when an existing peer is updated, the `_chainEid` is **not** re-added to `remoteOFTChains[_token]` (the `else` branch is skipped). This means the chain is already listed, which is correct — but there is no validation that the old entry in `remoteOFTChains` corresponds to the right token.

**Recommended Fix:**  
Before deleting `remoteOFTToToken[oldRemoteOFT]`, verify it points to the expected token:
```solidity
if (remoteOFTToToken[oldRemoteOFT] == _token) {
    delete remoteOFTToToken[oldRemoteOFT];
}
```

---

### F-12 — MEDIUM: `configureCreatorPool` has no fee cap for buy/sell independently — asymmetric 10% cap bypass

**Contract:** `TaxHookConfigurator.sol`  
**Lines:** 141–173

**Description:**  
`_configureCreatorPool` sets `buyTaxBps = _feeBps` and `sellTaxBps = _feeBps` from a single parameter with cap `_feeBps <= 1000` (10%):

```solidity
require(_feeBps <= 1000, "Fee too high (max 10%)");
...
ITaxHook.TaxConfig memory config = ITaxHook.TaxConfig({
    buyTaxBps: _feeBps, sellTaxBps: _feeBps, ...
});
```

However, `updateFeeBps` takes separate `_newBuyFeeBps` and `_newSellFeeBps` with independent caps:
```solidity
require(_newBuyFeeBps <= 1000 && _newSellFeeBps <= 1000, "Fee too high");
```

The initial `configureCreatorPool` can set `_feeBps = 690` (6.9%) while `updateFeeBps` can later set `buyTaxBps = 1000` and `sellTaxBps = 1000` — asymmetric fees. More critically, the initial `DEFAULT_FEE_BPS = 690` hard-codes the sell and buy fee to the same value, while no lower bound is enforced. The owner could set `_feeBps = 0` for an ally and then later raise it via `updateFeeBps`, which is a governance risk rather than a technical vulnerability but deserves flagging.

There is also no minimum fee enforced — the owner can set the fee to 0, entirely disabling the fee mechanism without an explicit `disableFees` call.

**Recommended Fix:**  
Document that the owner has unilateral fee control. If protocol-level fee floors are intended, add a minimum (e.g., `require(_feeBps >= MIN_FEE_BPS)`). Consider a timelock or multisig on fee changes.

---

### F-13 — MEDIUM: `UniversalCreate2DeployerFromStore` — anyone can deploy any stored bytecode

**Contract:** `UniversalCreate2DeployerFromStore.sol`  
**Lines:** 25–39

**Description:**  
The `deploy` function is completely permissionless:

```solidity
function deploy(bytes32 salt, bytes32 codeId, bytes calldata constructorArgs) external returns (address addr) {
    // No access control
    address pointer = store.pointers(codeId);
    ...
    addr := create2(0, add(initCode, 0x20), mload(initCode), salt)
```

Any external caller can deploy any bytecode from the `UniversalBytecodeStore` at any CREATE2 salt with any constructor args. Consequences:
1. **Salt squatting**: An attacker who learns the intended deployment salt (derivable from the deterministic `_deriveBaseSalt` formula used by `DeploymentBatcher`) can pre-deploy at that address with empty constructor args or different args, causing `DeploymentBatcher` deploys to fail silently (they use `try/catch` or revert with `DeployFailed`).
2. **Rogue deployments**: Anyone can deploy a vault or strategy contract with themselves as owner before the legitimate user, then claim the computed addresses.

```solidity
// DeploymentBatcher._deriveBaseSalt is deterministic from public parameters
return keccak256(abi.encodePacked(creatorToken, owner, block.chainid, "4626:deploy:", version));
```

**Recommended Fix:**  
Add deployer allowlist:
```solidity
mapping(address => bool) public authorizedDeployers;
modifier onlyAuthorizedDeployer() { ... }
function deploy(...) external onlyAuthorizedDeployer returns (address addr) { ... }
```
Or: make salt unpredictable by incorporating a private commitment from the batcher.

---

### F-14 — MEDIUM: `StrategyDeploymentBatcher.protocolOwner` permanently set to deployer EOA

**Contract:** `StrategyDeploymentBatcher.sol`  
**Lines:** 90–93

**Description:**  
`protocolOwner` is an `immutable` field set to `msg.sender` in the constructor:

```solidity
constructor() {
    protocolOwner = msg.sender; // immutable, cannot be changed
    ...
}
```

And `batchDeployStrategies` is guarded by:
```solidity
modifier onlyProtocolOwner() {
    if (msg.sender != protocolOwner) revert NotProtocolOwner();
    __;
}
```

There is no mechanism to transfer the `protocolOwner` role. If the deployer EOA is compromised or lost, the contract is permanently bricked and no strategy deployments can proceed. This also means this contract cannot be operated by a multisig unless the deployer EOA is the multisig, which is unusual for deployment scripts.

**Recommended Fix:**  
Replace `immutable protocolOwner` with an `Ownable` pattern supporting ownership transfer:
```solidity
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
contract StrategyDeploymentBatcher is ReentrancyGuard, Ownable2Step { ... }
```

---

### F-15 — LOW: `setSolanaConfig`/`setOVaultRuntimeConfig` use `NotOwner` error but batcher has no `Ownable`

**Contract:** `DeploymentBatcher.sol`  
**Lines:** 1413–1431

**Description:**  
These admin functions gate access using `if (msg.sender != protocolTreasury) revert NotOwner()`. The `protocolTreasury` is an immutable address, not a changeable owner. The error name `NotOwner` is misleading — the contract has no `owner()` function and does not use OpenZeppelin `Ownable`. If `protocolTreasury` is compromised or the protocol needs to transfer admin, there is no upgrade path for these configs.

**Recommended Fix:**  
Rename the guard to `NotProtocolTreasury`, and document that `protocolTreasury` cannot be updated post-deployment.

---

### F-16 — LOW: Vesting contract deployed with `new` — non-deterministic address

**Contract:** `DeploymentBatcher.sol`  
**Lines:** 1271–1273

**Description:**  
```solidity
CreatorLinearVesting vesting =
    new CreatorLinearVesting(params.shareOFT, params.owner, uint64(block.timestamp), uint64(365 days));
```

Unlike all other contracts in the deployment stack, the vesting contract is deployed with `new` rather than CREATE2. Its address depends on the deployer's nonce (i.e., the batcher's nonce), which:
1. Cannot be predicted before the transaction.
2. Changes if any prior transaction fails and is retried.
3. Cannot be pre-authorized in off-chain systems.

The `CreatorShareVestingDeployed` event records the address, but pre-verification is impossible.

**Recommended Fix:**  
Deploy `CreatorLinearVesting` via `create2Deployer` using a deterministic salt like `_saltFor(baseSalt, "vesting")`.

---

### F-17 — LOW: `CreatorOVaultFactory.registerDeployment` accepts addresses without code existence checks

**Contract:** `CreatorOVaultFactory.sol`  
**Lines:** 146–184

**Description:**  
The legacy factory allows authorized deployers to register arbitrary addresses as `vault`, `wrapper`, `shareOFT`, etc. without verifying that contracts exist at those addresses:

```solidity
function registerDeployment(
    address _creatorCoin, address _vault, address _wrapper, address _shareOFT,
    address _gaugeController, address _ccaStrategy, address _oracle, address _creator
) external onlyAuthorizedDeployer {
    if (_creatorCoin == address(0)) revert ZeroAddress();
    // No code.length checks on vault, wrapper, shareOFT, etc.
```

A compromised authorized deployer can register EOA addresses as vault infrastructure, poisoning the registry with invalid entries that will fail silently in downstream consumers.

**Recommended Fix:**  
Add code existence checks for critical components:
```solidity
require(_vault.code.length > 0, "Vault not deployed");
require(_wrapper.code.length > 0, "Wrapper not deployed");
```

---

### F-18 — LOW: `BribesFactory` CREATE2 salt is predictable — front-runnable first deploy

**Contract:** `BribesFactory.sol`  
**Lines:** 58–59

**Description:**  
```solidity
bytes32 salt = bytes32(uint256(uint160(vault)));
depot = address(new BribeDepot{salt: salt}(vault, gaugeVoting));
```

The salt is deterministically derived from the vault address, which is public. An attacker can:
1. Compute the expected `BribeDepot` address for any vault.
2. Deploy a malicious contract at that address before `createBribeDepot` is called (using a separate CREATE2 deployer with the same factory address derivation).

However, because the `BribeDepot` constructor embeds `vault` and `gaugeVoting`, the address collision would require the attacker to control a deployer at this factory's address — which is not feasible with a standard `new ... {salt: ...}`. The real risk is that the salt can be pre-computed and used to predict addresses for off-chain tooling, not an actual security bypass.

**Impact:** Low — front-running the CREATE2 deployment by a different contract is not feasible when using Solidity's `new{salt:}` since the factory address is fixed. The predictability is a cosmetic concern.

**Recommended Fix:**  
Consider mixing in `msg.sender` or `block.timestamp` if unpredictable addresses are desired. For current usage, document the deterministic nature as intentional.

---

### F-19 — LOW: `maxWithdraw` and `maxRedeem` only consider buffer assets — underreports available liquidity

**Contract:** `AjnaERC4626Vault.sol`  
**Lines:** 103–119

**Description:**  
```solidity
function maxWithdraw(address owner) public view override returns (uint256) {
    if (AUTH.paused()) return 0;
    uint256 grossAssetsByShares = super.maxWithdraw(owner);
    uint256 grossAssetsFromBuffer = Math.min(grossAssetsByShares, bufferAssets()); // only buffer
    return _netFromGross(grossAssetsFromBuffer, AUTH.tax());
}
```

Bucket assets (the majority of vault assets) are not included in `maxWithdraw`/`maxRedeem` computations, even though `moveToBuffer` can be called by the swapper to bring bucket assets back. The ERC-4626 spec says `maxWithdraw` should return the **maximum** amount that could be withdrawn — including all reachable assets. Under-reporting prevents proper portfolio valuation.

**Impact:** Low — the swapper controls liquidity rebalancing, and the restriction is by design (only buffer is immediately liquid). However it should be explicitly documented and the `previewWithdraw`/`previewRedeem` are inconsistently richer than `maxWithdraw`/`maxRedeem`.

**Recommended Fix:**  
Document this deviation from ERC-4626 explicitly in the contract's NatSpec. Consider adding a `maxWithdrawAll()` view that includes bucket assets for full valuation.

---

### F-20 — LOW: `AjnaVaultAuth.retrieveFees` can drain any token from the auth contract

**Contract:** `AjnaVaultAuth.sol`  
**Lines:** 131–133

**Description:**  
```solidity
function retrieveFees(address token, uint256 amount) external onlyAdmin {
    IERC20(token).safeTransfer(admin, amount);
}
```

`retrieveFees` accepts any `token` address and drains it. If fee tokens (e.g., the asset token) accidentally accumulate in the auth contract, this is fine. However, the function could also be used to drain any ERC-20 that is accidentally sent to the auth contract — including the vault's own asset token if it is sent there via a bug.

More critically, the `AjnaVaultAuth` contract itself holds no tokens under normal operation — fees are sent from `AjnaERC4626Vault._sendFee()` directly to `AUTH.admin()`, not to the auth contract. So `retrieveFees` is a dead code path that could be confusing.

**Recommended Fix:**  
Remove `retrieveFees` if it serves no purpose (fees go directly to admin, not to the auth contract). Or restrict it to specific known fee tokens.

---

### F-21 — LOW: Phase 3 helper uses `address(this)` as temp owner — permanent lock if transfer fails

**Contract:** `DeploymentBatcherPhase3Helper.sol` (within `DeploymentBatcher.sol`)  
**Lines:** 137, 155–160

**Description:**  
During strategy deployment, `DeploymentBatcherPhase3Helper` deploys `AjnaVaultAuth` with `address(this)` as the initial admin:

```solidity
out.ajnaVaultAuth = create2Deployer.deploy(ajnaAuthSalt, codeIds.ajnaVaultAuth, abi.encode(address(this)));
// ... configure ...
IAjnaVaultAuthConfigurator(out.ajnaVaultAuth).setAdmin(protocolTreasury); // transfer
```

If `setAdmin(protocolTreasury)` reverts (e.g., if `AjnaVaultAuth` has a different interface), the auth contract remains permanently owned by `DeploymentBatcherPhase3Helper`, which has no admin recovery function. The helper is an immutable deployment-only contract with no `retrieveAdmin` or similar.

**Recommended Fix:**  
Verify the interface by calling `isAdmin(address(this))` before proceeding, or use a try/catch with an admin recovery event.

---

### F-22 — LOW: `Create2Deployer` is entirely permissionless

**Contract:** `Create2Deployer.sol`  
**Lines:** 15–22

**Description:**  
`Create2Deployer.deploy(bytes32 salt, bytes memory initCode)` accepts any caller and any bytecode. Unlike `UniversalCreate2DeployerFromStore`, this deployer does not gate on a bytecode store — callers provide raw initcode. While this is a standalone utility contract not used in the main deployment flow (superseded by `UniversalCreate2DeployerFromStore`), it remains deployed and any actor can use it to deploy contracts at deterministic addresses that may collide with future protocol deployments.

**Recommended Fix:**  
Add an access control list or remove this contract if it is truly superseded.

---

### F-23 — INFO: `OFTBootstrapRegistry.getLayerZeroEndpoint` silently ignores `chainId` parameter

**Contract:** `OFTBootstrapRegistry.sol`  
**Lines:** 21–23

**Description:**  
```solidity
function getLayerZeroEndpoint(uint256) external pure returns (address) {
    return LZ_COMMON_ENDPOINT;
}
```

The `chainId` parameter is unnamed and discarded. Any caller expecting chain-specific endpoint resolution will silently receive the common endpoint regardless of the chain queried. This is documented as intentional, but the function signature is misleading. Future upgrades or forks that reuse this interface may inadvertently receive incorrect endpoints.

**Recommended Fix:**  
Rename the parameter to `/* chainId */` with a comment explaining why it is ignored, or use a distinct function name like `getCommonEndpoint()`.

---

### F-24 — INFO: `UniversalBytecodeStoreV2.get()` hardcodes SSTORE2 offset `1` — fragile coupling

**Contract:** `UniversalBytecodeStoreV2.sol`  
**Lines:** 119–127

**Description:**  
```solidity
assembly ("memory-safe") {
    extcodecopy(ptr, add(add(creationCode, 0x20), copied), 1, take) // offset=1 hardcoded
}
```

This hardcodes the SSTORE2 data offset (`1` for the leading `STOP` byte). If the `_SSTORE2V2` library is ever changed to use a different prefix or the offset constant is updated, `get()` will silently return corrupt data. Both `DATA_OFFSET = 1` in the library and `1` in `get()` must be kept in sync manually.

**Recommended Fix:**  
Use the library constant: `_SSTORE2V2.DATA_OFFSET` instead of the literal `1`. Or expose `DATA_OFFSET` as a public constant on the store contract.

---

### F-25 — INFO: `CreatorRegistry.getAllCreatorCoins()` unbounded array return — block gas limit DoS

**Contract:** `CreatorRegistry.sol`  
**Lines:** 651–653

**Description:**  
```solidity
function getAllCreatorCoins() external view override returns (address[] memory) {
    return registeredTokens; // grows without bound up to MAX_CREATOR_COINS = 999,999
}
```

With up to 999,999 creator coins, this function would return a ~32MB array, far exceeding any block or call gas limit. While this is a `view` function (off-chain reads are free), any on-chain consumer of this function will fail once the registry is sufficiently populated.

**Recommended Fix:**  
Add paginated access:
```solidity
function getCreatorCoins(uint256 offset, uint256 limit) external view returns (address[] memory) { ... }
```

---

### F-26 — INFO: `phase1SplitStates` never expires — blocks re-deployment for same (token, owner, version)

**Contract:** `DeploymentBatcher.sol`  
**Lines:** 947–990

**Description:**  
Once `state.coreDone = true` is set, the state slot `phase1SplitStates[baseSalt]` is never cleared. If a Phase 1 core deployment succeeds but Phase 1 finalization then fails permanently (e.g., ShareOFT bytecode removed from store), the slot blocks any future retry with the same `(creatorToken, owner, version)`. There is no admin `resetPhase1State` function.

**Recommended Fix:**  
Add an admin function callable by `protocolTreasury` to clear a stuck Phase 1 state:
```solidity
function resetPhase1State(bytes32 baseSalt) external {
    if (msg.sender != protocolTreasury) revert NotOwner();
    delete phase1SplitStates[baseSalt];
}
```

---

### F-27 — INFO: No event emitted on fee collection in `AjnaERC4626Vault`

**Contract:** `AjnaERC4626Vault.sol`  
**Lines:** 330–333

**Description:**  
```solidity
function _sendFee(uint256 fee) internal {
    if (fee == 0) return;
    ASSET_TOKEN.safeTransfer(AUTH.admin(), fee);
    // No FeeCollected event
}
```

Fee transfers to `AUTH.admin()` are invisible off-chain. An admin who quietly raises `toll` or `tax` to the maximum (10%) and extracts fees is undetectable without monitoring raw ERC-20 `Transfer` events.

**Recommended Fix:**  
Emit a `FeeCollected(address indexed recipient, uint256 amount)` event in `_sendFee`.

---

### F-28 — INFO: Race condition window in `AjnaERC4626StrategyFactory.deploy` — swapper temporarily unset

**Contract:** `StrategyDeploymentFactories.sol`  
**Lines:** 82–96

**Description:**  
```solidity
AjnaVaultAuth authContract = new AjnaVaultAuth(address(this)); // this = factory, is admin
// ...
ERC4626StrategyAdapter adapter = new ERC4626StrategyAdapter(...);
adapter.setIdleBufferBps(0);
adapter.transferOwnership(owner);
authContract.setAdmin(owner); // admin transferred last
```

The `setSwapper` is called via `IAjnaVaultAuthConfigurator` after auth is deployed (line 158 of `DeploymentBatcher.sol`'s Phase3Helper calls `authContract.setSwapper(out.ajnaStrategy)`). However in `StrategyDeploymentBatcher`'s path through `AjnaERC4626StrategyFactory`, `setSwapper` is **never called** — the swapper defaults to `address(0)`. This means the inner Ajna vault's `deposit`, `withdraw`, `redeem` all revert (`msg.sender != AUTH.swapper()` where swapper is zero) until an admin manually calls `setSwapper` after deployment.

In `StrategyDeploymentBatcher.batchDeployStrategies`, the factory's `deploy(...)` is called and then the returned `strategy` (adapter) is returned — but no call to `setSwapper` on `authContract` is made.

**Recommended Fix:**  
In `AjnaERC4626StrategyFactory.deploy`, call `authContract.setSwapper(address(adapter))` before transferring admin:
```solidity
authContract.setSwapper(address(adapter)); // add this line
authContract.setAdmin(owner);
```

---

## Cross-Cutting Observations

### Permit2 Signature Replay Considerations
All Permit2 flows in `VaultActivationBatcher` correctly use `ISignatureTransfer` (single-use nonces), preventing exact replay. However, the `permit.nonce` is not validated against any batcher-level state, so a valid signature can be replayed in a different entrypoint function (e.g., a signature created for `batchActivateWithPermit2For` could potentially be used in `batchActivateWithPermit2FromOperatorWithReserve` if the parameters align). This is mitigated by Permit2's single-use nonce but deserves documentation.

### Phase Ordering Not Enforced Cross-Phase
The batcher splits deployment into phases but does not enforce that Phase 3 (strategies) can only be called after Phase 2 is complete. `deployPhase3Strategies` only checks `IOwnableView(params.vault).owner() == params.owner` — a vault created independently (not by this batcher) could be passed. The vault ownership check is necessary but not sufficient.

### No Emergency Pause on DeploymentBatcher
`DeploymentBatcher` has no circuit breaker. If a vulnerability is discovered mid-deployment, the `protocolTreasury` cannot pause new deployments — the contract must be abandoned entirely.

### Registry Authorization Is Additive-Only
`CreatorRegistry.setAuthorizedFactory` can grant but the `authorizedFactories` mapping is never automatically revoked. Compromised factories remain permanently authorized unless the owner manually revokes them. Periodic audits of `authorizedFactories` membership are recommended.

---

## Gas Optimization Notes (Non-Security)

1. `DeploymentBatcher._toLower`/`_toUpper`: Modifies `input` in-memory by operating on the decoded bytes — no copy needed if using assembly. Minor.
2. `CreatorRegistry.getAllCreatorCoins()`: `registeredTokens` is declared `private` but returned wholesale via a view function — `external` + pagination would be more efficient.
3. `AjnaERC4626Vault._untrackBucketIfEmpty`: The swap-and-pop is correct and gas-efficient.

---

*Audit performed by static code analysis. No dynamic testing or fuzzing was conducted. Findings reflect code as read; deployed bytecode verification not performed.*
