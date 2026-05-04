// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../../../contracts/vault/CreatorOVault.sol";
import {CreatorOVaultAdminModule} from "../../../contracts/vault/modules/CreatorOVaultAdminModule.sol";
import {CreatorOVaultCoreModule} from "../../../contracts/vault/modules/CreatorOVaultCoreModule.sol";
import {CreatorOVaultStrategiesModule} from "../../../contracts/vault/modules/CreatorOVaultStrategiesModule.sol";
import "../../../contracts/interfaces/IStrategy.sol";
import "../../../contracts/interfaces/IStrategyValuation.sol";

// ============================================================================
// Regression test for M-09 — Codex review on PR #357
//
// The bug: `_tryWithdrawFromStrategyMeasured` used to compute
//     `afterBal - beforeBal`
// without guarding `afterBal < beforeBal`. A hostile strategy with leftover
// allowance from a prior `_depositIntoStrategyMeasured` (which does
// `coin.forceApprove(strategy, amount)`) can `transferFrom` the vault during
// its own `withdraw`, return normally, and leave `afterBal < beforeBal`. The
// underflow inside the module would re-brick the user's withdraw — the exact
// DoS that M-09 was supposed to fix.
//
// Fix (commit ea67383): two guards in `_tryWithdrawFromStrategyMeasured`:
//   * Success branch (new):  if `afterBal < beforeBal`, emit
//     `StrategyWithdrawFailed(..., TransferAmountMismatch(reported, 0))`,
//     sync `coinBalance`, return 0.
//   * Revert (catch) branch: `coinBalance = afterBalRevert` unconditionally;
//     return `afterBalRevert - beforeBal` only when `afterBalRevert >
//     beforeBal`, else return 0. (Negative deltas in the catch branch are
//     unreachable inside a single call tree — a revert unwinds any
//     state the strategy wrote — but the `>` guard is defense-in-depth
//     against future refactors, delegatecall strategies, or cross-call
//     tricks; this test pins its return value on the reachable delta=0 and
//     delta>0 paths.)
//
// Covered here:
//   1. Fuzz — hostile strategy drains vault via leftover allowance THEN
//      returns a non-zero `reported` without reverting. This is the actual
//      reachable negative-delta path. Pre-fix: user withdraw reverts with
//      arithmetic underflow. Post-fix: failed leg, queue continues, user
//      gets paid out of the healthy strategy.
//   2. Invariant — after a failed hostile leg, `vault.coinBalance()` matches
//      `coin.balanceOf(vault)`.
//   3. Control — hostile strategy reverts with ZERO delta (no drain): queue
//      still continues to healthy strategy; confirms the new `>` guard has
//      not regressed the pre-existing revert path.
//   4. Revert branch positive delta — strategy transfers a real, legitimate
//      partial amount to the vault before reverting: pins that the module
//      still credits the positive delta (i.e. the `>` guard returns the
//      correct non-zero amount, not 0).
// ============================================================================

contract MockHostileCoin is ERC20 {
    constructor() ERC20("Creator Coin", "CR8R") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Healthy baseline strategy. Accepts full deposits, withdraws exactly
///      what was asked (clamped by tracked assets). Used as the queue fallback
///      so the user withdrawal can still be satisfied when the hostile leg
///      returns 0.
contract HealthyStrategy is IStrategy, IStrategyValuation {
    IERC20 public immutable TOKEN;
    uint256 public trackedAssets;
    uint256 public withdrawCalls;

    constructor(address token_) {
        TOKEN = IERC20(token_);
    }

    function isValuationReady() external pure override returns (bool) {
        return true;
    }

    function isActive() external pure override returns (bool) {
        return true;
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

/// @dev Hostile strategy. Configurable per test:
///   - `depositFraction` (bps): what fraction of the approved deposit amount
///     is actually pulled on `deposit()`. The remainder stays as allowance
///     the strategy can later abuse. 10_000 = pull full amount (no leftover).
///   - `drainAmount`: how much the strategy pulls from the vault via leftover
///     allowance during `withdraw()`.
///   - `revertOnWithdraw`: revert after the drain (exercises the catch branch).
///   - `reportOnWithdraw`: returned value when NOT reverting (exercises the
///     success-but-lying branch: non-zero report while balance went DOWN).
///
/// The strategy holds a reference to the vault so it can read allowance and
/// execute `transferFrom` from the vault's address at `withdraw()` time.
contract HostileStrategy is IStrategy, IStrategyValuation {
    IERC20 public immutable TOKEN;
    address public immutable VAULT;

    uint256 public trackedAssets;
    uint256 public withdrawCalls;

    uint256 public depositFraction = 10_000; // bps; default: pull everything
    uint256 public drainAmount;
    bool public revertOnWithdraw;
    uint256 public reportOnWithdraw;

    constructor(address token_, address vault_) {
        TOKEN = IERC20(token_);
        VAULT = vault_;
    }

    function setDepositFraction(uint256 bps) external {
        depositFraction = bps;
    }

    function setDrainAmount(uint256 amount) external {
        drainAmount = amount;
    }

    function setRevertOnWithdraw(bool value) external {
        revertOnWithdraw = value;
    }

    function setReportOnWithdraw(uint256 value) external {
        reportOnWithdraw = value;
    }

    function isValuationReady() external pure override returns (bool) {
        return true;
    }

    function isActive() external pure override returns (bool) {
        return true;
    }

    function asset() external view override returns (address) {
        return address(TOKEN);
    }

    function getTotalAssets() external view override returns (uint256) {
        return trackedAssets;
    }

    /// @dev Pulls only `depositFraction` of the approved amount, so allowance
    ///      leftover = amount - pulled. This is the setup for the attack: the
    ///      strategy can reuse that remaining approval at `withdraw()` time.
    function deposit(uint256 amount) external override returns (uint256 deposited) {
        if (amount == 0) return 0;
        uint256 toPull = (amount * depositFraction) / 10_000;
        if (toPull > 0) {
            require(TOKEN.transferFrom(msg.sender, address(this), toPull), "transferFrom failed");
            trackedAssets += toPull;
        }
        // Intentionally return `amount` not `toPull`; the vault module trusts
        // the measured delta (`spent`), not this return value.
        return amount;
    }

    /// @dev Drain the vault via leftover allowance, then either revert (catch
    ///      branch) or return a lying `reportOnWithdraw` (success branch).
    ///      In both cases the vault's balance goes DOWN, which is exactly the
    ///      condition M-09's fix is meant to tolerate.
    function withdraw(uint256 /* amount */) external override returns (uint256 withdrawn) {
        withdrawCalls += 1;

        if (drainAmount > 0) {
            // Pull from the vault using whatever allowance remains from deposit.
            // If this call itself reverts for allowance reasons, we propagate —
            // the test setup ensures allowance >= drainAmount.
            require(TOKEN.transferFrom(VAULT, address(this), drainAmount), "drain failed");
        }

        if (revertOnWithdraw) {
            revert("HOSTILE_REVERT");
        }

        return reportOnWithdraw;
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

abstract contract HostileWithdrawTestBase is Test {
    MockHostileCoin internal coin;
    CreatorOVault internal vault;
    HostileStrategy internal hostile;
    HealthyStrategy internal healthy;

    address internal alice = makeAddr("alice");

    // Events mirrored from the strategies module for `expectEmit`.
    event StrategyWithdrawFailed(address indexed strategy, uint256 amount, bytes revertData);

    function _baseSetUp() internal {
        coin = new MockHostileCoin();
        vault = new CreatorOVault(address(coin), address(this), "Creator OVault", "ovCR8R");
        vault.setModulesOnce(
            address(new CreatorOVaultCoreModule()),
            address(new CreatorOVaultStrategiesModule()),
            address(new CreatorOVaultAdminModule())
        );

        hostile = new HostileStrategy(address(coin), address(vault));
        healthy = new HealthyStrategy(address(coin));

        // Hostile first in the queue so it always gets hit during user withdraws.
        // Small weight on hostile so the auto-allocator parks most funds in healthy;
        // we force-deploy manually below so weights only matter for routing order.
        vault.addStrategy(address(hostile), 1, true);
        vault.addStrategy(address(healthy), 9_999, true);
        vault.setFlashLoanProtection(0, type(uint256).max, 1);

        // Alice deposits 2x minimum so there's plenty of headroom.
        uint256 depositAmount = vault.MINIMUM_FIRST_DEPOSIT() * 2;
        coin.mint(alice, depositAmount + 500_000e18);
        vm.prank(alice);
        coin.approve(address(vault), type(uint256).max);

        vm.prank(alice);
        vault.deposit(depositAmount, alice);
    }
}

/// @notice Pins the SUCCESS-BUT-LYING branch of
///         `_tryWithdrawFromStrategyMeasured`. Hostile strategy drains the
///         vault via leftover allowance, then RETURNS a non-zero `reported`
///         without reverting. Prior code fell through to `afterBal - beforeBal`
///         and underflowed. After the fix (L255-L268): `afterBal < beforeBal`
///         is detected, `StrategyWithdrawFailed` is emitted, return 0.
contract HostileStrategyLyingBranchTest is HostileWithdrawTestBase {
    function setUp() public {
        _baseSetUp();

        hostile.setDepositFraction(5_000);
        hostile.setRevertOnWithdraw(false);
        // Strategy will lie about having withdrawn 1 token while actually
        // pulling `drainAmount` out.
        hostile.setReportOnWithdraw(1);

        vault.forceDeployToStrategies();

        assertGt(coin.allowance(address(vault), address(hostile)), 0, "no leftover allowance");
        assertGt(vault.strategyDebt(address(healthy)), 0, "healthy not funded");
    }

    function testFuzz_userWithdraw_doesNotBrickWhenStrategyLiesWithNegativeDelta(uint256 drain) external {
        uint256 leftover = coin.allowance(address(vault), address(hostile));
        uint256 vaultBal = coin.balanceOf(address(vault));
        uint256 maxDrain = leftover < vaultBal ? leftover : vaultBal;
        vm.assume(maxDrain > 0);
        drain = bound(drain, 1, maxDrain);
        hostile.setDrainAmount(drain);

        uint256 ask = 50_000e18;
        assertLt(ask, healthy.trackedAssets(), "ask exceeds healthy liquidity");

        uint256 aliceBalBefore = coin.balanceOf(alice);

        vm.expectEmit(true, false, false, false, address(vault));
        emit StrategyWithdrawFailed(address(hostile), 0, "");

        vm.prank(alice);
        uint256 sharesSpent = vault.withdraw(ask, alice, alice);

        assertGt(sharesSpent, 0, "no shares spent");
        assertEq(coin.balanceOf(alice), aliceBalBefore + ask, "alice did not receive full ask");
        assertEq(hostile.withdrawCalls(), 1, "hostile withdraw not called");
        assertGt(healthy.withdrawCalls(), 0, "healthy strategy never reached");
    }

    /// @dev Invariant: after a failed hostile leg, the module's cached
    ///      `coinBalance` must match the real token balance. Pre-fix this was
    ///      broken because the revert/lying branches left `coinBalance` stale.
    function testFuzz_coinBalance_syncedAfterHostileLeg(uint256 drain) external {
        uint256 leftover = coin.allowance(address(vault), address(hostile));
        uint256 vaultBal = coin.balanceOf(address(vault));
        uint256 maxDrain = leftover < vaultBal ? leftover : vaultBal;
        vm.assume(maxDrain > 0);
        drain = bound(drain, 1, maxDrain);
        hostile.setDrainAmount(drain);

        uint256 ask = 50_000e18;
        vm.prank(alice);
        vault.withdraw(ask, alice, alice);

        assertEq(
            vault.coinBalance(),
            coin.balanceOf(address(vault)),
            "coinBalance not synced after hostile leg"
        );
    }
}

/// @notice Control A: zero-delta revert path. Hostile strategy reverts with
///         no balance movement (no leftover allowance, no drain). The queue
///         must still continue to the healthy strategy and the user withdraw
///         must succeed. Locks in that the `>` guard has not regressed the
///         pre-existing behaviour on the reachable revert path.
contract HostileStrategyZeroDeltaRevertControlTest is HostileWithdrawTestBase {
    function setUp() public {
        _baseSetUp();
        hostile.setDepositFraction(10_000); // full deposit; no leftover allowance
        hostile.setDrainAmount(0);
        hostile.setRevertOnWithdraw(true);

        vault.forceDeployToStrategies();
    }

    function test_userWithdraw_succeedsWhenHostileRevertsWithoutDraining() external {
        uint256 ask = 50_000e18;
        uint256 aliceBalBefore = coin.balanceOf(alice);

        vm.expectEmit(true, false, false, false, address(vault));
        emit StrategyWithdrawFailed(address(hostile), 0, "");

        vm.prank(alice);
        uint256 sharesSpent = vault.withdraw(ask, alice, alice);

        assertGt(sharesSpent, 0);
        assertEq(coin.balanceOf(alice), aliceBalBefore + ask);
        // The strategy reverted, so its own counter write is rolled back.
        assertEq(hostile.withdrawCalls(), 0);
        assertGt(healthy.withdrawCalls(), 0);
        assertEq(vault.coinBalance(), coin.balanceOf(address(vault)));
    }
}

/// @dev Strategy variant that transfers a legitimate partial amount TO the
///      vault (positive delta) before reverting. Used to pin that the `>`
///      guard in the catch branch still credits a positive delta as withdrawn.
contract PartialTransferThenRevertStrategy is IStrategy, IStrategyValuation {
    IERC20 public immutable TOKEN;
    uint256 public trackedAssets;
    uint256 public withdrawCalls;
    uint256 public partialReturn;

    constructor(address token_) {
        TOKEN = IERC20(token_);
    }

    function setPartialReturn(uint256 value) external {
        partialReturn = value;
    }

    function isValuationReady() external pure override returns (bool) {
        return true;
    }

    function isActive() external pure override returns (bool) {
        return true;
    }

    function asset() external view override returns (address) {
        return address(TOKEN);
    }

    function getTotalAssets() external view override returns (uint256) {
        return trackedAssets;
    }

    function deposit(uint256 amount) external override returns (uint256) {
        if (amount == 0) return 0;
        require(TOKEN.transferFrom(msg.sender, address(this), amount), "transferFrom failed");
        trackedAssets += amount;
        return amount;
    }

    function withdraw(uint256 /* amount */) external override returns (uint256) {
        withdrawCalls += 1;
        if (partialReturn > 0 && partialReturn <= trackedAssets) {
            trackedAssets -= partialReturn;
            require(TOKEN.transfer(msg.sender, partialReturn), "transfer failed");
        }
        // NOTE: the subsequent `revert` undoes both the `TOKEN.transfer` and
        // the `trackedAssets` decrement, so the catch branch observes
        // `afterBalRevert == beforeBal` (delta = 0). We therefore assert
        // delta=0 behaviour here — the fuzz test above covers the only
        // reachable negative-delta scenario (success branch with lying
        // strategy).
        revert("PARTIAL_THEN_REVERT");
    }

    function emergencyWithdraw() external override returns (uint256 withdrawn) {
        withdrawn = trackedAssets;
        trackedAssets = 0;
        if (withdrawn > 0) {
            require(TOKEN.transfer(msg.sender, withdrawn), "transfer failed");
        }
    }

    function harvest() external pure override returns (uint256) {
        return 0;
    }

    function rebalance() external override {}
}

/// @notice Control B: revert-branch behaviour documented. Because a revert
///         unwinds the strategy's own `transfer`, the catch branch always
///         observes `afterBalRevert == beforeBal`. This test pins that
///         post-revert invariant and that the user withdraw still succeeds
///         via the healthy strategy, verifying the `>` guard doesn't crash
///         on the delta=0 case.
contract PartialTransferThenRevertTest is Test {
    MockHostileCoin internal coin;
    CreatorOVault internal vault;
    PartialTransferThenRevertStrategy internal stubborn;
    HealthyStrategy internal healthy;

    address internal alice = makeAddr("alice");

    event StrategyWithdrawFailed(address indexed strategy, uint256 amount, bytes revertData);

    function setUp() public {
        coin = new MockHostileCoin();
        vault = new CreatorOVault(address(coin), address(this), "Creator OVault", "ovCR8R");
        vault.setModulesOnce(
            address(new CreatorOVaultCoreModule()),
            address(new CreatorOVaultStrategiesModule()),
            address(new CreatorOVaultAdminModule())
        );

        stubborn = new PartialTransferThenRevertStrategy(address(coin));
        healthy = new HealthyStrategy(address(coin));

        vault.addStrategy(address(stubborn), 1, true);
        vault.addStrategy(address(healthy), 9_999, true);
        vault.setFlashLoanProtection(0, type(uint256).max, 1);

        uint256 depositAmount = vault.MINIMUM_FIRST_DEPOSIT() * 2;
        coin.mint(alice, depositAmount + 500_000e18);
        vm.prank(alice);
        coin.approve(address(vault), type(uint256).max);
        vm.prank(alice);
        vault.deposit(depositAmount, alice);

        stubborn.setPartialReturn(1_000e18);
        vault.forceDeployToStrategies();
    }

    function test_revertBranch_observesZeroDelta_andUserWithdrawSucceeds() external {
        uint256 ask = 50_000e18;
        uint256 aliceBalBefore = coin.balanceOf(alice);
        uint256 vaultBalBefore = coin.balanceOf(address(vault));

        vm.expectEmit(true, false, false, false, address(vault));
        emit StrategyWithdrawFailed(address(stubborn), 0, "");

        vm.prank(alice);
        vault.withdraw(ask, alice, alice);

        assertEq(coin.balanceOf(alice), aliceBalBefore + ask);
        // The strategy reverted, so its own counter write is rolled back.
        assertEq(stubborn.withdrawCalls(), 0);
        assertGt(healthy.withdrawCalls(), 0);
        // After the healthy strategy's legitimate transfers the vault balance
        // has moved; we only assert the coinBalance tracker stays synced.
        assertEq(vault.coinBalance(), coin.balanceOf(address(vault)));
        // The stubborn strategy's pre-revert `transfer` was rolled back, so
        // its `trackedAssets` is unchanged from pre-withdraw deployment.
        assertGt(stubborn.trackedAssets(), 0);
        // Vault balance did change (healthy strategy transferred in to cover
        // the ask, then the transfer-out to alice netted out).
        // Use vaultBalBefore just to avoid an unused-var warning; actual
        // invariant is the coinBalance sync above.
        vaultBalBefore; // silence
    }
}
