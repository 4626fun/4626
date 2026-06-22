# ERC4626Test
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/vault/tamago/test/TamagoERC4626Mirror.t.sol)

**Inherits:**
Test


## Constants
### TRANSFER_TOPIC

```solidity
bytes32 internal constant TRANSFER_TOPIC = keccak256("Transfer(address,address,uint256)")
```


### DEPOSIT_TOPIC

```solidity
bytes32 internal constant DEPOSIT_TOPIC = keccak256("Deposit(address,address,uint256,uint256)")
```


### WITHDRAW_TOPIC

```solidity
bytes32 internal constant WITHDRAW_TOPIC = keccak256("Withdraw(address,address,address,uint256,uint256)")
```


## Functions
### deployPair


```solidity
function deployPair() internal returns (ERC20Iface assetToken, ERC4626Iface vault);
```

### small


```solidity
function small(uint256 raw) internal pure returns (uint256);
```

### topic


```solidity
function topic(address account) internal pure returns (bytes32);
```

### assertHasLog2


```solidity
function assertHasLog2(
    Vm.Log[] memory logs,
    address emitter,
    bytes32 topic0,
    address indexed0,
    address indexed1,
    bytes memory data
) internal pure;
```

### assertHasLog3


```solidity
function assertHasLog3(
    Vm.Log[] memory logs,
    address emitter,
    bytes32 topic0,
    address indexed0,
    address indexed1,
    address indexed2,
    bytes memory data
) internal pure;
```

### seedDeposit


```solidity
function seedDeposit(ERC20Iface assetToken, ERC4626Iface vault, uint256 amount, address owner) internal;
```

### nonzeroReceiver


```solidity
function nonzeroReceiver(address account) internal view returns (address);
```

### balanceSlot


```solidity
function balanceSlot(address account) internal pure returns (bytes32);
```

### storageSlot


```solidity
function storageSlot(uint256 index) internal pure returns (bytes32);
```

### testFuzzAssetSpec


```solidity
function testFuzzAssetSpec() public;
```

### testFuzzDecimalsSpec


```solidity
function testFuzzDecimalsSpec() public;
```

### testFuzzTotalSupplySpec


```solidity
function testFuzzTotalSupplySpec(uint256 rawAssets) public;
```

### testFuzzTotalAssetsSpec


```solidity
function testFuzzTotalAssetsSpec(uint256 rawAssets) public;
```

### testFuzzBalanceOfSpec


```solidity
function testFuzzBalanceOfSpec(address rawReceiver, uint256 rawAssets) public;
```

### testFuzzAllowanceSpec


```solidity
function testFuzzAllowanceSpec(address spender, uint256 amount) public;
```

### testFuzzApproveSucceeds


```solidity
function testFuzzApproveSucceeds(address spender, uint256 amount) public;
```

### testFuzzApproveSetsAllowance


```solidity
function testFuzzApproveSetsAllowance(address spender, uint256 amount) public;
```

### testFuzzApproveKeepsBalances


```solidity
function testFuzzApproveKeepsBalances(address spender, uint256 rawDeposit, uint256 approval) public;
```

### testFuzzApproveKeepsTotalSupply


```solidity
function testFuzzApproveKeepsTotalSupply(address spender, uint256 rawDeposit, uint256 approval) public;
```

### testFuzzApproveEffect


```solidity
function testFuzzApproveEffect(address spender, uint256 amount) public;
```

### testFuzzTransferRevertsWhenBalanceIsLow


```solidity
function testFuzzTransferRevertsWhenBalanceIsLow(address to, uint256 rawAmount) public;
```

### testFuzzTransferToSelfKeepsBalances


```solidity
function testFuzzTransferToSelfKeepsBalances(uint256 rawDeposit, uint256 rawTransfer) public;
```

### testFuzzTransferRevertsWhenRecipientBalanceWouldOverflow


```solidity
function testFuzzTransferRevertsWhenRecipientBalanceWouldOverflow() public;
```

### testFuzzTransferMovesTokensBetweenDistinctAccounts


```solidity
function testFuzzTransferMovesTokensBetweenDistinctAccounts(
    address rawReceiver,
    uint256 rawDeposit,
    uint256 rawTransfer
) public;
```

### testFuzzTransferKeepsTotalSupply


```solidity
function testFuzzTransferKeepsTotalSupply(address rawReceiver, uint256 rawDeposit, uint256 rawTransfer) public;
```

### testFuzzTransferBalancesEffect


```solidity
function testFuzzTransferBalancesEffect(address rawReceiver, uint256 rawDeposit, uint256 rawTransfer) public;
```

### testFuzzTransferFromRevertsWhenAllowanceIsLow


```solidity
function testFuzzTransferFromRevertsWhenAllowanceIsLow(
    address rawSpender,
    address to,
    uint256 rawDeposit,
    uint256 rawSpend
) public;
```

### testFuzzTransferFromRevertsWhenBalanceIsLow


```solidity
function testFuzzTransferFromRevertsWhenBalanceIsLow(address rawSpender, address to, uint256 rawAmount) public;
```

### testFuzzTransferFromRevertsWhenRecipientBalanceWouldOverflow


```solidity
function testFuzzTransferFromRevertsWhenRecipientBalanceWouldOverflow(address rawSpender) public;
```

### testFuzzTransferFromToSelfKeepsBalances


```solidity
function testFuzzTransferFromToSelfKeepsBalances(address rawSpender, uint256 rawDeposit, uint256 rawSpend) public;
```

### testFuzzTransferFromMovesTokensBetweenDistinctAccounts


```solidity
function testFuzzTransferFromMovesTokensBetweenDistinctAccounts(
    address rawSpender,
    address rawReceiver,
    uint256 rawDeposit,
    uint256 rawSpend
) public;
```

### testFuzzTransferFromKeepsTotalSupply


```solidity
function testFuzzTransferFromKeepsTotalSupply(
    address rawSpender,
    address rawReceiver,
    uint256 rawDeposit,
    uint256 rawSpend
) public;
```

### testFuzzTransferFromKeepsInfiniteAllowance


```solidity
function testFuzzTransferFromKeepsInfiniteAllowance(
    address rawSpender,
    address rawReceiver,
    uint256 rawDeposit,
    uint256 rawSpend
) public;
```

### testFuzzTransferFromSpendsFiniteAllowance


```solidity
function testFuzzTransferFromSpendsFiniteAllowance(
    address rawSpender,
    address rawReceiver,
    uint256 rawDeposit,
    uint256 rawSpend
) public;
```

### testFuzzTransferFromEffect


```solidity
function testFuzzTransferFromEffect(address spender, address rawReceiver, uint256 rawDeposit, uint256 rawSpend)
    public;
```

### testFuzzConvertToSharesSpec


```solidity
function testFuzzConvertToSharesSpec(uint256 rawAssets) public;
```

### testFuzzConvertToAssetsSpec


```solidity
function testFuzzConvertToAssetsSpec(uint256 rawShares) public;
```

### testFuzzMaxDepositSpec


```solidity
function testFuzzMaxDepositSpec(address rawReceiver) public;
```

### testFuzzMaxMintSpec


```solidity
function testFuzzMaxMintSpec(address rawReceiver) public;
```

### testFuzzMaxWithdrawSpec


```solidity
function testFuzzMaxWithdrawSpec(uint256 rawAssets) public;
```

### testFuzzMaxRedeemSpec


```solidity
function testFuzzMaxRedeemSpec(uint256 rawAssets) public;
```

### testFuzzPreviewDepositSpec


```solidity
function testFuzzPreviewDepositSpec(uint256 rawAssets) public;
```

### testFuzzPreviewMintSpec


```solidity
function testFuzzPreviewMintSpec(uint256 rawShares) public;
```

### testFuzzPreviewWithdrawSpec


```solidity
function testFuzzPreviewWithdrawSpec(uint256 rawAssets) public;
```

### testFuzzPreviewRedeemSpec


```solidity
function testFuzzPreviewRedeemSpec(uint256 rawShares) public;
```

### testFuzzDepositReturnsAtLeastPreview


```solidity
function testFuzzDepositReturnsAtLeastPreview(uint256 rawInitial, uint256 rawYield, uint256 rawAssets) public;
```

### testFuzzMintPullsNoMoreThanPreview


```solidity
function testFuzzMintPullsNoMoreThanPreview(uint256 rawInitial, uint256 rawYield, uint256 rawShares) public;
```

### testFuzzWithdrawBurnsNoMoreThanPreview


```solidity
function testFuzzWithdrawBurnsNoMoreThanPreview(uint256 rawInitial, uint256 rawYield, uint256 rawWithdraw) public;
```

### testFuzzRedeemReturnsAtLeastPreview


```solidity
function testFuzzRedeemReturnsAtLeastPreview(uint256 rawInitial, uint256 rawYield, uint256 rawRedeem) public;
```

### testFuzzDepositRevertsWhenReceiverBalanceWouldOverflow


```solidity
function testFuzzDepositRevertsWhenReceiverBalanceWouldOverflow(address rawReceiver) public;
```

### testFuzzDepositRevertsWhenTotalSupplyWouldOverflow


```solidity
function testFuzzDepositRevertsWhenTotalSupplyWouldOverflow(address rawReceiver) public;
```

### testFuzzDepositRevertsWhenTotalAssetsWouldOverflow


```solidity
function testFuzzDepositRevertsWhenTotalAssetsWouldOverflow(address rawReceiver) public;
```

### testFuzzDepositSucceedsWhenAccountingDoesNotOverflow


```solidity
function testFuzzDepositSucceedsWhenAccountingDoesNotOverflow(address rawReceiver, uint256 rawAssets) public;
```

### testFuzzDepositCreditsReceiver


```solidity
function testFuzzDepositCreditsReceiver(address rawReceiver, uint256 rawAssets) public;
```

### testFuzzDepositIncreasesTotalSupply


```solidity
function testFuzzDepositIncreasesTotalSupply(address rawReceiver, uint256 rawAssets) public;
```

### testFuzzDepositIncreasesTotalAssets


```solidity
function testFuzzDepositIncreasesTotalAssets(address rawReceiver, uint256 rawAssets) public;
```

### testFuzzDepositKeepsAsset


```solidity
function testFuzzDepositKeepsAsset(address rawReceiver, uint256 rawAssets) public;
```

### testFuzzDepositEffect


```solidity
function testFuzzDepositEffect(address rawReceiver, uint256 rawAssets) public;
```

### testFuzzMintRevertsWhenReceiverBalanceWouldOverflow


```solidity
function testFuzzMintRevertsWhenReceiverBalanceWouldOverflow() public;
```

### testFuzzMintRevertsWhenTotalSupplyWouldOverflow


```solidity
function testFuzzMintRevertsWhenTotalSupplyWouldOverflow() public;
```

### testFuzzMintRevertsWhenTotalAssetsWouldOverflow


```solidity
function testFuzzMintRevertsWhenTotalAssetsWouldOverflow() public;
```

### testFuzzMintSucceedsWhenAccountingDoesNotOverflow


```solidity
function testFuzzMintSucceedsWhenAccountingDoesNotOverflow(address rawReceiver, uint256 rawShares) public;
```

### testFuzzMintCreditsReceiver


```solidity
function testFuzzMintCreditsReceiver(address rawReceiver, uint256 rawShares) public;
```

### testFuzzMintIncreasesTotalSupply


```solidity
function testFuzzMintIncreasesTotalSupply(address rawReceiver, uint256 rawShares) public;
```

### testFuzzMintIncreasesTotalAssets


```solidity
function testFuzzMintIncreasesTotalAssets(address rawReceiver, uint256 rawShares) public;
```

### testFuzzMintKeepsAsset


```solidity
function testFuzzMintKeepsAsset(address rawReceiver, uint256 rawShares) public;
```

### testFuzzMintEffect


```solidity
function testFuzzMintEffect(address rawReceiver, uint256 rawShares) public;
```

### testFuzzWithdrawRevertsWhenAssetsExceedMax


```solidity
function testFuzzWithdrawRevertsWhenAssetsExceedMax(uint256 rawDeposit) public;
```

### testFuzzWithdrawRevertsWhenAllowanceIsLow


```solidity
function testFuzzWithdrawRevertsWhenAllowanceIsLow(address rawSpender, uint256 rawDeposit, uint256 rawWithdraw)
    public;
```

### testFuzzWithdrawRevertsWhenTotalSupplyIsLow


```solidity
function testFuzzWithdrawRevertsWhenTotalSupplyIsLow() public;
```

### testFuzzWithdrawRevertsWhenTotalAssetsIsLow


```solidity
function testFuzzWithdrawRevertsWhenTotalAssetsIsLow() public;
```

### testFuzzWithdrawSucceedsWhenAccountingAndAllowanceAreEnough


```solidity
function testFuzzWithdrawSucceedsWhenAccountingAndAllowanceAreEnough(
    address rawReceiver,
    uint256 rawDeposit,
    uint256 rawWithdraw
) public;
```

### testFuzzWithdrawDebitsOwner


```solidity
function testFuzzWithdrawDebitsOwner(address rawReceiver, uint256 rawDeposit, uint256 rawWithdraw) public;
```

### testFuzzWithdrawDecreasesTotalSupply


```solidity
function testFuzzWithdrawDecreasesTotalSupply(address rawReceiver, uint256 rawDeposit, uint256 rawWithdraw) public;
```

### testFuzzWithdrawDecreasesTotalAssets


```solidity
function testFuzzWithdrawDecreasesTotalAssets(address rawReceiver, uint256 rawDeposit, uint256 rawWithdraw) public;
```

### testFuzzWithdrawKeepsOwnerOrInfiniteAllowance


```solidity
function testFuzzWithdrawKeepsOwnerOrInfiniteAllowance(
    address rawSpender,
    address rawReceiver,
    uint256 rawDeposit,
    uint256 rawWithdraw
) public;
```

### testFuzzWithdrawSpendsFiniteAllowance


```solidity
function testFuzzWithdrawSpendsFiniteAllowance(
    address rawSpender,
    address rawReceiver,
    uint256 rawDeposit,
    uint256 rawWithdraw
) public;
```

### testFuzzWithdrawEffect


```solidity
function testFuzzWithdrawEffect(address rawReceiver, uint256 rawDeposit, uint256 rawWithdraw) public;
```

### testFuzzRedeemRevertsWhenSharesExceedMax


```solidity
function testFuzzRedeemRevertsWhenSharesExceedMax(uint256 rawDeposit) public;
```

### testFuzzRedeemRevertsWhenAllowanceIsLow


```solidity
function testFuzzRedeemRevertsWhenAllowanceIsLow(address rawSpender, uint256 rawDeposit, uint256 rawRedeem) public;
```

### testFuzzRedeemRevertsWhenTotalSupplyIsLow


```solidity
function testFuzzRedeemRevertsWhenTotalSupplyIsLow() public;
```

### testFuzzRedeemSucceedsWhenAccountingAndAllowanceAreEnough


```solidity
function testFuzzRedeemSucceedsWhenAccountingAndAllowanceAreEnough(
    address rawReceiver,
    uint256 rawDeposit,
    uint256 rawRedeem
) public;
```

### testFuzzRedeemDebitsOwner


```solidity
function testFuzzRedeemDebitsOwner(address rawReceiver, uint256 rawDeposit, uint256 rawRedeem) public;
```

### testFuzzRedeemDecreasesTotalSupply


```solidity
function testFuzzRedeemDecreasesTotalSupply(address rawReceiver, uint256 rawDeposit, uint256 rawRedeem) public;
```

### testFuzzRedeemDecreasesTotalAssets


```solidity
function testFuzzRedeemDecreasesTotalAssets(address rawReceiver, uint256 rawDeposit, uint256 rawRedeem) public;
```

### testFuzzRedeemKeepsOwnerOrInfiniteAllowance


```solidity
function testFuzzRedeemKeepsOwnerOrInfiniteAllowance(
    address rawSpender,
    address rawReceiver,
    uint256 rawDeposit,
    uint256 rawRedeem
) public;
```

### testFuzzRedeemSpendsFiniteAllowance


```solidity
function testFuzzRedeemSpendsFiniteAllowance(
    address rawSpender,
    address rawReceiver,
    uint256 rawDeposit,
    uint256 rawRedeem
) public;
```

### testFuzzRedeemEffect


```solidity
function testFuzzRedeemEffect(address rawReceiver, uint256 rawDeposit, uint256 rawRedeem) public;
```

### testFuzzVaultViewsAndPreviews


```solidity
function testFuzzVaultViewsAndPreviews(address receiver, address owner, uint256 rawAssets, uint256 rawShares)
    public;
```

### testFuzzDepositMintsSharesAndTracksAssets


```solidity
function testFuzzDepositMintsSharesAndTracksAssets(address receiver, uint256 rawAssets) public;
```

### testFuzzMintPullsAssetsAndMintsShares


```solidity
function testFuzzMintPullsAssetsAndMintsShares(address receiver, uint256 rawShares) public;
```

### testFuzzApproveUpdatesShareAllowance


```solidity
function testFuzzApproveUpdatesShareAllowance(address spender, uint256 amount) public;
```

### testFuzzShareTransferMovesBalances


```solidity
function testFuzzShareTransferMovesBalances(address receiver, uint256 rawDeposit, uint256 rawTransfer) public;
```

### testFuzzShareTransferFromUpdatesAllowance


```solidity
function testFuzzShareTransferFromUpdatesAllowance(
    address spender,
    address receiver,
    uint256 rawDeposit,
    uint256 rawSpend
) public;
```

### testFuzzShareTransferFromKeepsInfiniteAllowance


```solidity
function testFuzzShareTransferFromKeepsInfiniteAllowance(
    address spender,
    address receiver,
    uint256 rawDeposit,
    uint256 rawSpend
) public;
```

### testFuzzWithdrawBurnsSharesAndSendsAssets


```solidity
function testFuzzWithdrawBurnsSharesAndSendsAssets(address receiver, uint256 rawDeposit, uint256 rawWithdraw)
    public;
```

### testFuzzRedeemBurnsSharesAndSendsAssets


```solidity
function testFuzzRedeemBurnsSharesAndSendsAssets(address receiver, uint256 rawDeposit, uint256 rawRedeem) public;
```

### testFuzzWithdrawRequiresShareAllowance


```solidity
function testFuzzWithdrawRequiresShareAllowance(address spender, uint256 rawDeposit, uint256 rawWithdraw) public;
```

### testFuzzWithdrawMoreThanMaxReverts


```solidity
function testFuzzWithdrawMoreThanMaxReverts(uint256 rawDeposit) public;
```

### testFuzzRedeemRequiresShareAllowance


```solidity
function testFuzzRedeemRequiresShareAllowance(address spender, uint256 rawDeposit, uint256 rawRedeem) public;
```

### testFuzzRedeemMoreThanMaxReverts


```solidity
function testFuzzRedeemMoreThanMaxReverts(uint256 rawDeposit) public;
```

### positiveSmall


```solidity
function positiveSmall(uint256 raw) internal pure returns (uint256);
```

### shareWealth


```solidity
function shareWealth(ERC20Iface assetToken, ERC4626Iface vault, address account) internal view returns (uint256);
```

### donateToVault


```solidity
function donateToVault(ERC20Iface assetToken, ERC4626Iface vault, uint256 amount) internal;
```

### distributeYield


```solidity
function distributeYield(ERC20Iface assetToken, ERC4626Iface vault, uint256 amount) internal;
```

### vaultSurplus


```solidity
function vaultSurplus(ERC20Iface assetToken, ERC4626Iface vault) internal view returns (uint256);
```

### runClosedWorldFuzzTrace


```solidity
function runClosedWorldFuzzTrace(
    uint256 rawDeposit,
    uint256 rawDonation,
    uint256 rawYield,
    uint256 rawTransfer,
    uint256 rawTransferFrom,
    uint256 rawWithdraw,
    uint256 rawRedeem,
    uint256 rawFixedShares
) internal returns (ClosedWorldTrace memory trace);
```

### testFuzzDepositPullsAssetsFromSender


```solidity
function testFuzzDepositPullsAssetsFromSender(uint256 rawAssets) public;
```

### testFuzzDepositIncreasesVaultAssetBalance


```solidity
function testFuzzDepositIncreasesVaultAssetBalance(uint256 rawAssets) public;
```

### testFuzzMintPullsRequiredAssetsFromSender


```solidity
function testFuzzMintPullsRequiredAssetsFromSender(uint256 rawShares) public;
```

### testFuzzMintIncreasesVaultAssetBalance


```solidity
function testFuzzMintIncreasesVaultAssetBalance(uint256 rawShares) public;
```

### testFuzzWithdrawSendsAssetsToReceiver


```solidity
function testFuzzWithdrawSendsAssetsToReceiver(address rawReceiver, uint256 rawDeposit, uint256 rawWithdraw)
    public;
```

### testFuzzWithdrawDecreasesVaultAssetBalance


```solidity
function testFuzzWithdrawDecreasesVaultAssetBalance(address rawReceiver, uint256 rawDeposit, uint256 rawWithdraw)
    public;
```

### testFuzzRedeemSendsRedeemedAssetsToReceiver


```solidity
function testFuzzRedeemSendsRedeemedAssetsToReceiver(address rawReceiver, uint256 rawDeposit, uint256 rawRedeem)
    public;
```

### testFuzzRedeemDecreasesVaultAssetBalance


```solidity
function testFuzzRedeemDecreasesVaultAssetBalance(address rawReceiver, uint256 rawDeposit, uint256 rawRedeem)
    public;
```

### testFuzzDepositRevertKeepsAssetBalances


```solidity
function testFuzzDepositRevertKeepsAssetBalances(address rawReceiver, uint256 rawAssets) public;
```

### testFuzzMintRevertKeepsAssetBalances


```solidity
function testFuzzMintRevertKeepsAssetBalances(address rawReceiver, uint256 rawShares) public;
```

### testFuzzWithdrawRevertKeepsAssetBalances


```solidity
function testFuzzWithdrawRevertKeepsAssetBalances(address rawReceiver, uint256 rawDeposit, uint256 rawExtra)
    public;
```

### testFuzzRedeemRevertKeepsAssetBalances


```solidity
function testFuzzRedeemRevertKeepsAssetBalances(address rawReceiver, uint256 rawDeposit, uint256 rawExtra) public;
```

### testFuzzNoDonationDepositPreservesBacking


```solidity
function testFuzzNoDonationDepositPreservesBacking(uint256 rawAssets) public;
```

### testFuzzNoDonationMintPreservesBacking


```solidity
function testFuzzNoDonationMintPreservesBacking(uint256 rawShares) public;
```

### testFuzzNoDonationWithdrawPreservesBacking


```solidity
function testFuzzNoDonationWithdrawPreservesBacking(uint256 rawDeposit, uint256 rawWithdraw) public;
```

### testFuzzNoDonationRedeemPreservesBacking


```solidity
function testFuzzNoDonationRedeemPreservesBacking(uint256 rawDeposit, uint256 rawRedeem) public;
```

### testFuzzDonationPermittedBackingCoversTotalAssets


```solidity
function testFuzzDonationPermittedBackingCoversTotalAssets(uint256 rawDeposit, uint256 rawDonation) public;
```

### testFuzzTransferKeepsTotalAssetsAndBacking


```solidity
function testFuzzTransferKeepsTotalAssetsAndBacking(address rawReceiver, uint256 rawDeposit, uint256 rawTransfer)
    public;
```

### testFuzzTransferFromKeepsTotalAssetsAndBacking


```solidity
function testFuzzTransferFromKeepsTotalAssetsAndBacking(
    address rawSpender,
    address rawReceiver,
    uint256 rawDeposit,
    uint256 rawSpend
) public;
```

### testFuzzApproveKeepsTotalAssetsAndBacking


```solidity
function testFuzzApproveKeepsTotalAssetsAndBacking(address spender, uint256 rawDeposit, uint256 allowanceAmount)
    public;
```

### testFuzzDepositPreservesFixedShareValue


```solidity
function testFuzzDepositPreservesFixedShareValue(uint256 rawInitial, uint256 rawDeposit, uint256 rawFixedShares)
    public;
```

### testFuzzMintPreservesFixedShareValue


```solidity
function testFuzzMintPreservesFixedShareValue(uint256 rawInitial, uint256 rawMint, uint256 rawFixedShares) public;
```

### testFuzzWithdrawPreservesFixedShareValue


```solidity
function testFuzzWithdrawPreservesFixedShareValue(uint256 rawDeposit, uint256 rawWithdraw, uint256 rawFixedShares)
    public;
```

### testFuzzRedeemPreservesFixedShareValue


```solidity
function testFuzzRedeemPreservesFixedShareValue(uint256 rawDeposit, uint256 rawRedeem, uint256 rawFixedShares)
    public;
```

### testFuzzTransferKeepsConvertToAssets


```solidity
function testFuzzTransferKeepsConvertToAssets(
    address rawReceiver,
    uint256 rawDeposit,
    uint256 rawTransfer,
    uint256 rawFixedShares
) public;
```

### testFuzzTransferFromKeepsConvertToAssets


```solidity
function testFuzzTransferFromKeepsConvertToAssets(
    address rawSpender,
    address rawReceiver,
    uint256 rawDeposit,
    uint256 rawSpend,
    uint256 rawFixedShares
) public;
```

### testFuzzApproveKeepsConvertToAssets


```solidity
function testFuzzApproveKeepsConvertToAssets(
    address spender,
    uint256 rawDeposit,
    uint256 rawFixedShares,
    uint256 allowanceAmount
) public;
```

### testFuzzDepositThenRedeemNoProfit


```solidity
function testFuzzDepositThenRedeemNoProfit(uint256 rawAssets) public;
```

### testFuzzMintThenRedeemNoProfit


```solidity
function testFuzzMintThenRedeemNoProfit(uint256 rawShares) public;
```

### testFuzzDepositThenWithdrawNoProfit


```solidity
function testFuzzDepositThenWithdrawNoProfit(uint256 rawAssets) public;
```

### testFuzzMintThenWithdrawNoProfit


```solidity
function testFuzzMintThenWithdrawNoProfit(uint256 rawShares) public;
```

### testFuzzClosedWorldDonationKeepsManagedAccountingAndExchangeRate


```solidity
function testFuzzClosedWorldDonationKeepsManagedAccountingAndExchangeRate(
    uint256 rawDeposit,
    uint256 rawDonation,
    uint256 rawFixedShares,
    uint256 rawProbeAssets
) public;
```

### testFuzzClosedWorldYieldDistributionPreservesBackingAndSupply


```solidity
function testFuzzClosedWorldYieldDistributionPreservesBackingAndSupply(
    uint256 rawDeposit,
    uint256 rawYield,
    uint256 rawFixedShares,
    uint256 rawProbeAssets
) public;
```

### testFuzzClosedWorldDepositDonateVictimDepositRedeemNoProfit


```solidity
function testFuzzClosedWorldDepositDonateVictimDepositRedeemNoProfit(
    uint256 rawAttackerDeposit,
    uint256 rawDonation,
    uint256 rawVictimDeposit
) public;
```

### testFuzzClosedWorldDonationSurplusNotWithdrawableWithoutYieldRecognition


```solidity
function testFuzzClosedWorldDonationSurplusNotWithdrawableWithoutYieldRecognition(
    uint256 rawDeposit,
    uint256 rawDonation,
    uint256 rawWithdraw,
    uint256 rawRedeem
) public;
```

### testFuzzClosedWorldManagedAssetsCoverShareSupply


```solidity
function testFuzzClosedWorldManagedAssetsCoverShareSupply(
    uint256 rawDeposit,
    uint256 rawDonation,
    uint256 rawYield,
    uint256 rawTransfer,
    uint256 rawTransferFrom,
    uint256 rawWithdraw,
    uint256 rawRedeem,
    uint256 rawFixedShares
) public;
```

### testFuzzClosedWorldPreservesVaultAssetBacking


```solidity
function testFuzzClosedWorldPreservesVaultAssetBacking(
    uint256 rawDeposit,
    uint256 rawDonation,
    uint256 rawYield,
    uint256 rawTransfer,
    uint256 rawTransferFrom,
    uint256 rawWithdraw,
    uint256 rawRedeem,
    uint256 rawFixedShares
) public;
```

### testFuzzClosedWorldConvertToAssetsAtLeastIdentity


```solidity
function testFuzzClosedWorldConvertToAssetsAtLeastIdentity(
    uint256 rawDeposit,
    uint256 rawDonation,
    uint256 rawYield,
    uint256 rawTransfer,
    uint256 rawTransferFrom,
    uint256 rawWithdraw,
    uint256 rawRedeem,
    uint256 rawFixedShares
) public;
```

### testFuzzClosedWorldConvertToSharesAtMostIdentity


```solidity
function testFuzzClosedWorldConvertToSharesAtMostIdentity(
    uint256 rawDeposit,
    uint256 rawDonation,
    uint256 rawYield,
    uint256 rawTransfer,
    uint256 rawTransferFrom,
    uint256 rawWithdraw,
    uint256 rawRedeem,
    uint256 rawFixedShares
) public;
```

### testFuzzClosedWorldFixedShareValueNeverDecreases


```solidity
function testFuzzClosedWorldFixedShareValueNeverDecreases(
    uint256 rawDeposit,
    uint256 rawDonation,
    uint256 rawYield,
    uint256 rawTransfer,
    uint256 rawTransferFrom,
    uint256 rawWithdraw,
    uint256 rawRedeem,
    uint256 rawFixedShares
) public;
```

### testFuzzClosedWorldCallerWealthNoUnearnedIncrease


```solidity
function testFuzzClosedWorldCallerWealthNoUnearnedIncrease(
    uint256 rawDeposit,
    uint256 rawDonation,
    uint256 rawYield,
    uint256 rawTransfer,
    uint256 rawTransferFrom,
    uint256 rawWithdraw,
    uint256 rawRedeem,
    uint256 rawFixedShares
) public;
```

## Events
### Transfer

```solidity
event Transfer(address indexed from, address indexed to, uint256 value);
```

### Approval

```solidity
event Approval(address indexed owner, address indexed spender, uint256 value);
```

### Deposit

```solidity
event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);
```

### Withdraw

```solidity
event Withdraw(
    address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
);
```

## Structs
### ClosedWorldTrace

```solidity
struct ClosedWorldTrace {
    ERC20Iface assetToken;
    ERC4626Iface vault;
    address alice;
    address bob;
    uint256 initialAssets;
    uint256 donationAmount;
    uint256 yieldAmount;
    uint256 fixedShares;
    uint256 fixedValueBefore;
}
```

