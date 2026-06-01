Below is the final plan I would implement for your ERC-4626 vault.

I would **not** try to make the impaired strategy fit inside `totalAssets()` after impairment. ERC-4626’s share model represents fungible ERC-20 shares over vault holdings, so once part of the vault becomes unpriceable, the cleanest design is to split the economics: main share = clean book, side-pocket claim = future realized recovery. ([Ethereum Improvement Proposals][1])

## Final architecture

```text
Main ERC-4626 share
    = fungible claim on clean, liquid, actively priced vault assets

Impairment claim token
    = separate claim on realized recoveries from one impaired strategy epoch
```

The vault should never ask:

```text
What is the impaired strategy worth?
```

It should ask only:

```text
Has this strategy become unsafe/unpriceable?
Who held shares at the impairment boundary?
What value was actually recovered later?
```

This gives you the four required properties:

```text
fungible main shares
atomic-arb protection
snapshot-scoped recovery
no discretionary NAV marks
```

The one caveat to document explicitly:

```text
Main shares remain fungible, but full economic composability through wrappers/lending markets requires claim-aware adapters.
```

If a wrapper, Euler market, Morpho market, LP, or lending vault holds the share token at the snapshot block, that contract receives the recovery right unless you build integration-specific pass-through logic.

---

# 1. Use a two-layer state model

Do **not** make the whole vault permanently `SidePocketed`. After finalization, the vault should return to normal clean-book operation while unresolved impairment epochs continue in the background.

Use:

```solidity
enum VaultMode {
    Normal,
    Suspect
}
```

And separately:

```solidity
enum ImpairmentEpochStatus {
    None,
    Tripped,
    Finalized,
    Resolved
}
```

Recommended storage shape:

```solidity
struct ImpairmentEpoch {
    ImpairmentEpochStatus status;

    address strategy;
    address recoveryAsset;

    uint256 tripBlock;
    uint256 trippedAt;
    uint256 finalizedAt;
    uint256 resolvedAt;

    uint256 totalSharesAtTrip;
    uint256 totalClaimSupply;

    // Informational only. Not used as a live NAV mark.
    uint256 excludedBookValue;

    bytes32 snapshotRoot;

    uint256 totalRecovered;
    uint256 totalClaimed;

    bool depositsWerePaused;
    bool redemptionsWereQueued;
}
```

Global state:

```solidity
VaultMode public vaultMode;
uint256 public activeImpairmentEpoch;
uint256 public nextImpairmentEpochId;

mapping(uint256 => ImpairmentEpoch) public impairmentEpochs;
mapping(address => bool) public strategyImpaired;
mapping(uint256 => mapping(address => uint256)) public amountClaimed;
mapping(uint256 => mapping(address => bool)) public claimMinted;
```

Important design choice:

```text
The snapshot boundary should be tripBlock, not finalizeBlock.
```

Reason: `tripImpairment()` is the first moment the vault admits the accounting may be wrong. Once that transaction executes, new entrants and secondary buyers should not be able to acquire historical recovery exposure.

---

# 2. Implement `tripImpairment()` as the atomic circuit breaker

This is the most important function.

Add it in `CreatorOVaultCoreModule.sol`.

```solidity
function tripImpairment(
    address strategy,
    uint256 reasonCode
) external returns (uint256 epochId);
```

## Preconditions

The function should be permissionless if objective predicates are true, and privileged only for emergency freeze. A privileged caller should be able to freeze but **not** mark NAV.

Allowed hard predicates:

```text
valuation readiness failed
strategy report stale
strategy explicitly disabled
withdraw probe failed
strategy adapter cannot reconcile expected assets
external protocol reports paused/frozen state
configured guardian emergency trip
```

The emergency path is acceptable because freezing is not a wealth-transfering valuation action. It only stops unsafe flows.

## Effects

`tripImpairment()` must do all of this atomically:

```solidity
vaultMode = VaultMode.Suspect;
activeImpairmentEpoch = epochId;

epoch.status = ImpairmentEpochStatus.Tripped;
epoch.strategy = strategy;
epoch.tripBlock = block.number;
epoch.trippedAt = block.timestamp;
epoch.totalSharesAtTrip = totalSupply();

strategyImpaired[strategy] = true;
```

Then:

```text
disable strategy from new routing
pause deposit/mint
disable immediate redeem/withdraw
force all exits into queue, or pause exits entirely
emit ImpairmentTripped
```

Do not only queue “large” exits. That is Sybil-able.

During `Suspect`, every atomic ERC-4626 flow that could touch stale NAV should be closed.

ERC-7540’s request/pending/claimable/claimed model is the right reference pattern for async flows, even if you do not implement the full standard immediately. ([Ethereum Improvement Proposals][2])

---

# 3. ERC-4626 external behavior during `Suspect`

In `CreatorOVault.sol` / core external surface:

```solidity
function maxDeposit(address) public view returns (uint256) {
    if (vaultMode != VaultMode.Normal) return 0;
    ...
}

function maxMint(address) public view returns (uint256) {
    if (vaultMode != VaultMode.Normal) return 0;
    ...
}

function maxWithdraw(address owner) public view returns (uint256) {
    if (vaultMode == VaultMode.Suspect) return 0;
    ...
}

function maxRedeem(address owner) public view returns (uint256) {
    if (vaultMode == VaultMode.Suspect) return 0;
    ...
}
```

For actual functions:

```solidity
deposit(...)  -> revert VaultNotNormal()
mint(...)     -> revert VaultNotNormal()
withdraw(...) -> revert UseWithdrawalQueue()
redeem(...)   -> revert UseWithdrawalQueue()
```

Or, if you already have queue infrastructure:

```text
redeem/withdraw submit an async request instead of settling immediately.
```

The important invariant:

```text
No atomic deposit/mint/redeem/withdraw can settle against stale or partially finalized accounting.
```

---

# 4. Implement a reconciliation window before finalization

Do not finalize immediately unless the failure is obviously terminal.

Add:

```solidity
function clearImpairmentTrip(uint256 epochId) external;
```

This is used when the strategy turns out not to be impaired:

```text
temporary oracle outage
temporary RPC issue
strategy report was delayed
withdraw probe failure was transient
```

`clearImpairmentTrip()` should require objective recovery conditions:

```text
valuation ready again
strategy assets reconcile
withdraw probe succeeds
no debt mismatch
strategy can be safely re-enabled or removed cleanly
```

If cleared:

```solidity
epoch.status = ImpairmentEpochStatus.Resolved;
vaultMode = VaultMode.Normal;
activeImpairmentEpoch = 0;
strategyImpaired[strategy] = false; // only if safe
```

This distinction matters:

```text
trip = protective freeze
finalize = actual side-pocket creation
```

---

# 5. Implement `finalizeImpairment()` to remove the strategy from clean NAV

Add in `CreatorOVaultCoreModule.sol` or a dedicated impairment module:

```solidity
function finalizeImpairment(
    uint256 epochId,
    bytes32 snapshotRoot,
    uint256 totalClaimSupply,
    uint256 excludedBookValue
) external;
```

## Preconditions

```text
vaultMode == Suspect
epoch.status == Tripped
epochId == activeImpairmentEpoch
snapshotRoot != 0
totalClaimSupply == totalSharesAtTrip, unless explicitly adjusted
strategy still not valuation-ready or cannot be safely reconciled
```

## Effects

```solidity
epoch.status = ImpairmentEpochStatus.Finalized;
epoch.finalizedAt = block.timestamp;
epoch.snapshotRoot = snapshotRoot;
epoch.totalClaimSupply = totalClaimSupply;
epoch.excludedBookValue = excludedBookValue;
```

Then:

```text
remove impaired strategy from active accounting
remove impaired strategy from routing
exclude impaired strategy from totalAssets()
route future proceeds to recovery accounting
clear activeImpairmentEpoch
set vaultMode back to Normal
```

The key point:

```text
excludedBookValue is informational/audit accounting.
It must not be used as a live recovery mark.
```

After finalization, the main vault resumes as a clean-book ERC-4626:

```text
deposits allowed against clean NAV
withdrawals allowed against clean NAV
old impairment recovery remains outside totalAssets()
```

---

# 6. Modify `totalAssets()` and strategy accounting

Your accounting path needs a hard exclusion rule.

In whichever internal function backs `totalAssets()`:

```solidity
function _strategyValue(address strategy) internal view returns (uint256) {
    if (strategyImpaired[strategy]) return 0;
    ...
}
```

But do not blindly return zero for every disabled strategy. Distinguish:

```text
disabled but priced
disabled and exiting
impaired/unpriceable
```

Recommended strategy state:

```solidity
enum StrategyHealth {
    Active,
    Disabled,
    Exiting,
    Suspect,
    Impaired,
    Removed
}
```

Only `Impaired` gets excluded from clean NAV and routed to side-pocket recovery.

---

# 7. Add the recovery claim token

Create:

```text
contracts/vault/CreatorOImpairmentClaims.sol
```

Use ERC-1155-style IDs:

```text
tokenId = impairmentEpochId
balance = claim units
```

Default recommendation:

```text
non-transferable at launch
```

Reason: transferable claims create secondary-market complexity, collateral issues, and integration ambiguity. You can enable transferability later per epoch if needed.

Minimal interface:

```solidity
interface ICreatorOImpairmentClaims {
    function mint(address account, uint256 epochId, uint256 amount) external;
    function burn(address account, uint256 epochId, uint256 amount) external;
    function balanceOf(address account, uint256 epochId) external view returns (uint256);
    function totalSupply(uint256 epochId) external view returns (uint256);
}
```

If using ERC-1155, block transfers:

```solidity
function _update(
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory values
) internal override {
    if (from != address(0) && to != address(0)) {
        revert ClaimTransferDisabled();
    }
    super._update(from, to, ids, values);
}
```

---

# 8. Snapshot mechanism: make this decision deliberately

This is the biggest implementation risk.

You have two viable options.

## Option A — Add onchain share checkpoints

Best long-term design.

Every share mint, burn, and transfer writes balance checkpoints:

```solidity
_checkpoints[account].push(blockNumber, newBalance);
_totalSupplyCheckpoints.push(blockNumber, newTotalSupply);
```

Then claim minting can verify:

```solidity
claimUnits = balanceOfAt(account, epoch.tripBlock)
```

Pros:

```text
no offchain snapshot trust
deterministic eligibility
cleaner security story
```

Cons:

```text
higher gas on transfers
harder to retrofit for already-live vaults
```

## Option B — Use a Merkle snapshot root

Probably fastest to ship.

At `tripBlock`, build a root from share balances:

```text
leaf = keccak256(abi.encode(epochId, account, claimUnits))
```

Then:

```solidity
function mintClaimFromProof(
    uint256 epochId,
    address account,
    uint256 claimUnits,
    bytes32[] calldata proof
) external;
```

Validation:

```solidity
require(!claimMinted[epochId][account], ClaimAlreadyMinted());
require(verify(snapshotRoot, leaf, proof), InvalidClaimProof());

claimMinted[epochId][account] = true;
claims.mint(account, epochId, claimUnits);
```

Pros:

```text
easy to implement
works with existing share token
cheap for the vault
```

Cons:

```text
snapshot construction becomes an offchain trust assumption
requires reproducible tooling and preferably a challenge period
```

My recommendation:

```text
Use Merkle root for v1.
Add share checkpoints for v2/new deployments.
Require snapshot-root challenge delay before finalization unless emergency governance accepts the root.
```

If you use Merkle, publish deterministic snapshot tooling and include wrapper/lending-market balances exactly as onchain holders at `tripBlock`.

---

# 9. Implement realized-only recovery accounting

Do **not** implement:

```solidity
notifyRecovery(epochId, amount)
```

That is too close to manual marking.

Instead implement a balance-delta or settlement-receipt pattern.

```solidity
function notifyRecovery(
    uint256 epochId,
    address asset
) external returns (uint256 amountRecovered);
```

Pattern:

```solidity
function notifyRecovery(uint256 epochId, address asset)
    external
    returns (uint256 amountRecovered)
{
    ImpairmentEpoch storage epoch = impairmentEpochs[epochId];

    if (epoch.status != ImpairmentEpochStatus.Finalized) {
        revert InvalidImpairmentTransition();
    }

    if (asset != epoch.recoveryAsset) {
        revert RecoveryAssetMismatch();
    }

    uint256 current = IERC20(asset).balanceOf(address(this));
    uint256 accounted = epoch.totalRecovered - epoch.totalClaimed;
    uint256 newlyRecovered = current - accounted;

    if (newlyRecovered == 0) revert NothingRecovered();

    epoch.totalRecovered += newlyRecovered;

    emit RecoveryNotified(epochId, asset, newlyRecovered, epoch.totalRecovered);

    return newlyRecovered;
}
```

Depending on your existing accounting, you may want a dedicated `RecoveryEscrow` contract so clean-book vault assets and side-pocket recovery assets cannot be accidentally mixed.

I would prefer:

```text
CreatorORecoveryEscrow
    holds recovered assets
    accounts per epoch
    pays claim holders
```

This reduces double-counting risk.

---

# 10. Implement `claimRecovery()`

```solidity
function claimRecovery(
    uint256 epochId,
    address receiver
) external returns (uint256 amountOut);
```

Claim formula:

```text
grossEntitlement =
    totalRecovered * claimBalance / totalClaimSupply

amountOut =
    grossEntitlement - amountAlreadyClaimed
```

Solidity shape:

```solidity
function claimRecovery(uint256 epochId, address receiver)
    external
    returns (uint256 amountOut)
{
    ImpairmentEpoch storage epoch = impairmentEpochs[epochId];

    uint256 claimUnits = claims.balanceOf(msg.sender, epochId);
    if (claimUnits == 0) revert NothingToClaim();

    uint256 gross = Math.mulDiv(
        epoch.totalRecovered,
        claimUnits,
        epoch.totalClaimSupply
    );

    uint256 already = amountClaimed[epochId][msg.sender];

    if (gross <= already) revert NothingToClaim();

    amountOut = gross - already;

    amountClaimed[epochId][msg.sender] = gross;
    epoch.totalClaimed += amountOut;

    IERC20(epoch.recoveryAsset).safeTransfer(receiver, amountOut);

    emit RecoveryClaimed(
        epochId,
        msg.sender,
        receiver,
        claimUnits,
        amountOut
    );
}
```

Do not burn claim tokens on first claim unless the epoch is fully resolved. Partial recoveries may arrive over time.

---

# 11. Integrate with `CreatorOVaultStrategiesModule.sol`

This module should own the strategy-side lifecycle.

Add or adapt functions around:

```text
ejectStrategy
bestEffortWithdraw
buyDebt
migrateStrategy
removeStrategy
```

Rules:

## Strategy ejection after impairment

If strategy is finalized impaired:

```text
any recovered assets go to RecoveryEscrow / impairment epoch
not to clean-book totalAssets()
```

## Debt purchase

If someone buys the impaired/debt position:

```text
purchase proceeds = realized recovery
route to epoch claim holders
do not credit clean-book NAV
```

Unless the sale explicitly transfers the impaired upside away from claim holders. That needs to be a governance-visible auction rule.

## Strategy reinclusion

Never let the same strategy reenter active routing implicitly.

Require:

```solidity
function reinstateStrategyAfterImpairment(
    address strategy,
    uint256 epochId
) external onlyGovernance;
```

Preconditions:

```text
epoch resolved or recovery rights preserved
strategy accounting reconciles
no excluded book value reintroduced
new position treated as fresh clean-book exposure
```

---

# 12. Add optional in-kind exit support where possible

This is not the primary solution, but it is a useful fallback.

For fully transferable/divisible onchain positions, you can support:

```text
redeem pro-rata basket in kind
```

This avoids NAV/oracle dependency.

But only enable it per strategy if:

```text
underlying position is transferable
position is safely divisible
recipient can receive it
transfer does not create protocol risk
asset is not frozen/paused/exploited
```

Do not rely on in-kind redemption for Aave/Morpho/Pendle strategy positions unless the adapter can prove safe delivery.

---

# 13. Wrapper and collateral integration policy

Document this explicitly in the implementation.

At snapshot time:

```text
direct holder receives claim
wrapper contract receives claim
lending market receives claim
LP/pool receives claim
```

Do not pretend the vault can infer beneficial ownership through arbitrary composability.

For supported integrations, build adapters:

```text
Euler adapter
Morpho adapter
Aave collateral adapter
vault-wrapper adapter
```

Adapter responsibilities:

```text
receive claim units
attribute them to internal users
prevent post-snapshot users from stealing old recovery
handle liquidations around claim rights
define whether claims belong to borrower, supplier, or market
```

Until an adapter is claim-aware, the integration should be labeled:

```text
main share compatible
recovery-claim attribution not guaranteed to end user
```

---

# 14. Event and error set

Use rich events because offchain monitoring will be critical.

```solidity
event ImpairmentTripped(
    uint256 indexed epochId,
    address indexed strategy,
    uint256 indexed reasonCode,
    uint256 tripBlock,
    uint256 totalSharesAtTrip
);

event ImpairmentCleared(
    uint256 indexed epochId,
    address indexed strategy
);

event ImpairmentFinalized(
    uint256 indexed epochId,
    address indexed strategy,
    bytes32 snapshotRoot,
    uint256 totalClaimSupply,
    uint256 excludedBookValue
);

event ClaimMinted(
    uint256 indexed epochId,
    address indexed account,
    uint256 claimUnits
);

event RecoveryNotified(
    uint256 indexed epochId,
    address indexed asset,
    uint256 amountRecovered,
    uint256 totalRecovered
);

event RecoveryClaimed(
    uint256 indexed epochId,
    address indexed account,
    address indexed receiver,
    uint256 amountClaimed
);

event ImpairmentResolved(
    uint256 indexed epochId,
    uint256 totalRecovered,
    uint256 totalClaimed
);
```

Errors:

```solidity
error VaultNotNormal();
error VaultNotSuspect();
error NoActiveImpairment();
error ImpairmentAlreadyActive();
error InvalidImpairmentEpoch();
error InvalidImpairmentStrategy();
error InvalidImpairmentTransition();
error StrategyNotImpaired();
error StrategyStillValuationReady();
error StrategyNotRecoverable();
error SnapshotRootNotSet();
error InvalidClaimProof();
error ClaimAlreadyMinted();
error ClaimTransferDisabled();
error RecoveryAssetMismatch();
error NothingRecovered();
error NothingToClaim();
error RecoveryDoubleCount();
error UseWithdrawalQueue();
```

---

# 15. Testing plan

This should be implemented before production enablement.

## Atomicity tests

```text
deposit → trip → redeem in same block fails
trip → deposit fails
trip → mint fails
trip → withdraw fails or queues
trip → redeem fails or queues
finalize → deposit resumes against clean NAV
finalize → redeem resumes against clean NAV
```

## Fairness tests

```text
Alice holds before trip → gets claim
Bob deposits after finalize → gets no claim
Alice redeems clean shares after finalize → keeps claim
Bob cannot acquire claim through deposit
claim distribution pro-rata to tripBlock holders
```

## Snapshot tests

```text
valid proof mints claim
invalid proof reverts
duplicate proof reverts
wrong epoch proof reverts
wrong account proof reverts
total minted cannot exceed totalClaimSupply
wrapper address receives claim if wrapper held shares
```

## Recovery tests

```text
partial recovery distributes pro-rata
second recovery increases claimable amount
zero recovery resolution works
full recovery resolution works
overclaim impossible
same recovered assets cannot enter clean NAV
debt purchase proceeds route to recovery epoch once
strategy withdrawal proceeds route to recovery epoch once
```

## Accounting invariants

```text
cleanBookAssets excludes impaired strategies
impaired recoveries excluded from totalAssets
recovered amount never counted in both clean NAV and claim pool
post-finalization deposits cannot dilute claim holders
claim holder can redeem clean shares without losing recovery claim
```

## Integration tests

```text
shares held by direct EOA
shares held by wrapper
shares held by lending market
shares transferred after trip
shares transferred after finalize
claim ownership remains based on tripBlock holder
```

---

# 16. Rollout plan

I would ship this in four releases.

## Release 1 — Passive state machine

Implement:

```text
VaultMode
ImpairmentEpoch storage
events/errors
strategy health states
feature flag disabled
no production behavior change
```

Purpose: storage-safe deployment.

## Release 2 — Freeze and clean-book accounting

Implement:

```text
tripImpairment
clearImpairmentTrip
ERC-4626 max* behavior during Suspect
strategy exclusion from routing
strategy exclusion from totalAssets after finalize
```

Purpose: atomic arb protection.

## Release 3 — Claims and recovery escrow

Implement:

```text
CreatorOImpairmentClaims
Merkle claim minting
RecoveryEscrow
notifyRecovery
claimRecovery
```

Purpose: side-pocket economics.

## Release 4 — Strategy/debt integration and adapters

Implement:

```text
buyDebt integration
ejection proceeds routing
strategy reinclusion rules
wrapper/lending-market adapter policy
fork simulations
```

Purpose: production safety.

---

# 17. Final non-negotiable invariants

These are the invariants I would make auditors sign off on:

```text
1. No atomic ERC-4626 entry/exit can settle while vault accounting is suspect.

2. Once finalized impaired, the impaired strategy contributes zero to clean-book totalAssets.

3. No recovered value from an impaired strategy can be counted in both clean NAV and recovery distribution.

4. Claim eligibility is fixed at the impairment trip block.

5. Post-trip or post-finalization depositors cannot acquire prior-epoch recovery rights through deposit/mint.

6. Pre-impairment holders can redeem clean-book shares without forfeiting recovery rights.

7. Managers/guardians can freeze and classify impairment, but cannot choose a manual impaired NAV.

8. Recovery distribution is based only on realized assets or final settled auction/debt-sale proceeds.

9. Strategy reinclusion cannot reintroduce excluded book value into clean NAV.

10. Wrapper/lending-market claim attribution is explicit, not assumed.
```

## My recommended v1 design

For your first production version, I would ship:

```text
Merkle snapshot claims
non-transferable ERC-1155 claim token
dedicated RecoveryEscrow
permissionless objective trip + guardian emergency trip
all deposits/mints paused during Suspect
all withdrawals/redeems paused or queue-only during Suspect
finalization removes strategy from totalAssets
post-finalization vault resumes normal clean-book ERC-4626 operation
```

I would **not** ship transferable claims, arbitrary `notifyRecovery(amount)`, large-exit-only queues, or implicit wrapper attribution in v1.

The core implementation principle is simple:

```text
Freeze fast.
Do not mark.
Snapshot ownership.
Resume clean-book vault.
Distribute only realized recovery.
```

[1]: https://eips.ethereum.org/EIPS/eip-4626?utm_source=chatgpt.com "ERC-4626: Tokenized Vaults - Ethereum Improvement Proposals"
[2]: https://eips.ethereum.org/EIPS/eip-7540?utm_source=chatgpt.com "ERC-7540: Asynchronous ERC-4626 Tokenized Vaults"
