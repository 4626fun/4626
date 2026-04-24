// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SolanaStrategy} from "../../../contracts/vault/strategies/SolanaStrategy.sol";

contract MockCreatorToken is ERC20 {
    constructor() ERC20("Creator", "CRT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract SolanaStrategyFlowsTest is Test {
    SolanaStrategy strategy;
    MockCreatorToken creator;

    address vault;
    address owner;
    address keeper;
    address bridge;

    uint64 constant MAX_NAV_AGE = 3600;
    uint16 constant MAX_NAV_DELTA_BPS = 500;
    uint16 constant MIN_BASE_LIQUIDITY_BPS = 1000; // 10%

    function setUp() public {
        creator = new MockCreatorToken();
        vault = makeAddr("vault");
        owner = address(this);
        keeper = makeAddr("keeper");
        bridge = makeAddr("bridge");

        strategy = new SolanaStrategy(
            vault,
            address(creator),
            owner,
            keeper,
            MAX_NAV_AGE,
            MAX_NAV_DELTA_BPS,
            MIN_BASE_LIQUIDITY_BPS,
            bridge
        );

        creator.mint(vault, 500e18);
        creator.mint(address(strategy), 200e18);
    }

    function test_deposit_returnsExactAmount_andUpdatesBalance() public {
        uint256 amount = 100e18;
        vm.startPrank(vault);
        creator.approve(address(strategy), amount);
        uint256 deposited = strategy.deposit(amount);
        vm.stopPrank();

        assertEq(deposited, amount, "deposit should return exact amount");
        assertEq(creator.balanceOf(address(strategy)), 200e18 + amount, "strategy balance should increase");
        assertEq(creator.balanceOf(vault), 500e18 - amount, "vault balance should decrease");
    }

    function test_withdraw_usesBaseLiquidityOnly_andCapsToAvailable() public {
        uint256 requested = 150e18;
        uint256 vaultBefore = creator.balanceOf(vault);
        vm.prank(vault);
        uint256 withdrawn = strategy.withdraw(requested);

        assertEq(withdrawn, 150e18, "should withdraw up to requested when available");
        assertEq(creator.balanceOf(vault), vaultBefore + 150e18, "vault should receive withdrawn amount");
        assertEq(creator.balanceOf(address(strategy)), 50e18, "strategy should have remaining");
    }

    function test_withdraw_capsToAvailable_whenRequestExceedsBalance() public {
        uint256 requested = 500e18; // more than strategy has (200e18)
        uint256 vaultBefore = creator.balanceOf(vault);
        vm.prank(vault);
        uint256 withdrawn = strategy.withdraw(requested);

        assertEq(withdrawn, 200e18, "should cap to available Base liquidity");
        assertEq(creator.balanceOf(vault), vaultBefore + 200e18, "vault receives only available");
        assertEq(creator.balanceOf(address(strategy)), 0, "strategy drained");
    }

    function test_withdraw_returnsZero_whenNoLiquidity() public {
        vm.prank(vault);
        strategy.withdraw(200e18);

        assertEq(creator.balanceOf(address(strategy)), 0, "strategy should be empty");

        vm.prank(vault);
        uint256 withdrawn = strategy.withdraw(1e18);
        assertEq(withdrawn, 0, "should return zero when no Base liquidity");
    }

    function test_deposit_reverts_whenPaused() public {
        strategy.setEmergencyPaused(true);

        vm.startPrank(vault);
        creator.approve(address(strategy), 10e18);
        vm.expectRevert(SolanaStrategy.StrategyPaused.selector);
        strategy.deposit(10e18);
        vm.stopPrank();
    }

    function test_rebalanceToSolana_reverts_whenWouldBreachBuffer() public {
        // Strategy has 200e18, remoteNav 0. Total = 200e18. Min base = 10% = 20e18.
        // Max we can rebalance = 200 - 20 = 180e18.
        // Try 185e18 -> would leave 15e18 < 20e18 -> revert
        vm.prank(keeper);
        vm.expectRevert(SolanaStrategy.RebalanceWouldBreachBuffer.selector);
        strategy.rebalanceToSolana(185e18);
    }

    function test_rebalanceToSolana_reverts_whenAmountExceedsBalance() public {
        vm.prank(keeper);
        vm.expectRevert(SolanaStrategy.InsufficientBaseLiquidity.selector);
        strategy.rebalanceToSolana(201e18);
    }

    function test_rebalanceToSolana_succeeds_aboveBuffer() public {
        // Max rebalance = 200 - 20 = 180e18. Try 100e18 -> leaves 100e18 >= 20e18
        vm.prank(keeper);
        strategy.rebalanceToSolana(100e18);

        assertEq(creator.balanceOf(address(strategy)), 100e18, "strategy should have 100 left");
        assertEq(creator.balanceOf(bridge), 100e18, "bridge should receive 100");
    }

    function test_rebalanceToSolana_respectsBuffer_withRemoteNav() public {
        vm.prank(keeper);
        strategy.updateRemoteNav(100e18, bytes32("flow-nav-1"));
        // Total = 200 + 100 = 300e18. Min base = 10% = 30e18.
        // Max rebalance = 200 - 30 = 170e18.
        vm.prank(keeper);
        strategy.rebalanceToSolana(170e18);

        assertEq(creator.balanceOf(address(strategy)), 30e18, "strategy keeps min buffer");
        assertEq(creator.balanceOf(bridge), 170e18, "bridge receives rebalanced amount");
    }

    function test_rebalanceToSolana_reverts_whenBridgeZero() public {
        SolanaStrategy zeroBridgeStrategy = new SolanaStrategy(
            vault,
            address(creator),
            owner,
            keeper,
            MAX_NAV_AGE,
            MAX_NAV_DELTA_BPS,
            MIN_BASE_LIQUIDITY_BPS,
            address(0)
        );
        creator.mint(address(zeroBridgeStrategy), 50e18);

        vm.prank(keeper);
        vm.expectRevert(SolanaStrategy.InvalidBridgeAddress.selector);
        zeroBridgeStrategy.rebalanceToSolana(1e18);
    }

    function test_reconcileFromSolana_updatesFlowTrackingState() public {
        creator.mint(address(strategy), 50e18); // simulate bridge deposit
        assertEq(creator.balanceOf(address(strategy)), 250e18, "strategy received tokens");

        vm.prank(keeper);
        strategy.reconcileFromSolana(50e18, bytes32("r1"));

        assertEq(strategy.totalReconciledFromSolana(), 50e18, "flow state should update");
    }

    function test_reconcileFromSolana_accumulatesMultipleCalls() public {
        creator.mint(address(strategy), 30e18);
        vm.prank(keeper);
        strategy.reconcileFromSolana(30e18, bytes32("r1"));

        creator.mint(address(strategy), 20e18);
        vm.prank(keeper);
        strategy.reconcileFromSolana(20e18, bytes32("r2"));

        assertEq(strategy.totalReconciledFromSolana(), 50e18, "should accumulate");
    }

    function test_emergencyWithdraw_drainsBaseLiquidity() public {
        uint256 vaultBefore = creator.balanceOf(vault);

        vm.prank(vault);
        uint256 withdrawn = strategy.emergencyWithdraw();

        assertEq(withdrawn, 200e18, "should withdraw full Base balance");
        assertEq(creator.balanceOf(address(strategy)), 0, "strategy should be drained");
        assertEq(creator.balanceOf(vault), vaultBefore + 200e18, "vault should receive all funds");
    }

    function test_rebalanceToSolana_reverts_whenNotKeeper() public {
        vm.prank(vault);
        vm.expectRevert(SolanaStrategy.OnlyKeeper.selector);
        strategy.rebalanceToSolana(100e18);
    }

    function test_reconcileFromSolana_reverts_whenNotKeeper() public {
        vm.prank(vault);
        vm.expectRevert(SolanaStrategy.OnlyKeeper.selector);
        strategy.reconcileFromSolana(50e18, bytes32("flow-r-unauth"));
    }

    // ================================
    // FIX: H-05 (4626-437) — reportId replay guard for reconcileFromSolana
    // ================================

    function test_reconcileFromSolana_reverts_whenReportIdZero() public {
        vm.prank(keeper);
        vm.expectRevert(SolanaStrategy.InvalidReportId.selector);
        strategy.reconcileFromSolana(50e18, bytes32(0));
    }

    function test_reconcileFromSolana_reverts_whenReportIdReplayed() public {
        bytes32 id = keccak256("bridge-receipt-1");
        creator.mint(address(strategy), 100e18); // simulate bridge deposit
        vm.prank(keeper);
        strategy.reconcileFromSolana(50e18, id);

        // Replaying the same receipt would double-count `totalReconciledFromSolana`.
        vm.prank(keeper);
        vm.expectRevert(SolanaStrategy.ReportIdAlreadyUsed.selector);
        strategy.reconcileFromSolana(50e18, id);
    }

    function test_reconcileFromSolana_allowsZeroAmount_withoutConsumingReportId() public {
        // Zero-amount short-circuits before any state change — reportId not
        // consumed, so a legitimate later report with the same id still works.
        bytes32 id = keccak256("bridge-receipt-noop");
        vm.prank(keeper);
        strategy.reconcileFromSolana(0, id);
        assertFalse(strategy.usedReportIds(id), "zero-amount path must not mark id used");

        creator.mint(address(strategy), 10e18);
        vm.prank(keeper);
        strategy.reconcileFromSolana(10e18, id);
        assertTrue(strategy.usedReportIds(id), "id consumed on real reconciliation");
    }
}
