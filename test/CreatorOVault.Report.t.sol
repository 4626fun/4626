// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {stdStorage} from "forge-std/StdStorage.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "@4626/creator/vault/CreatorOVault.sol";
import {OVaultAdminModule} from "@4626/shared/vault/modules/OVaultAdminModule.sol";
import {CreatorOVaultCoreModule} from "@4626/creator/vault/modules/CreatorOVaultCoreModule.sol";
import {OVaultStrategiesModule} from "@4626/shared/vault/modules/OVaultStrategiesModule.sol";

contract MockCreatorCoinForReport is ERC20 {
    constructor() ERC20("Creator Coin", "CR8R") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract CreatorOVaultReportTest is Test {
    uint256 internal constant INITIAL_DEPOSIT = 50_000_000e18;
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
        strategiesModule = address(new OVaultStrategiesModule());
        adminModule = address(new OVaultAdminModule());
        vault.setModulesOnce(coreModule, strategiesModule, adminModule);

        vault.setRiskConfigDelay(0);
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

    function test_depositAfterBaselineReachesZero_restoresPrincipalBaseline() public {
        uint256 assetsBefore = vault.totalAssets();

        vault.setFlashLoanProtection(0, type(uint256).max, 0);

        vm.prank(alice);
        vault.withdraw(assetsBefore, alice, alice);

        assertEq(vault.totalAssets(), 0);
        assertEq(vault.totalAssetsAtLastReport(), 0);

        uint256 redepositAssets = assetsBefore;
        vm.prank(alice);
        vault.deposit(redepositAssets, alice);

        assertEq(vault.totalAssetsAtLastReport(), redepositAssets);
    }

    function test_injectCapital_afterBaselineZero_doesNotCountAsProfit() public {
        uint256 assetsBefore = vault.totalAssets();
        vault.setFlashLoanProtection(0, type(uint256).max, 0);

        vm.prank(alice);
        vault.withdraw(assetsBefore, alice, alice);

        assertEq(vault.totalAssets(), 0);
        assertEq(vault.totalAssetsAtLastReport(), 0);

        uint256 donatedAssets = 100_000e18;
        vm.prank(donor);
        creatorCoin.transfer(address(this), donatedAssets);
        creatorCoin.approve(address(vault), donatedAssets);
        vault.injectCapital(donatedAssets);

        (uint256 profit, uint256 loss) = vault.report();

        assertEq(profit, 0);
        assertEq(loss, 0);
        assertEq(vault.totalAssetsAtLastReport(), vault.totalAssets());
    }

    function test_report_withZeroBaselineAndOutstandingShares_resetsBaselineWithoutProfit() public {
        _writeReportBaseline(0);
        assertEq(vault.totalAssetsAtLastReport(), 0);
        assertGt(vault.totalSupply(), 0);

        uint256 supplyBefore = vault.totalSupply();
        uint256 feeSharesBefore = vault.balanceOf(feeRecipient);

        (uint256 profit, uint256 loss) = vault.report();

        assertEq(profit, 0);
        assertEq(loss, 0);
        assertEq(vault.totalSupply(), supplyBefore);
        assertEq(vault.balanceOf(feeRecipient), feeSharesBefore);
        assertEq(vault.totalAssetsAtLastReport(), vault.totalAssets());
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

    function test_claimQueuedWithdrawal_fullQueuePaysFullEntitlement() public {
        vm.prank(bob);
        vault.deposit(INITIAL_DEPOSIT, bob);

        uint256 aliceShares = vault.balanceOf(alice);
        uint256 bobShares = vault.balanceOf(bob);
        assertGt(aliceShares, 0);
        assertGt(bobShares, 0);

        vm.roll(block.number + 3);
        vm.prank(alice);
        vault.queueWithdrawal(aliceShares, alice);
        vm.prank(bob);
        vault.queueWithdrawal(bobShares, bob);

        vm.roll(block.number + vault.largeWithdrawalDelayBlocks() + 1);
        vm.prank(alice);
        uint256 aliceClaimed = vault.claimQueuedWithdrawal();
        vm.prank(bob);
        uint256 bobClaimed = vault.claimQueuedWithdrawal();

        assertEq(aliceClaimed, INITIAL_DEPOSIT);
        assertEq(bobClaimed, INITIAL_DEPOSIT);
        assertEq(aliceClaimed + bobClaimed, INITIAL_DEPOSIT * 2);
    }

    function test_maxWithdraw_and_maxRedeem_reflectSyncThreshold() public {
        uint256 threshold = vault.largeWithdrawalThreshold();
        assertGt(threshold, 1);

        uint256 expectedMaxWithdraw = threshold - 1;
        assertEq(vault.maxWithdraw(alice), expectedMaxWithdraw);
        assertEq(vault.maxRedeem(alice), vault.previewWithdraw(expectedMaxWithdraw));
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
        // injectCapital now requires onlyManagement (M-04 fix); call as owner
        vm.prank(donor);
        creatorCoin.transfer(address(this), 150_000e18);
        creatorCoin.approve(address(vault), 150_000e18);
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

    /// @notice ODA-427-F4: sync withdraw must revert when it would consume queue-reserved NAV,
    ///         not silently under-burn shares while pushing the full requested assets.
    function test_withdraw_revertsWhenExceedingQueueReservation() public {
        // Sync threshold above bob's deposit so reservation (not queue-size) is the gate.
        vault.setFlashLoanProtection(0, 10e18, 2);

        vm.prank(bob);
        vault.deposit(1e18, bob);

        uint256 aliceShares = vault.balanceOf(alice);
        // convertToAssets(aliceShares) must be >= largeWithdrawalThreshold to queue.
        assertGe(vault.convertToAssets(aliceShares), vault.largeWithdrawalThreshold());

        vm.roll(block.number + 3);
        vm.prank(alice);
        vault.queueWithdrawal(aliceShares, alice);

        uint256 reserved = vault.convertToAssets(vault.totalQueuedWithdrawalShares());
        uint256 available = vault.totalAssets() > reserved ? vault.totalAssets() - reserved : 0;
        assertGt(available, 0, "bob's capital should remain available");
        assertLt(available + 1, vault.largeWithdrawalThreshold(), "stay on sync path");
        assertLe(vault.maxWithdraw(bob), available, "maxWithdraw must not exceed reservation");

        uint256 tryAmount = available + 1;
        // previewWithdraw must stay exact for the requested amount (no silent shrink).
        uint256 sharesForTry = vault.previewWithdraw(tryAmount);
        assertGt(sharesForTry, vault.previewWithdraw(available), "preview must quote full request");

        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(
                CreatorOVaultCoreModule.InsufficientIdleForWithdrawal.selector, tryAmount, available
            )
        );
        vault.withdraw(tryAmount, bob, bob);
    }

    function _lockProfit(uint256 profitAssets) internal returns (uint256 locked) {
        vm.prank(donor);
        creatorCoin.transfer(address(this), profitAssets);
        creatorCoin.approve(address(vault), profitAssets);
        vault.injectCapital(profitAssets);

        // injectCapital is principal inflow (M-03); restore prior baseline so report() recognizes yield.
        _writeReportBaseline(vault.totalAssetsAtLastReport() - profitAssets);

        vault.report();
        locked = vault.totalLockedShares();
    }

    function _writeReportBaseline(uint256 baseline) internal {
        stdStorage.checked_write(
            stdStorage.sig(stdStorage.target(stdstore, address(vault)), "totalAssetsAtLastReport()"),
            baseline
        );
    }

    function _newVaultForBaselineTests() internal returns (CreatorOVault freshVault) {
        freshVault = new CreatorOVault(address(creatorCoin), address(this), "Fresh OVault", "ovFRESH");
        freshVault.setModulesOnce(coreModule, strategiesModule, adminModule);
        freshVault.setRiskConfigDelay(0);
        freshVault.setPerformanceFee(1000);
        freshVault.setPerformanceFeeRecipient(feeRecipient);
        freshVault.setProfitMaxUnlockTime(7 days);
        freshVault.setFlashLoanProtection(0, 1e18, 2);
    }
}
