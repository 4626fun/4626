// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IStrategy} from "../contracts/interfaces/IStrategy.sol";

/// @dev FIX: M-09 — regression tests for `_tryWithdrawFromStrategyMeasured`, the
///      best-effort withdrawal helper that replaces the strict revert on the
///      user-facing `_withdrawFromStrategies` hot path.
///
///      The vulnerability: a reverting or accounting-mismatched strategy would
///      bubble up through `_withdrawFromStrategyMeasured` and DoS every withdrawal
///      from the vault until governance manually force-removed the strategy.
///      The fix wraps the strategy call in try/catch and swallows mismatches,
///      emitting `StrategyWithdrawFailed` and returning a safe measured delta
///      so the outer queue loop can skip to the next strategy.
///
///      Because `CreatorOVaultStrategiesModule` is a delegatecall module that
///      reads `asset()` off the hosting vault via `IERC4626(address(this)).asset()`,
///      we test the resilience helper through a minimal harness that inlines the
///      exact code under review rather than spinning the full vault wiring. The
///      logic, events, selectors, and return-value branches are a byte-for-byte
///      port of the production implementation in
///      `contracts/vault/modules/CreatorOVaultStrategiesModule.sol`.

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

contract MockCreatorCoin is ERC20 {
    constructor() ERC20("Creator Coin", "CR8R") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Well-behaved strategy: transfers `amount` of the asset back to the caller
///      and returns that same amount as the reported value.
contract HappyStrategy is IStrategy {
    IERC20 public immutable coin;

    constructor(IERC20 _coin) {
        coin = _coin;
    }

    function asset() external view returns (address) { return address(coin); }
    function isActive() external pure returns (bool) { return true; }
    function getTotalAssets() external view returns (uint256) { return coin.balanceOf(address(this)); }

    function deposit(uint256 amount) external returns (uint256) {
        coin.transferFrom(msg.sender, address(this), amount);
        return amount;
    }

    function withdraw(uint256 amount) external returns (uint256) {
        coin.transfer(msg.sender, amount);
        return amount;
    }

    function emergencyWithdraw() external returns (uint256) {
        uint256 bal = coin.balanceOf(address(this));
        coin.transfer(msg.sender, bal);
        return bal;
    }

    function harvest() external pure returns (uint256) { return 0; }
    function rebalance() external pure {}
}

/// @dev Unconditionally reverting strategy; no funds ever move.
contract RevertingStrategy is IStrategy {
    IERC20 public immutable coin;
    bytes public revertData;

    constructor(IERC20 _coin, bytes memory _revertData) {
        coin = _coin;
        revertData = _revertData;
    }

    function asset() external view returns (address) { return address(coin); }
    function isActive() external pure returns (bool) { return true; }
    function getTotalAssets() external view returns (uint256) { return coin.balanceOf(address(this)); }

    function deposit(uint256) external pure returns (uint256) { revert("reverting"); }

    function withdraw(uint256) external view returns (uint256) {
        bytes memory data = revertData;
        assembly {
            revert(add(data, 0x20), mload(data))
        }
    }

    function emergencyWithdraw() external pure returns (uint256) { revert("reverting"); }
    function harvest() external pure returns (uint256) { return 0; }
    function rebalance() external pure {}
}

/// @dev Reverts AFTER attempting to move funds. The EVM rolls the token
///      transfer back with the revert, so callers must observe zero delta.
contract PartialThenRevertStrategy is IStrategy {
    IERC20 public immutable coin;
    uint256 public immutable partialAmount;

    constructor(IERC20 _coin, uint256 _partial) {
        coin = _coin;
        partialAmount = _partial;
    }

    function asset() external view returns (address) { return address(coin); }
    function isActive() external pure returns (bool) { return true; }
    function getTotalAssets() external view returns (uint256) { return coin.balanceOf(address(this)); }

    function deposit(uint256) external pure returns (uint256) { revert("partial"); }

    function withdraw(uint256) external returns (uint256) {
        // Attempt to move funds first, then revert. The token transfer is
        // rolled back with this frame's revert.
        coin.transfer(msg.sender, partialAmount);
        revert("partial-then-revert");
    }

    function emergencyWithdraw() external pure returns (uint256) { revert("partial"); }
    function harvest() external pure returns (uint256) { return 0; }
    function rebalance() external pure {}
}

/// @dev Reports one amount but transfers a different amount — accounting mismatch.
contract MismatchStrategy is IStrategy {
    IERC20 public immutable coin;
    uint256 public immutable actualTransfer;
    uint256 public immutable reportedAmount;

    constructor(IERC20 _coin, uint256 _actualTransfer, uint256 _reportedAmount) {
        coin = _coin;
        actualTransfer = _actualTransfer;
        reportedAmount = _reportedAmount;
    }

    function asset() external view returns (address) { return address(coin); }
    function isActive() external pure returns (bool) { return true; }
    function getTotalAssets() external view returns (uint256) { return coin.balanceOf(address(this)); }

    function deposit(uint256) external pure returns (uint256) { revert("mismatch"); }

    function withdraw(uint256) external returns (uint256) {
        coin.transfer(msg.sender, actualTransfer);
        return reportedAmount;
    }

    function emergencyWithdraw() external pure returns (uint256) { revert("mismatch"); }
    function harvest() external pure returns (uint256) { return 0; }
    function rebalance() external pure {}
}

// -----------------------------------------------------------------------------
// Harness
// -----------------------------------------------------------------------------

/// @dev Source-level mirror of `_tryWithdrawFromStrategyMeasured` from
///      CreatorOVaultStrategiesModule.sol. Kept here because the production
///      function is `internal` on a delegatecall module and `_creatorCoin()`
///      expects the hosting contract to implement `IERC4626.asset()`.
///      Any change to the production function should be mirrored here AND
///      covered by a test that fails on divergence.
contract StrategyWithdrawHarness {
    IERC20 public immutable coin;
    uint256 public coinBalance;

    error TransferAmountMismatch(uint256 expected, uint256 actual);
    event StrategyWithdrawFailed(address indexed strategy, uint256 amount, bytes revertData);

    constructor(IERC20 _coin) {
        coin = _coin;
    }

    function tryWithdraw(address strategy, uint256 amount) external returns (uint256 withdrawn) {
        uint256 beforeBal = coin.balanceOf(address(this));

        uint256 reported;
        try IStrategy(strategy).withdraw(amount) returns (uint256 _reported) {
            reported = _reported;
        } catch (bytes memory revertData) {
            emit StrategyWithdrawFailed(strategy, amount, revertData);
            uint256 afterBalRevert = coin.balanceOf(address(this));
            coinBalance = afterBalRevert;
            if (afterBalRevert > beforeBal) {
                return afterBalRevert - beforeBal;
            }
            return 0;
        }

        uint256 afterBal = coin.balanceOf(address(this));
        coinBalance = afterBal;

        if (afterBal < beforeBal) {
            emit StrategyWithdrawFailed(
                strategy,
                amount,
                abi.encodeWithSelector(TransferAmountMismatch.selector, reported, 0)
            );
            return 0;
        }

        uint256 received = afterBal - beforeBal;

        if (received != reported) {
            emit StrategyWithdrawFailed(
                strategy,
                amount,
                abi.encodeWithSelector(TransferAmountMismatch.selector, reported, received)
            );
            return received;
        }

        return reported;
    }
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

contract M09_StrategyWithdrawResilienceTest is Test {
    MockCreatorCoin internal coin;
    StrategyWithdrawHarness internal harness;

    // Mirror of the event declared in `StrategyWithdrawHarness` (and the production
    // strategies module) so `vm.expectEmit` has a matching signature in scope.
    event StrategyWithdrawFailed(address indexed strategy, uint256 amount, bytes revertData);

    function setUp() public {
        coin = new MockCreatorCoin();
        harness = new StrategyWithdrawHarness(IERC20(address(coin)));
    }

    function _fundStrategy(address strategy, uint256 amount) internal {
        coin.mint(strategy, amount);
    }

    // --------------------------------------------------------------
    // 1. Happy path — well-behaved strategy returns full amount.
    // --------------------------------------------------------------
    function test_HappyPath_WithdrawsFullAmount() public {
        HappyStrategy s = new HappyStrategy(IERC20(address(coin)));
        _fundStrategy(address(s), 1_000 ether);

        uint256 withdrawn = harness.tryWithdraw(address(s), 1_000 ether);

        assertEq(withdrawn, 1_000 ether, "should report full amount");
        assertEq(coin.balanceOf(address(harness)), 1_000 ether, "harness should hold funds");
        assertEq(harness.coinBalance(), 1_000 ether, "coinBalance updated");
    }

    // --------------------------------------------------------------
    // 2. Reverting strategy — no funds moved. Must return 0, emit
    //    StrategyWithdrawFailed, and NOT revert the caller.
    // --------------------------------------------------------------
    function test_RevertingStrategy_ReturnsZeroAndEmitsEvent() public {
        bytes memory revertPayload = abi.encodeWithSignature("Error(string)", "strategy-paused");
        RevertingStrategy s = new RevertingStrategy(IERC20(address(coin)), revertPayload);
        _fundStrategy(address(s), 1_000 ether);

        vm.expectEmit(true, false, false, true);
        emit StrategyWithdrawFailed(address(s), 500 ether, revertPayload);

        uint256 withdrawn = harness.tryWithdraw(address(s), 500 ether);

        assertEq(withdrawn, 0, "should return 0 on revert with no fund movement");
        assertEq(coin.balanceOf(address(harness)), 0, "no funds moved");
        assertEq(harness.coinBalance(), 0, "coinBalance untouched");
    }

    // --------------------------------------------------------------
    // 3. Partial-then-revert — strategy attempted a transfer before
    //    reverting. The EVM rolls that transfer back, so the helper must
    //    emit the failure event and return zero.
    // --------------------------------------------------------------
    function test_PartialThenRevert_ReturnsZeroBecauseTransferRollsBack() public {
        PartialThenRevertStrategy s = new PartialThenRevertStrategy(IERC20(address(coin)), 250 ether);
        _fundStrategy(address(s), 1_000 ether);

        // We only assert event topic/emitter; revertData payload varies by solc version.
        vm.expectEmit(true, false, false, false);
        emit StrategyWithdrawFailed(address(s), 500 ether, "");

        uint256 withdrawn = harness.tryWithdraw(address(s), 500 ether);

        assertEq(withdrawn, 0, "reverted transfer is rolled back");
        assertEq(coin.balanceOf(address(harness)), 0, "harness should not receive reverted transfer");
        assertEq(harness.coinBalance(), 0, "coinBalance tracks measured balance");
    }

    // --------------------------------------------------------------
    // 4. Accounting mismatch — strategy reports more than it actually
    //    transferred. Must emit failure event with TransferAmountMismatch
    //    selector-encoded payload and return the measured `received`.
    // --------------------------------------------------------------
    function test_MismatchStrategy_ReportsMoreThanTransferred() public {
        MismatchStrategy s = new MismatchStrategy(IERC20(address(coin)), 400 ether, 500 ether);
        _fundStrategy(address(s), 1_000 ether);

        bytes memory expectedPayload = abi.encodeWithSelector(
            StrategyWithdrawHarness.TransferAmountMismatch.selector,
            uint256(500 ether), // reported
            uint256(400 ether)  // received
        );

        vm.expectEmit(true, false, false, true);
        emit StrategyWithdrawFailed(address(s), 500 ether, expectedPayload);

        uint256 withdrawn = harness.tryWithdraw(address(s), 500 ether);

        assertEq(withdrawn, 400 ether, "must trust measured receipt, not reported value");
        assertEq(coin.balanceOf(address(harness)), 400 ether);
        assertEq(harness.coinBalance(), 400 ether);
    }

    // --------------------------------------------------------------
    // 5. Accounting mismatch — strategy reports LESS than it actually
    //    transferred (exotic but possible under buggy strategies).
    //    Still treated as a mismatch: emit event, return measured.
    // --------------------------------------------------------------
    function test_MismatchStrategy_ReportsLessThanTransferred() public {
        MismatchStrategy s = new MismatchStrategy(IERC20(address(coin)), 600 ether, 500 ether);
        _fundStrategy(address(s), 1_000 ether);

        bytes memory expectedPayload = abi.encodeWithSelector(
            StrategyWithdrawHarness.TransferAmountMismatch.selector,
            uint256(500 ether),
            uint256(600 ether)
        );

        vm.expectEmit(true, false, false, true);
        emit StrategyWithdrawFailed(address(s), 500 ether, expectedPayload);

        uint256 withdrawn = harness.tryWithdraw(address(s), 500 ether);

        assertEq(withdrawn, 600 ether);
        assertEq(coin.balanceOf(address(harness)), 600 ether);
        assertEq(harness.coinBalance(), 600 ether);
    }

    // --------------------------------------------------------------
    // 6. Core property: a reverting strategy in one position of a
    //    queue loop must NOT block the next strategy's withdrawal.
    //    This simulates the outer `_withdrawFromStrategies` loop.
    // --------------------------------------------------------------
    function test_QueueLoop_SkipsRevertingStrategyAndContinues() public {
        RevertingStrategy bad = new RevertingStrategy(
            IERC20(address(coin)),
            abi.encodeWithSignature("Error(string)", "frozen")
        );
        HappyStrategy good = new HappyStrategy(IERC20(address(coin)));
        _fundStrategy(address(bad), 500 ether);
        _fundStrategy(address(good), 500 ether);

        // Simulate the loop body from `_withdrawFromStrategies`: skip on 0.
        address[2] memory queue = [address(bad), address(good)];
        uint256 remaining = 500 ether;
        uint256 totalWithdrawn;

        for (uint256 i = 0; i < queue.length && remaining > 0; i++) {
            uint256 got = harness.tryWithdraw(queue[i], remaining);
            if (got == 0) continue;
            totalWithdrawn += got;
            remaining = remaining > got ? remaining - got : 0;
        }

        assertEq(totalWithdrawn, 500 ether, "happy strategy fulfilled the request");
        assertEq(remaining, 0, "queue satisfied the full demand despite one reverting leg");
        assertEq(coin.balanceOf(address(harness)), 500 ether);
    }
}
