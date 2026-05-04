// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../contracts/vault/CreatorOVault.sol";
import {CreatorOVaultAdminModule} from "../contracts/vault/modules/CreatorOVaultAdminModule.sol";
import {CreatorOVaultCoreModule} from "../contracts/vault/modules/CreatorOVaultCoreModule.sol";
import {CreatorOVaultStrategiesModule} from "../contracts/vault/modules/CreatorOVaultStrategiesModule.sol";
import "../contracts/interfaces/IStrategy.sol";
import "../contracts/interfaces/IStrategyValuation.sol";

abstract contract CreatorOVaultModulesTestBase is Test {
    address internal coreModule;
    address internal strategiesModule;
    address internal adminModule;

    function setUp() public virtual {
        coreModule = address(new CreatorOVaultCoreModule());
        strategiesModule = address(new CreatorOVaultStrategiesModule());
        adminModule = address(new CreatorOVaultAdminModule());
    }

    function _setVaultModules(CreatorOVault v) internal {
        v.setModulesOnce(coreModule, strategiesModule, adminModule);
    }
}

contract MockCreatorCoinStandard is ERC20 {
    constructor() ERC20("Creator Coin", "CR8R") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Burns 10% of every transfer amount, so receiver gets 90%.
contract MockCreatorCoinFeeOnTransfer is ERC20 {
    constructor() ERC20("Fee Creator Coin", "FEE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        // Apply a transfer tax on normal transfers only (not mint/burn).
        if (from != address(0) && to != address(0) && value > 0) {
            uint256 fee = value / 10; // 10%
            uint256 sendAmount = value - fee;

            super._update(from, to, sendAmount);
            if (fee > 0) {
                super._update(from, address(0), fee); // burn fee
            }
            return;
        }

        super._update(from, to, value);
    }
}

/// @dev Test-only harness to set debt state so we can reach `buyDebt` transfer paths.
contract CreatorOVaultDebtHarness is CreatorOVault {
    constructor(address creatorCoin, address owner_)
        CreatorOVault(creatorCoin, owner_, "Creator OVault", "ovHARNESS")
    {}

    function __setDebtForTest(address strategy, uint256 debt) external {
        activeStrategies[strategy] = true;
        strategyDebt[strategy] = debt;
        totalDebt = debt;
    }
}

contract MockShortWithdrawStrategy is IStrategy, IStrategyValuation {
    IERC20 public immutable TOKEN;
    uint256 public trackedAssets;
    bool public active = true;

    constructor(address token_) {
        TOKEN = IERC20(token_);
    }

    function setTrackedAssetsForTest(uint256 assets) external {
        trackedAssets = assets;
    }

    function isValuationReady() external pure override returns (bool) {
        return true;
    }

    function isActive() external view override returns (bool) {
        return active;
    }

    function asset() external view override returns (address) {
        return address(TOKEN);
    }

    function getTotalAssets() external view override returns (uint256) {
        return trackedAssets;
    }

    function deposit(uint256 amount) external override returns (uint256 deposited) {
        if (amount == 0) return 0;
        require(TOKEN.transferFrom(msg.sender, address(this), amount), "transferFrom failed");
        trackedAssets += amount;
        return amount;
    }

    function withdraw(uint256 amount) external override returns (uint256 withdrawn) {
        uint256 maxWithdrawable = amount / 2;
        withdrawn = maxWithdrawable > trackedAssets ? trackedAssets : maxWithdrawable;
        if (withdrawn == 0) return 0;
        trackedAssets -= withdrawn;
        require(TOKEN.transfer(msg.sender, withdrawn), "transfer failed");
    }

    function emergencyWithdraw() external override returns (uint256 withdrawn) {
        withdrawn = trackedAssets;
        trackedAssets = 0;
        if (withdrawn > 0) {
            require(TOKEN.transfer(msg.sender, withdrawn), "transfer failed");
        }
    }

    function harvest() external pure override returns (uint256 profit) {
        return 0;
    }

    function rebalance() external override {}
}

contract CreatorOVaultTransferAccountingTest is CreatorOVaultModulesTestBase {
    address internal alice = makeAddr("alice");
    address internal donor = makeAddr("donor");

    function test_deposit_reverts_when_feeOnTransfer_token_receivedLessThanRequested() public {
        MockCreatorCoinFeeOnTransfer creatorCoin = new MockCreatorCoinFeeOnTransfer();
        CreatorOVault vault = new CreatorOVault(address(creatorCoin), address(this), "Creator OVault", "ovFEE");
        _setVaultModules(vault);

        uint256 amount = vault.MINIMUM_FIRST_DEPOSIT(); // divisible by 10
        creatorCoin.mint(alice, amount);

        vm.prank(alice);
        creatorCoin.approve(address(vault), type(uint256).max);

        uint256 expectedReceived = amount - (amount / 10);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(CreatorOVault.TransferAmountMismatch.selector, amount, expectedReceived));
        vault.deposit(amount, alice);

        assertEq(vault.totalSupply(), 0);
        assertEq(creatorCoin.balanceOf(address(vault)), 0);
        assertEq(vault.coinBalance(), 0);
        assertEq(creatorCoin.balanceOf(alice), amount);
    }

    function test_mint_reverts_when_feeOnTransfer_token_receivedLessThanRequested() public {
        MockCreatorCoinFeeOnTransfer creatorCoin = new MockCreatorCoinFeeOnTransfer();
        CreatorOVault vault = new CreatorOVault(address(creatorCoin), address(this), "Creator OVault", "ovFEE");
        _setVaultModules(vault);

        uint256 assets = vault.MINIMUM_FIRST_DEPOSIT(); // divisible by 10
        // For OZ ERC4626 with _decimalsOffset() = 3 and supply=0/totalAssets=0, this corresponds to `assets`.
        uint256 shares = assets * 1000;

        creatorCoin.mint(alice, assets);
        vm.prank(alice);
        creatorCoin.approve(address(vault), type(uint256).max);

        uint256 expectedReceived = assets - (assets / 10);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(CreatorOVault.TransferAmountMismatch.selector, assets, expectedReceived));
        vault.mint(shares, alice);

        assertEq(vault.totalSupply(), 0);
        assertEq(creatorCoin.balanceOf(address(vault)), 0);
        assertEq(vault.coinBalance(), 0);
        assertEq(creatorCoin.balanceOf(alice), assets);
    }

    function test_injectCapital_reverts_when_feeOnTransfer_token_receivedLessThanRequested() public {
        MockCreatorCoinFeeOnTransfer creatorCoin = new MockCreatorCoinFeeOnTransfer();
        CreatorOVault vault = new CreatorOVault(address(creatorCoin), address(this), "Creator OVault", "ovFEE");
        _setVaultModules(vault);

        uint256 amount = 1_000e18;
        // injectCapital now requires onlyManagement (M-04 fix); mint to test contract (owner) instead
        creatorCoin.mint(address(this), amount);
        creatorCoin.approve(address(vault), type(uint256).max);

        uint256 expectedReceived = amount - (amount / 10);
        vm.expectRevert(abi.encodeWithSelector(CreatorOVault.TransferAmountMismatch.selector, amount, expectedReceived));
        vault.injectCapital(amount);

        assertEq(creatorCoin.balanceOf(address(vault)), 0);
        assertEq(vault.coinBalance(), 0);
        assertEq(creatorCoin.balanceOf(address(this)), amount);
    }

    function test_buyDebt_reverts_when_feeOnTransfer_token_receivedLessThanRequested() public {
        MockCreatorCoinFeeOnTransfer creatorCoin = new MockCreatorCoinFeeOnTransfer();
        CreatorOVaultDebtHarness vault = new CreatorOVaultDebtHarness(address(creatorCoin), address(this));
        _setVaultModules(vault);

        address strategy = makeAddr("strategy");
        uint256 debt = 10_000e18;
        vault.__setDebtForTest(strategy, debt);

        vault.setDebtPurchaser(alice);

        creatorCoin.mint(alice, debt);
        vm.prank(alice);
        creatorCoin.approve(address(vault), type(uint256).max);

        uint256 expectedReceived = debt - (debt / 10);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(CreatorOVault.TransferAmountMismatch.selector, debt, expectedReceived));
        vault.buyDebt(strategy, debt);

        assertEq(creatorCoin.balanceOf(address(vault)), 0);
        assertEq(vault.coinBalance(), 0);
        assertEq(creatorCoin.balanceOf(alice), debt);
    }

    function test_coinBalance_tracks_actual_balance_for_standard_token_success_paths() public {
        MockCreatorCoinStandard creatorCoin = new MockCreatorCoinStandard();
        CreatorOVault vault = new CreatorOVault(address(creatorCoin), address(this), "Creator OVault", "ovCR8R");
        _setVaultModules(vault);

        uint256 amount = vault.MINIMUM_FIRST_DEPOSIT();
        creatorCoin.mint(alice, amount + 100e18);
        creatorCoin.mint(donor, 500e18);

        vm.prank(alice);
        creatorCoin.approve(address(vault), type(uint256).max);
        vm.prank(donor);
        creatorCoin.approve(address(vault), type(uint256).max);

        vm.prank(alice);
        vault.deposit(amount, alice);
        assertEq(vault.coinBalance(), creatorCoin.balanceOf(address(vault)));

        // injectCapital now requires onlyManagement (M-04 fix); call as owner
        vm.prank(donor);
        creatorCoin.transfer(address(this), 200e18);
        creatorCoin.approve(address(vault), 200e18);
        vault.injectCapital(200e18);
        assertEq(vault.coinBalance(), creatorCoin.balanceOf(address(vault)));

        // Withdraw a small amount; disable delay for this test.
        vault.setFlashLoanProtection(0, type(uint256).max, 1);
        vm.prank(alice);
        vault.withdraw(50e18, alice, alice);
        assertEq(vault.coinBalance(), creatorCoin.balanceOf(address(vault)));
    }

    function test_forceDeploy_tracks_measured_spent_when_strategy_partial_spend_and_misreports() public {
        MockCreatorCoinStandard creatorCoin = new MockCreatorCoinStandard();
        CreatorOVault vault = new CreatorOVault(address(creatorCoin), address(this), "Creator OVault", "ovCR8R");
        _setVaultModules(vault);

        MockPartialSpendStrategy strategy = new MockPartialSpendStrategy(address(creatorCoin), 9_000, 10_000);
        vault.addStrategy(address(strategy), 10_000, true);
        vault.setMinimumTotalIdle(0);

        uint256 amount = vault.MINIMUM_FIRST_DEPOSIT() * 2;
        creatorCoin.mint(alice, amount);

        vm.startPrank(alice);
        creatorCoin.approve(address(vault), type(uint256).max);
        vault.deposit(amount, alice);
        vm.stopPrank();

        uint256 idleBeforeDeploy = creatorCoin.balanceOf(address(vault));
        uint256 deployable = idleBeforeDeploy - vault.deploymentThreshold();
        uint256 expectedSpent = (deployable * 9_000) / 10_000;

        vault.forceDeployToStrategies();

        assertEq(vault.strategyDebt(address(strategy)), expectedSpent);
        assertEq(vault.totalDebt(), expectedSpent);
        assertEq(strategy.trackedAssets(), expectedSpent);
        assertEq(vault.coinBalance(), creatorCoin.balanceOf(address(vault)));
    }

    function test_removeStrategy_reverts_when_strategy_withdraws_less_than_debt() public {
        MockCreatorCoinStandard creatorCoin = new MockCreatorCoinStandard();
        CreatorOVaultDebtHarness vault = new CreatorOVaultDebtHarness(address(creatorCoin), address(this));
        _setVaultModules(vault);

        MockShortWithdrawStrategy strategy = new MockShortWithdrawStrategy(address(creatorCoin));
        uint256 tracked = 50e18;
        uint256 debt = 100e18;

        creatorCoin.mint(address(strategy), tracked);
        strategy.setTrackedAssetsForTest(tracked);
        vault.__setDebtForTest(address(strategy), debt);

        vm.expectRevert(
            abi.encodeWithSelector(CreatorOVaultStrategiesModule.StrategyWithdrawShortfall.selector, debt, tracked)
        );
        vault.removeStrategy(address(strategy));
    }
}

contract MockRevertableStrategy is IStrategy, IStrategyValuation {
    IERC20 public immutable TOKEN;
    bool public active = true;
    bool public revertOnGetTotalAssets;
    bool public revertOnWithdraw;
    uint256 public trackedAssets;
    uint256 public withdrawCalls;

    constructor(address token_) {
        TOKEN = IERC20(token_);
    }

    function setRevertOnGetTotalAssets(bool value) external {
        revertOnGetTotalAssets = value;
    }

    function setRevertOnWithdraw(bool value) external {
        revertOnWithdraw = value;
    }

    function isValuationReady() external view override returns (bool) {
        // Match the vault's strict guard: if `getTotalAssets()` would revert, valuation is not ready.
        return !revertOnGetTotalAssets;
    }

    function isActive() external view override returns (bool) {
        return active;
    }

    function asset() external view override returns (address) {
        return address(TOKEN);
    }

    function getTotalAssets() external view override returns (uint256) {
        if (revertOnGetTotalAssets) revert("GET_TOTAL_ASSETS_REVERT");
        return trackedAssets;
    }

    function deposit(uint256 amount) external override returns (uint256 deposited) {
        if (amount == 0) return 0;
        require(TOKEN.transferFrom(msg.sender, address(this), amount), "transferFrom failed");
        trackedAssets += amount;
        return amount;
    }

    function withdraw(uint256 amount) external override returns (uint256 withdrawn) {
        if (revertOnWithdraw) revert("WITHDRAW_REVERT");
        withdrawCalls += 1;
        withdrawn = amount > trackedAssets ? trackedAssets : amount;
        if (withdrawn == 0) return 0;
        trackedAssets -= withdrawn;
        require(TOKEN.transfer(msg.sender, withdrawn), "transfer failed");
    }

    function emergencyWithdraw() external override returns (uint256 withdrawn) {
        withdrawn = trackedAssets;
        trackedAssets = 0;
        if (withdrawn > 0) {
            require(TOKEN.transfer(msg.sender, withdrawn), "transfer failed");
        }
    }

    function harvest() external pure override returns (uint256 profit) {
        return 0;
    }

    function rebalance() external override {}
}

contract MockPartialSpendStrategy is IStrategy, IStrategyValuation {
    IERC20 public immutable TOKEN;
    uint16 public immutable spendBps;
    uint16 public immutable reportBps;
    bool public active = true;
    uint256 public trackedAssets;

    constructor(address token_, uint16 spendBps_, uint16 reportBps_) {
        require(spendBps_ <= 10_000 && reportBps_ <= 10_000, "invalid bps");
        TOKEN = IERC20(token_);
        spendBps = spendBps_;
        reportBps = reportBps_;
    }

    function isValuationReady() external pure override returns (bool) {
        return true;
    }

    function isActive() external view override returns (bool) {
        return active;
    }

    function asset() external view override returns (address) {
        return address(TOKEN);
    }

    function getTotalAssets() external view override returns (uint256) {
        return trackedAssets;
    }

    function deposit(uint256 amount) external override returns (uint256 deposited) {
        if (amount == 0) return 0;

        uint256 spent = (amount * spendBps) / 10_000;
        if (spent > 0) {
            require(TOKEN.transferFrom(msg.sender, address(this), spent), "transferFrom failed");
            trackedAssets += spent;
        }

        deposited = (amount * reportBps) / 10_000;
    }

    function withdraw(uint256 amount) external override returns (uint256 withdrawn) {
        withdrawn = amount > trackedAssets ? trackedAssets : amount;
        if (withdrawn == 0) return 0;
        trackedAssets -= withdrawn;
        require(TOKEN.transfer(msg.sender, withdrawn), "transfer failed");
    }

    function emergencyWithdraw() external override returns (uint256 withdrawn) {
        withdrawn = trackedAssets;
        trackedAssets = 0;
        if (withdrawn > 0) {
            require(TOKEN.transfer(msg.sender, withdrawn), "transfer failed");
        }
    }

    function harvest() external pure override returns (uint256 profit) {
        return 0;
    }

    function rebalance() external override {}
}

contract CreatorOVaultStrategyResilienceTest is CreatorOVaultModulesTestBase {
    MockCreatorCoinStandard internal creatorCoin;
    CreatorOVault internal vault;
    MockRevertableStrategy internal revertingStrategy;
    MockRevertableStrategy internal healthyStrategy;

    address internal alice = makeAddr("alice");

    function setUp() public override {
        super.setUp();

        creatorCoin = new MockCreatorCoinStandard();
        vault = new CreatorOVault(address(creatorCoin), address(this), "Creator OVault", "ovCR8R");
        _setVaultModules(vault);
        revertingStrategy = new MockRevertableStrategy(address(creatorCoin));
        healthyStrategy = new MockRevertableStrategy(address(creatorCoin));

        vault.addStrategy(address(revertingStrategy), 1, true);
        vault.addStrategy(address(healthyStrategy), 9_999, true);
        vault.setFlashLoanProtection(0, type(uint256).max, 1);

        uint256 depositAmount = vault.MINIMUM_FIRST_DEPOSIT() * 2;
        creatorCoin.mint(alice, depositAmount + 500_000e18);
        vm.prank(alice);
        creatorCoin.approve(address(vault), type(uint256).max);
        vm.prank(alice);
        vault.deposit(depositAmount, alice);

        vault.forceDeployToStrategies();
    }

    function test_totalAssets_skipsRevertingStrategyAndCountsHealthy() external {
        revertingStrategy.setRevertOnGetTotalAssets(true);

        uint256 expected = creatorCoin.balanceOf(address(vault)) + healthyStrategy.trackedAssets()
            + vault.strategyDebt(address(revertingStrategy));
        assertEq(vault.totalAssets(), expected);
    }

    function test_previewDeposit_and_previewWithdraw_doNotRevertWhenStrategyReverts() external {
        revertingStrategy.setRevertOnGetTotalAssets(true);

        uint256 depositPreview = vault.previewDeposit(1_000e18);
        assertGt(depositPreview, 0);

        uint256 withdrawPreview = vault.previewWithdraw(5_000e18);
        assertGt(withdrawPreview, 0);
    }

    function test_deposit_reverts_whenStrategyReverts() external {
        revertingStrategy.setRevertOnGetTotalAssets(true);

        assertEq(vault.maxDeposit(alice), 0);
        assertEq(vault.maxMint(alice), 0);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(CreatorOVault.StrategyValuationNotReady.selector, address(revertingStrategy))
        );
        vault.deposit(10_000e18, alice);
    }

    function test_withdraw_usesHealthyStrategyEvenIfFirstQueueStrategyReverts() external {
        revertingStrategy.setRevertOnGetTotalAssets(true);

        uint256 assetsToWithdraw = 50_000e18;
        uint256 balanceBefore = creatorCoin.balanceOf(alice);

        vm.prank(alice);
        uint256 sharesSpent = vault.withdraw(assetsToWithdraw, alice, alice);

        assertGt(sharesSpent, 0);
        assertEq(creatorCoin.balanceOf(alice), balanceBefore + assetsToWithdraw);
        assertGt(revertingStrategy.withdrawCalls(), 0);
        assertGt(healthyStrategy.withdrawCalls(), 0);
    }

    function test_withdraw_skipsRevertingStrategyOnUserRedemptionPath() external {
        revertingStrategy.setRevertOnWithdraw(true);

        uint256 assetsToWithdraw = 50_000e18;
        uint256 balanceBefore = creatorCoin.balanceOf(alice);

        vm.prank(alice);
        uint256 sharesSpent = vault.withdraw(assetsToWithdraw, alice, alice);

        assertGt(sharesSpent, 0);
        assertEq(creatorCoin.balanceOf(alice), balanceBefore + assetsToWithdraw);
        assertGt(healthyStrategy.withdrawCalls(), 0);
    }
}

