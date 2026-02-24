// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../contracts/vault/CreatorOVault.sol";
import {CreatorOVaultAdminModule} from "../contracts/vault/modules/CreatorOVaultAdminModule.sol";
import {CreatorOVaultCoreModule} from "../contracts/vault/modules/CreatorOVaultCoreModule.sol";
import {CreatorOVaultStrategiesModule} from "../contracts/vault/modules/CreatorOVaultStrategiesModule.sol";

contract MockCreatorCoinForReport is ERC20 {
    constructor() ERC20("Creator Coin", "CR8R") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract CreatorOVaultReportTest is Test {
    uint256 internal constant INITIAL_DEPOSIT = 6_000_000e18;
    uint256 internal constant PROFIT_ASSETS = 300_000e18;
    uint256 internal constant QUEUE_SHARES = 200_000e18;

    MockCreatorCoinForReport internal creatorCoin;
    CreatorOVault internal vault;

    address internal coreModule;
    address internal strategiesModule;
    address internal adminModule;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal donor = makeAddr("donor");
    address internal feeRecipient = makeAddr("feeRecipient");

    function setUp() public {
        creatorCoin = new MockCreatorCoinForReport();
        vault = new CreatorOVault(address(creatorCoin), address(this), "Creator OVault", "ovCR8R");

        coreModule = address(new CreatorOVaultCoreModule());
        strategiesModule = address(new CreatorOVaultStrategiesModule());
        adminModule = address(new CreatorOVaultAdminModule());
        vault.setModulesOnce(coreModule, strategiesModule, adminModule);

        vault.setPerformanceFee(0);
        vault.setProfitMaxUnlockTime(7 days);
        vault.setFlashLoanProtection(0, 1e18, 2);

        creatorCoin.mint(alice, INITIAL_DEPOSIT * 2);
        creatorCoin.mint(bob, INITIAL_DEPOSIT);
        creatorCoin.mint(donor, INITIAL_DEPOSIT);

        vm.prank(alice);
        creatorCoin.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        creatorCoin.approve(address(vault), type(uint256).max);
        vm.prank(donor);
        creatorCoin.approve(address(vault), type(uint256).max);

        vm.prank(alice);
        vault.deposit(INITIAL_DEPOSIT, alice);

        // Baseline report without locking deposit flow as profit.
        vault.setProfitMaxUnlockTime(0);
        vault.report();
        vault.setProfitMaxUnlockTime(7 days);
    }

    function test_firstReportAfterInitialDeposit_doesNotMintUnbackedShares() public {
        CreatorOVault freshVault = _newVaultForBaselineTests();
        uint256 depositAmount = INITIAL_DEPOSIT;

        creatorCoin.mint(alice, depositAmount);
        vm.prank(alice);
        creatorCoin.approve(address(freshVault), type(uint256).max);
        vm.prank(alice);
        freshVault.deposit(depositAmount, alice);

        uint256 supplyBefore = freshVault.totalSupply();
        uint256 feeSharesBefore = freshVault.balanceOf(feeRecipient);
        uint256 lockedBefore = freshVault.totalLockedShares();

        (uint256 profit, uint256 loss) = freshVault.report();

        assertEq(profit, 0);
        assertEq(loss, 0);
        assertEq(freshVault.balanceOf(feeRecipient), feeSharesBefore);
        assertEq(freshVault.totalLockedShares(), lockedBefore);
        assertEq(freshVault.totalSupply(), supplyBefore);
        assertEq(freshVault.totalAssetsAtLastReport(), freshVault.totalAssets());
    }

    function test_firstReport_bootstrapsUninitializedBaseline() public {
        CreatorOVault freshVault = _newVaultForBaselineTests();
        uint256 donatedAssets = 500_000e18;

        creatorCoin.mint(address(freshVault), donatedAssets);
        assertEq(freshVault.totalAssetsAtLastReport(), 0);

        uint256 supplyBefore = freshVault.totalSupply();

        (uint256 profit, uint256 loss) = freshVault.report();

        assertEq(profit, 0);
        assertEq(loss, 0);
        assertEq(freshVault.totalSupply(), supplyBefore);
        assertEq(freshVault.balanceOf(feeRecipient), 0);
        assertEq(freshVault.totalAssetsAtLastReport(), freshVault.totalAssets());
    }

    function test_reportAfterDeposit_doesNotTreatUserPrincipalAsProfit() public {
        vault.setPerformanceFee(1000);
        vault.setPerformanceFeeRecipient(feeRecipient);

        uint256 lockedBefore = vault.totalLockedShares();
        uint256 feeSharesBefore = vault.balanceOf(feeRecipient);

        vm.prank(alice);
        vault.deposit(250_000e18, alice);

        (uint256 profit, uint256 loss) = vault.report();

        assertEq(profit, 0);
        assertEq(loss, 0);
        assertEq(vault.balanceOf(feeRecipient), feeSharesBefore);
        assertEq(vault.totalLockedShares(), lockedBefore);
    }

    function test_reportAfterWithdraw_doesNotTreatUserPrincipalAsLoss() public {
        uint256 lockedBefore = _lockProfit(PROFIT_ASSETS);

        vm.roll(block.number + 3);
        vm.prank(alice);
        vault.withdraw(5e17, alice, alice);

        (uint256 profit, uint256 loss) = vault.report();

        assertEq(profit, 0);
        assertEq(loss, 0);
        assertEq(vault.totalLockedShares(), lockedBefore);
    }

    function test_reportAfterQueuedClaim_doesNotTreatUserPrincipalAsLoss() public {
        uint256 lockedBefore = _lockProfit(PROFIT_ASSETS);

        vm.roll(block.number + 3);
        vm.prank(alice);
        vault.queueWithdrawal(QUEUE_SHARES, alice);

        uint256 baselineBeforeClaim = vault.totalAssetsAtLastReport();
        vm.roll(block.number + vault.largeWithdrawalDelayBlocks() + 1);

        vm.prank(alice);
        uint256 claimedAssets = vault.claimQueuedWithdrawal();
        assertEq(vault.totalAssetsAtLastReport(), baselineBeforeClaim - claimedAssets);

        (uint256 profit, uint256 loss) = vault.report();

        assertEq(profit, 0);
        assertEq(loss, 0);
        assertEq(vault.totalLockedShares(), lockedBefore);
    }

    function test_report_profitLocksSharesAndSetsUnlockParams() public {
        uint256 locked = _lockProfit(PROFIT_ASSETS);

        assertGt(locked, 0);
        assertEq(vault.totalQueuedWithdrawalShares(), 0);
        assertEq(vault.balanceOf(address(vault)), locked);
        assertEq(uint256(vault.fullProfitUnlockDate()), block.timestamp + 7 days);
        assertGt(vault.profitUnlockingRate(), 0);
        assertEq(vault.unlockedShares(), 0);
    }

    function test_partialUnlock_burnsMaturedProfitShares() public {
        uint256 locked = _lockProfit(PROFIT_ASSETS);

        vm.warp(block.timestamp + 3 days);
        vm.prank(bob);
        vault.deposit(100e18, bob);

        uint256 expectedUnlocked = (locked * 3 days) / 7 days;
        uint256 expectedRemaining = locked - expectedUnlocked;

        assertApproxEqAbs(vault.totalLockedShares(), expectedRemaining, 2);
        assertEq(vault.balanceOf(address(vault)), vault.totalLockedShares());
    }

    function test_fullUnlock_burnsAllProfitShares() public {
        _lockProfit(PROFIT_ASSETS);

        vm.warp(block.timestamp + 8 days);
        vm.prank(bob);
        vault.deposit(100e18, bob);

        assertEq(vault.totalLockedShares(), 0);
        assertEq(vault.balanceOf(address(vault)), 0);
        assertEq(vault.profitUnlockingRate(), 0);
        assertEq(vault.fullProfitUnlockDate(), 0);
    }

    function test_unlockAndLossBurn_neverConsumeQueuedWithdrawalShares() public {
        uint256 lockedBeforeLoss = _lockProfit(PROFIT_ASSETS);

        vm.prank(alice);
        vault.queueWithdrawal(QUEUE_SHARES, alice);
        assertEq(vault.totalQueuedWithdrawalShares(), QUEUE_SHARES);

        // Force a loss after queueing to ensure loss burn path cannot consume queued shares.
        vault.shutdownVault();
        vault.emergencyWithdraw(75_000e18, address(this));
        vault.report();

        assertEq(vault.totalQueuedWithdrawalShares(), QUEUE_SHARES);
        assertEq(vault.balanceOf(address(vault)), vault.totalLockedShares() + QUEUE_SHARES);
        assertLt(vault.totalLockedShares(), lockedBeforeLoss);

        // Fully unlock remaining profit shares; queued shares must remain intact.
        vm.warp(block.timestamp + 8 days);
        vault.report();

        assertEq(vault.totalLockedShares(), 0);
        assertEq(vault.balanceOf(address(vault)), QUEUE_SHARES);
        assertEq(vault.totalQueuedWithdrawalShares(), QUEUE_SHARES);
    }

    function test_multipleReports_preserveProfitShareInvariant() public {
        _lockProfit(PROFIT_ASSETS);

        vm.warp(block.timestamp + 2 days);
        vm.prank(donor);
        vault.injectCapital(150_000e18);
        vault.report();

        assertEq(vault.totalQueuedWithdrawalShares(), 0);
        assertEq(vault.balanceOf(address(vault)), vault.totalLockedShares());
        assertEq(vault.lastProfitUnlockUpdate(), block.timestamp);
        assertGt(vault.totalLockedShares(), 0);

        vm.warp(block.timestamp + 8 days);
        vm.prank(bob);
        vault.deposit(100e18, bob);

        assertEq(vault.totalLockedShares(), 0);
        assertEq(vault.balanceOf(address(vault)), 0);
    }

    function _lockProfit(uint256 profitAssets) internal returns (uint256 locked) {
        vm.prank(donor);
        vault.injectCapital(profitAssets);
        vault.report();
        locked = vault.totalLockedShares();
    }

    function _newVaultForBaselineTests() internal returns (CreatorOVault freshVault) {
        freshVault = new CreatorOVault(address(creatorCoin), address(this), "Fresh OVault", "ovFRESH");
        freshVault.setModulesOnce(coreModule, strategiesModule, adminModule);
        freshVault.setPerformanceFee(1000);
        freshVault.setPerformanceFeeRecipient(feeRecipient);
        freshVault.setProfitMaxUnlockTime(7 days);
        freshVault.setFlashLoanProtection(0, 1e18, 2);
    }
}
