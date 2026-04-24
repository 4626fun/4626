// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../contracts/utilities/routers/VaultShareBurnStream.sol";

// ============================================================================
// VaultShareBurnStream — hostile burn-recipient fuzz suite
//
// Scope:
//   Pins the invariants of the `failedBurnAccumulator` path (H-05 cap + BS-03
//   try/catch) against a mock vault whose `burnSharesForPriceIncrease` reverts.
//   Before H-05, a persistently-failing burn target would silently accumulate
//   unbounded "ghost" shares in the stream contract; the cap + recovery
//   function bound the failure mode and give operators an escape hatch.
//
//   These tests are defense-in-depth regression guards. The scenarios they
//   cover are not tied to a specific open finding, but they lock down the
//   behaviour the H-05 and BS-03 fixes promised so future refactors can't
//   silently regress the lock-up protection.
//
// Key properties pinned:
//   1. Mid-epoch failing drip accumulates exactly `burnedNow` per call into
//      `failedBurnAccumulator` and emits `BurnFailed` — never reverts as long
//      as the running total stays at or below `MAX_FAILED_BURN_ACCUMULATOR`.
//   2. A single drip that would push the accumulator above the cap reverts
//      with `FailedBurnAccumulatorFull(current, cap)` and leaves state
//      unchanged (no partial update, no silent drop).
//   3. `recoverFailedBurns(amount)` — gated to `msg.sender == vault` —
//      decrements the accumulator by `min(amount, accum)` (or the full
//      accumulator when `amount == 0`), calls the real burn with the
//      recovered amount, and emits `FailedBurnsRecovered`.
//   4. Recovery on an empty accumulator reverts with `NothingToRecover`.
//   5. Any non-vault caller reverts with `OnlyVault`.
//   6. Rollover + recovery — a failed active epoch + a queued pending epoch
//      remain independent; recovery of the failed accumulator does not touch
//      `activeShares` / `pendingShares` / `burnedActive`.
//   7. Invariant: the stream never loses shares silently. For any sequence of
//      drips with a reverting vault,
//          failedBurnAccumulator == sum of all `burnedNow` emitted in
//          `BurnFailed` events so far,
//      and the contract's share balance still holds every unburned share.
// ============================================================================

/// @dev Mock vault that exposes `ICreatorOVaultBurn` via an ERC20 so the stream
///      can also `balanceOf(stream)`. Burn and pricePerShare can be toggled to
///      revert for adversarial testing.
///
///      IMPORTANT — counting reverted attempts:
///      `burnCalls` and `lastBurnAmount` increment only on the **success** path,
///      because any storage write made in a subcall that ultimately reverts is
///      rolled back by the EVM — even when the parent frame (`VaultShareBurnStream`)
///      catches the revert via `try/catch`. Writes before a `revert` inside this
///      mock therefore never land. To count *attempts* (success + failure),
///      observe the stream's `BurnFailed` event via `vm.recordLogs()` /
///      `vm.getRecordedLogs()` and add it to `burnCalls`. See
///      `_countBurnFailedLogsFromStream` in the test base for the helper.
contract HostileBurnVault is ERC20 {
    uint256 public totalAssets = 1e18;
    bool public burnReverts;
    bool public ppsReverts;

    /// @notice Counts only SUCCESSFUL burn calls. Writes in the reverting
    ///         branch would be rolled back by the EVM even though the caller
    ///         catches the revert, so this counter is deliberately incremented
    ///         after the revert check.
    uint256 public burnCalls;
    /// @notice Last `shares` argument seen by a SUCCESSFUL burn call. Same
    ///         rationale as `burnCalls`.
    uint256 public lastBurnAmount;
    uint256 public totalBurnedSuccessfully;

    constructor() ERC20("Mock Vault Shares", "mSHARE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setBurnReverts(bool value) external {
        burnReverts = value;
    }

    function setPpsReverts(bool value) external {
        ppsReverts = value;
    }

    function burnSharesForPriceIncrease(uint256 shares) external {
        // Check-before-write so that failed attempts are NOT counted here
        // (their writes would be rolled back by the revert regardless).
        if (burnReverts) revert("HOSTILE_BURN_REVERT");

        // Successful burn: persist counter state, then take the shares out of
        // circulation. Caller (the stream) must hold at least `shares` balance.
        burnCalls += 1;
        lastBurnAmount = shares;
        _burn(msg.sender, shares);
        totalBurnedSuccessfully += shares;
    }

    function pricePerShare() external view returns (uint256) {
        if (ppsReverts) revert("HOSTILE_PPS_REVERT");
        uint256 supply = totalSupply();
        if (supply == 0) return 0;
        return (totalAssets * 1e18) / supply;
    }
}

abstract contract BurnStreamHostileTestBase is Test {
    HostileBurnVault internal vault;
    VaultShareBurnStream internal stream;

    // Mirrored event signatures for `vm.expectEmit`.
    event BurnFailed(uint256 indexed epochStart, uint256 burnAttempted, uint256 failedTotal);
    event FailedBurnsRecovered(uint256 recovered, uint256 remaining);

    uint256 internal constant CAP = 1_000_000e18;

    function _baseSetUp() internal {
        vault = new HostileBurnVault();
        stream = new VaultShareBurnStream(address(vault));
        // BS-01: the vault authorizes the test contract as a queuer.
        vm.prank(address(vault));
        stream.setAuthorizedQueuer(address(this), true);
    }

    /// @dev Mint `shares` directly to the stream and queue them for the next
    ///      epoch, then warp to the start of that epoch and `start()` the
    ///      stream so `activeShares == shares`. Only warps FORWARD — callers
    ///      that chain multiple epochs rely on this to be time-monotonic.
    function _queueAndStart(uint256 shares) internal {
        // Ensure we begin at (or past) a known anchor only on the very first
        // call of a test; subsequent calls just keep moving forward.
        if (block.timestamp < 7 days * 1_000) {
            vm.warp(7 days * 1_000);
        }
        vault.mint(address(stream), shares);
        stream.queueShares(shares);

        uint256 pending = stream.pendingEpochStart();
        if (block.timestamp < pending) {
            vm.warp(pending);
        }
        stream.start();
        assertEq(stream.activeShares(), shares, "activeShares mismatch after start");
    }

    /// @dev Counts `BurnFailed(uint256,uint256,uint256)` events emitted by the
    ///      stream in the recorded-logs window. This is how we count *failed*
    ///      burn attempts, because storage writes inside the reverting mock
    ///      subcall are rolled back by the EVM even though the stream catches
    ///      the revert (the `try/catch` only preserves state in the *parent*
    ///      frame; the subcall frame's writes are gone). The stream itself
    ///      emits `BurnFailed` in its `catch` block after rollback, which is
    ///      the persistent record of an attempted-and-failed burn.
    function _countBurnFailedLogsFromStream(Vm.Log[] memory logs) internal view returns (uint256 count) {
        // keccak256("BurnFailed(uint256,uint256,uint256)") — indexed `epochStart`
        // makes it topic1, so the event signature remains topic0.
        bytes32 sig = keccak256("BurnFailed(uint256,uint256,uint256)");
        for (uint256 i = 0; i < logs.length; i++) {
            if (
                logs[i].emitter == address(stream) &&
                logs[i].topics.length >= 1 &&
                logs[i].topics[0] == sig
            ) {
                count += 1;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// 1. Accumulate up to the cap
// ---------------------------------------------------------------------------
contract BurnStreamAccumulateUnderCapTest is BurnStreamHostileTestBase {
    function setUp() public {
        _baseSetUp();
    }

    /// @dev Fuzz sharesQueued in (0, CAP] and run the full epoch with a
    ///      reverting vault. The accumulator must equal `activeShares` at the
    ///      end (all burnedNow increments sum to `activeShares`) and the drip
    ///      must never revert.
    function testFuzz_dripAccumulatesExactActiveShares_whenVaultRevertsAndUnderCap(uint256 sharesQueued) external {
        sharesQueued = bound(sharesQueued, 1e18, CAP);

        vault.setBurnReverts(true);

        _queueAndStart(sharesQueued);

        // Run the whole epoch in one tick. We count failed burn attempts via
        // the stream's `BurnFailed` event — not via `vault.burnCalls()` —
        // because the mock's pre-revert storage writes are rolled back by the
        // EVM. See `_countBurnFailedLogsFromStream` for the full rationale.
        vm.recordLogs();
        vm.warp(stream.activeEpochStart() + stream.EPOCH_DURATION());
        stream.drip();
        Vm.Log[] memory logs = vm.getRecordedLogs();

        assertEq(stream.failedBurnAccumulator(), sharesQueued, "accumulator != activeShares");
        assertEq(stream.activeShares(), 0, "stream did not complete epoch");
        // Attempts = successful (vault.burnCalls) + failed (BurnFailed logs).
        // In this scenario every attempt fails, so successful == 0 and the
        // failed-log count is the attempt count. For a full-epoch drip of a
        // fresh stream, exactly one burn attempt is expected (the rounding-
        // remainder second call is only invoked when `activeShares -
        // burnedActive > 0`, which is false here because `burnedNow ==
        // sharesQueued`).
        uint256 failedAttempts = _countBurnFailedLogsFromStream(logs);
        assertEq(vault.burnCalls(), 0, "no burn should have succeeded");
        assertEq(failedAttempts, 1, "burn was not attempted exactly once");
        assertEq(vault.totalBurnedSuccessfully(), 0, "stream burned despite revert");
        // The contract still holds every share it accumulated — nothing lost.
        assertEq(vault.balanceOf(address(stream)), sharesQueued, "stream lost shares silently");
    }

    /// @dev Multi-tick version: several mid-epoch drips, each failing. The
    ///      accumulator sum must track exactly `burnedActive` at every step
    ///      (because every attempted burn failed).
    function testFuzz_multipleMidEpochDrips_sumIntoAccumulator(uint256 sharesQueued, uint8 ticks) external {
        sharesQueued = bound(sharesQueued, 1_000e18, CAP);
        uint256 tickCount = bound(uint256(ticks), 2, 10);

        vault.setBurnReverts(true);

        _queueAndStart(sharesQueued);

        uint256 epoch = stream.EPOCH_DURATION();
        uint256 epochStart = stream.activeEpochStart();

        uint256 lastAccum = 0;
        for (uint256 i = 1; i <= tickCount; i++) {
            // Distribute ticks evenly across the epoch.
            vm.warp(epochStart + (epoch * i) / (tickCount + 1));
            uint256 burnedNow = stream.drip();
            uint256 accum = stream.failedBurnAccumulator();
            assertEq(accum, lastAccum + burnedNow, "accumulator drift");
            assertEq(accum, stream.burnedActive(), "accumulator != burnedActive");
            lastAccum = accum;
        }
    }
}

// ---------------------------------------------------------------------------
// 2. Cap enforcement — drip reverts; state unchanged
// ---------------------------------------------------------------------------
contract BurnStreamCapEnforcementTest is BurnStreamHostileTestBase {
    function setUp() public {
        _baseSetUp();
    }

    /// @dev When a single end-of-epoch drip would push the accumulator past
    ///      the cap, it reverts with `FailedBurnAccumulatorFull` and leaves
    ///      accumulator + activeShares unchanged so the operator can still
    ///      `recoverFailedBurns` first and retry.
    function testFuzz_dripReverts_whenSingleAttemptWouldOverflowCap(uint256 sharesQueued) external {
        sharesQueued = bound(sharesQueued, CAP + 1, CAP * 5);

        vault.setBurnReverts(true);

        _queueAndStart(sharesQueued);

        uint256 accumBefore = stream.failedBurnAccumulator();
        uint256 activeBefore = stream.activeShares();
        uint256 burnedBefore = stream.burnedActive();

        vm.warp(stream.activeEpochStart() + stream.EPOCH_DURATION());
        vm.expectRevert(
            abi.encodeWithSelector(
                VaultShareBurnStream.FailedBurnAccumulatorFull.selector, sharesQueued, CAP
            )
        );
        stream.drip();

        // State must be entirely unchanged after the revert.
        assertEq(stream.failedBurnAccumulator(), accumBefore, "accumulator changed on revert");
        assertEq(stream.activeShares(), activeBefore, "activeShares changed on revert");
        assertEq(stream.burnedActive(), burnedBefore, "burnedActive changed on revert");
    }

    /// @dev Path where prior failures + a new failure cross the cap. We
    ///      first fill the accumulator to just under CAP, then try another
    ///      drip that would push it over. Same revert + no state change.
    function testFuzz_dripReverts_whenAccumulatedPlusNextAttemptOverflowsCap(uint256 prior) external {
        prior = bound(prior, CAP / 2, CAP - 2e18);

        vault.setBurnReverts(true);

        // First epoch: queue `prior` shares, fail through them fully.
        _queueAndStart(prior);
        vm.warp(stream.activeEpochStart() + stream.EPOCH_DURATION());
        stream.drip();
        assertEq(stream.failedBurnAccumulator(), prior, "first epoch did not fill accum");

        // Second epoch: queue enough to tip over the cap on a single end-of-
        // epoch drip. `CAP - prior + 1e18` is the smallest attempt that
        // always crosses the cap (assuming prior <= CAP - 2e18).
        uint256 next = CAP - prior + 1e18;
        // Epoch 1 completed (activeShares == 0, pendingShares == 0) so the
        // queue accepts fresh pending shares for the next epoch.
        vault.mint(address(stream), next);
        stream.queueShares(next);

        // Warp to the pending start.
        uint256 pending = stream.pendingEpochStart();
        vm.warp(pending);
        stream.start();
        assertEq(stream.activeShares(), next, "second epoch activeShares mismatch");

        vm.warp(stream.activeEpochStart() + stream.EPOCH_DURATION());
        uint256 accumBefore = stream.failedBurnAccumulator();
        vm.expectRevert(
            abi.encodeWithSelector(
                VaultShareBurnStream.FailedBurnAccumulatorFull.selector, prior + next, CAP
            )
        );
        stream.drip();
        assertEq(stream.failedBurnAccumulator(), accumBefore, "accumulator changed on cap-cross revert");
    }
}

// ---------------------------------------------------------------------------
// 3. Recovery path
// ---------------------------------------------------------------------------
contract BurnStreamRecoveryTest is BurnStreamHostileTestBase {
    function setUp() public {
        _baseSetUp();
    }

    /// @dev Fill the accumulator with a full failing epoch, heal the vault,
    ///      then fuzz over recovery amounts including 0 (= full). Assert:
    ///       - accumulator decrements by min(amount, accum) (or accum if 0).
    ///       - burnSharesForPriceIncrease was called with exactly that value.
    ///       - Event emitted with the recovered + remaining amounts.
    function testFuzz_recoverFailedBurns_decrementsAndInvokesBurn(uint256 sharesQueued, uint256 amount) external {
        sharesQueued = bound(sharesQueued, 10e18, CAP);

        vault.setBurnReverts(true);
        _queueAndStart(sharesQueued);
        vm.warp(stream.activeEpochStart() + stream.EPOCH_DURATION());
        stream.drip();
        assertEq(stream.failedBurnAccumulator(), sharesQueued, "setup: accumulator not full");

        // Heal the vault.
        vault.setBurnReverts(false);

        // Reset burn call counter so we can observe the recovery burn in
        // isolation. We can't reset `burnCalls` from outside, so snapshot it.
        uint256 burnCallsBefore = vault.burnCalls();

        uint256 accum = stream.failedBurnAccumulator();
        uint256 expectedRecovered = (amount == 0 || amount > accum) ? accum : amount;

        vm.expectEmit(false, false, false, true, address(stream));
        emit FailedBurnsRecovered(expectedRecovered, accum - expectedRecovered);

        vm.prank(address(vault));
        uint256 recovered = stream.recoverFailedBurns(amount);

        assertEq(recovered, expectedRecovered, "recovered != expected");
        assertEq(stream.failedBurnAccumulator(), accum - expectedRecovered, "accumulator mispatched");
        assertEq(vault.burnCalls(), burnCallsBefore + 1, "burn not invoked");
        assertEq(vault.lastBurnAmount(), expectedRecovered, "burn called with wrong amount");
        assertEq(vault.totalBurnedSuccessfully(), expectedRecovered, "burn did not actually remove shares");
    }

    function testFuzz_recoverFailedBurns_onlyVaultCanCall(address caller, uint256 amount) external {
        vm.assume(caller != address(vault));
        vm.assume(caller != address(0));

        // Seed the accumulator so the `NothingToRecover` check doesn't
        // pre-empt `OnlyVault`. (`OnlyVault` is checked first in the source,
        // but fuzzing state-independent ordering is cheap.)
        vault.setBurnReverts(true);
        _queueAndStart(100e18);
        vm.warp(stream.activeEpochStart() + stream.EPOCH_DURATION());
        stream.drip();

        vm.prank(caller);
        vm.expectRevert(VaultShareBurnStream.OnlyVault.selector);
        stream.recoverFailedBurns(amount);
    }

    function test_recoverFailedBurns_revertsOnEmptyAccumulator() external {
        vm.prank(address(vault));
        vm.expectRevert(VaultShareBurnStream.NothingToRecover.selector);
        stream.recoverFailedBurns(0);
    }

    /// @dev Effects-before-interaction: if the healed vault's burn hook ALSO
    ///      reverts (bizarre case, defensive test), the whole tx reverts and
    ///      the accumulator rolls back — not silently stuck at the decremented
    ///      value.
    function testFuzz_recoverFailedBurns_rollsBackAccumulatorIfBurnReverts(uint256 sharesQueued) external {
        sharesQueued = bound(sharesQueued, 10e18, CAP);

        vault.setBurnReverts(true);
        _queueAndStart(sharesQueued);
        vm.warp(stream.activeEpochStart() + stream.EPOCH_DURATION());
        stream.drip();

        // Vault is still reverting during the recovery call.
        uint256 accumBefore = stream.failedBurnAccumulator();
        vm.prank(address(vault));
        vm.expectRevert(bytes("HOSTILE_BURN_REVERT"));
        stream.recoverFailedBurns(0);

        // Accumulator unchanged.
        assertEq(stream.failedBurnAccumulator(), accumBefore, "accumulator not rolled back");
    }
}

// ---------------------------------------------------------------------------
// 4. Rollover + failed accumulator independence
// ---------------------------------------------------------------------------
contract BurnStreamRolloverIndependenceTest is BurnStreamHostileTestBase {
    function setUp() public {
        _baseSetUp();
    }

    /// @dev Invariant: failed burns from one epoch are NOT mixed into the
    ///      next epoch's active/pending accounting. Recovery only moves the
    ///      accumulator, not `activeShares` / `pendingShares`.
    function testFuzz_failedAccumulator_doesNotCorruptNextEpochAccounting(
        uint256 epoch1Shares,
        uint256 epoch2Shares
    ) external {
        epoch1Shares = bound(epoch1Shares, 10e18, CAP / 2);
        epoch2Shares = bound(epoch2Shares, 10e18, CAP / 2);

        // Epoch 1: hostile vault, full fail.
        vault.setBurnReverts(true);
        _queueAndStart(epoch1Shares);
        vm.warp(stream.activeEpochStart() + stream.EPOCH_DURATION());
        stream.drip();
        assertEq(stream.failedBurnAccumulator(), epoch1Shares);
        assertEq(stream.activeShares(), 0, "epoch 1 did not complete");

        // Queue shares for epoch 2 while vault still reverts.
        vault.mint(address(stream), epoch2Shares);
        stream.queueShares(epoch2Shares);
        uint256 pending2 = stream.pendingEpochStart();
        vm.warp(pending2);
        stream.start();
        assertEq(stream.activeShares(), epoch2Shares, "epoch 2 active mismatch");
        // Accumulator from epoch 1 is still parked — epoch 2 start did NOT
        // zero it.
        assertEq(stream.failedBurnAccumulator(), epoch1Shares, "start() touched accumulator");

        // Heal vault, recover epoch 1's failed shares partway through epoch 2.
        vault.setBurnReverts(false);
        vm.prank(address(vault));
        stream.recoverFailedBurns(0); // recover everything
        assertEq(stream.failedBurnAccumulator(), 0, "accumulator not cleared");
        // Recovery burned the epoch 1 shares — epoch 2 accounting untouched.
        assertEq(stream.activeShares(), epoch2Shares, "recovery mutated activeShares");

        // Finish epoch 2 normally.
        vm.warp(stream.activeEpochStart() + stream.EPOCH_DURATION());
        stream.drip();
        assertEq(stream.activeShares(), 0, "epoch 2 did not complete");
        assertEq(stream.failedBurnAccumulator(), 0, "epoch 2 unexpectedly failed");
        // Vault burned: epoch1 recovery (epoch1Shares) + epoch 2 (epoch2Shares).
        assertEq(
            vault.totalBurnedSuccessfully(),
            epoch1Shares + epoch2Shares,
            "burn total mismatch"
        );
    }
}

// ---------------------------------------------------------------------------
// 5. Safety net: pricePerShare reverts must not stop the drip
// ---------------------------------------------------------------------------
contract BurnStreamPricePerShareRevertTest is BurnStreamHostileTestBase {
    function setUp() public {
        _baseSetUp();
    }

    /// @dev `pricePerShare()` is called inside a try/catch to feed the
    ///      `StreamDripped` event; its reverts must never cascade. This pins
    ///      that behaviour with a vault that reverts on pps even when burn
    ///      itself succeeds, AND when burn fails.
    function testFuzz_drip_succeeds_evenWhenPricePerShareReverts(uint256 sharesQueued, bool burnFails) external {
        sharesQueued = bound(sharesQueued, 10e18, CAP);

        vault.setBurnReverts(burnFails);
        vault.setPpsReverts(true);

        _queueAndStart(sharesQueued);
        vm.warp(stream.activeEpochStart() + stream.EPOCH_DURATION());

        // Must not revert regardless of the burn-side outcome.
        stream.drip();

        if (burnFails) {
            assertEq(stream.failedBurnAccumulator(), sharesQueued, "accum != shares on fail path");
        } else {
            assertEq(stream.failedBurnAccumulator(), 0, "accum touched on success path");
            assertEq(vault.totalBurnedSuccessfully(), sharesQueued, "burn did not remove shares");
        }
        assertEq(stream.activeShares(), 0, "epoch did not complete");
    }
}
