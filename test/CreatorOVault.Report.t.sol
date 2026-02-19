// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../contracts/vault/CreatorOVault.sol";

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

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal donor = makeAddr("donor");

    function setUp() public {
        creatorCoin = new MockCreatorCoinForReport();
        vault = new CreatorOVault(address(creatorCoin), address(this), "Creator OVault", "ovCR8R");

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
}
