// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {
    LotteryAmoeRouter,
    ILotteryAmoeConsumer,
    IAmoeManager
} from "contracts/utilities/lottery/zk/LotteryAmoeRouter.sol";
import {IAmoePlonkVerifier} from "contracts/utilities/lottery/zk/IAmoePlonkVerifier.sol";

/// @title LotteryAmoeRouter v2 — points-burn binding tests
/// @notice Exercises the v2-only surface added by PR 4b:
///         - pointsLedgerRoot publisher pattern (one-shot per epoch)
///         - pointsBurnedAsUSD pinning into the proof
///         - global pointsBurnNullifier replay guard
///         - MAX_POINTS_AS_USD ceiling (defense-in-depth)
///         - manager fan-out using the proven points value
///
/// @dev Cryptographic correctness of the proof is out of scope — that is
///      tested in the circuit integration suite (`circuits/amoe/test`). The
///      router's responsibility is the *binding* between calldata, public
///      inputs, on-chain roots, replay guards, and the downstream call to
///      `manager.processAmoeEntry`.

contract MockVerifier is IAmoePlonkVerifier {
    bool public ok = true;
    function setOk(bool v) external { ok = v; }
    function verifyProof(
        uint256[24] calldata,
        uint256[8] calldata
    ) external view returns (bool) { return ok; }
}

contract MockManager is IAmoeManager {
    address public lastBuyer;
    address public lastCoin;
    uint256 public lastPoints;
    uint256 public callCount;
    uint256 public returnEntryId = 7777;
    bool public shouldRevert;

    function setReturnEntryId(uint256 v) external { returnEntryId = v; }
    function setShouldRevert(bool v) external { shouldRevert = v; }

    function processAmoeEntry(address buyer, address coin, uint256 pointsBurnedAsUSD)
        external
        returns (uint256)
    {
        if (shouldRevert) revert("MockManager: forced revert");
        lastBuyer = buyer;
        lastCoin = coin;
        lastPoints = pointsBurnedAsUSD;
        callCount += 1;
        return returnEntryId;
    }
}

contract LotteryAmoeRouterPointsBoundTest is Test {
    LotteryAmoeRouter router;
    MockVerifier verifier;
    MockManager managerMock;

    address owner = address(0xAA);
    address publisher = address(0xBB);
    address pointsPublisher = address(0xCC);
    address buyer = address(0xCAFE);
    address coin = address(0xC0FFEE);

    uint64 constant EPOCH = 42;
    bytes32 constant ALLOW_ROOT = bytes32(uint256(0x1234));
    bytes32 constant LEDGER_ROOT = bytes32(uint256(0x5678));

    uint256 constant DEFAULT_POINTS = 1_000_000;             // $1.00
    bytes32 constant DEFAULT_NULLIFIER = bytes32(uint256(0xDEADBEEF));

    function setUp() public {
        verifier = new MockVerifier();
        managerMock = new MockManager();
        router = new LotteryAmoeRouter(owner, publisher, address(verifier));
        vm.startPrank(owner);
        router.setManager(address(managerMock));
        router.setPointsLedgerPublisher(pointsPublisher);
        vm.stopPrank();
        vm.prank(publisher);
        router.setAllowlistRoot(EPOCH, ALLOW_ROOT);
        vm.prank(pointsPublisher);
        router.setPointsLedgerRoot(EPOCH, LEDGER_ROOT);
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    function _proof()
        internal
        pure
        returns (uint256[24] memory proof)
    {
        // Synthetic 24-element PLONK proof. The MockVerifier ignores the
        // bytes; only its `ok` flag governs accept/reject. Fill with a stable
        // pattern so any future calldata-binding tests have deterministic
        // input bytes.
        for (uint256 i = 0; i < 24; i++) {
            proof[i] = i + 1;
        }
    }

    function _pubInputs(
        uint256 walletCommit,
        uint256 nonceCommit,
        uint256 pointsBurnedAsUSD,
        uint256 nullifier
    ) internal pure returns (uint256[8] memory inp) {
        inp[0] = walletCommit;
        inp[1] = uint256(uint160(0xC0FFEE));
        inp[2] = nonceCommit;
        inp[3] = uint256(EPOCH);
        inp[4] = uint256(ALLOW_ROOT);
        inp[5] = pointsBurnedAsUSD;
        inp[6] = uint256(LEDGER_ROOT);
        inp[7] = nullifier;
    }

    function _defaults(uint256 wc, uint256 nc) internal pure returns (uint256[8] memory) {
        return _pubInputs(wc, nc, DEFAULT_POINTS, uint256(DEFAULT_NULLIFIER));
    }

    function _submit(uint256[8] memory inp) internal returns (uint256) {
        uint256[24] memory proof = _proof();
        return router.submitAmoeEntryZK(buyer, coin, EPOCH, proof, inp);
    }

    // =====================================================================
    // 1. pointsLedgerRoot publisher: gating + one-shot
    // =====================================================================

    function test_setPointsLedgerRoot_onlyPublisher() public {
        // Random caller can't post a ledger root.
        vm.expectRevert(LotteryAmoeRouter.NotPointsLedgerPublisher.selector);
        router.setPointsLedgerRoot(99, bytes32(uint256(1)));
    }

    function test_setPointsLedgerRoot_oneShot() public {
        // Re-publishing the same epoch reverts even from the publisher key.
        vm.prank(pointsPublisher);
        vm.expectRevert(LotteryAmoeRouter.PointsLedgerEpochAlreadyPublished.selector);
        router.setPointsLedgerRoot(EPOCH, bytes32(uint256(0xAAAA)));
    }

    function test_setPointsLedgerRoot_emitsEvent_andStores() public {
        bytes32 newRoot = bytes32(uint256(0xBEEF));
        vm.expectEmit(true, true, true, true);
        emit LotteryAmoeRouter.PointsLedgerRootSet(EPOCH + 1, newRoot);
        vm.prank(pointsPublisher);
        router.setPointsLedgerRoot(EPOCH + 1, newRoot);
        assertEq(router.pointsLedgerRootOf(EPOCH + 1), newRoot);
    }

    // =====================================================================
    // 2. submitAmoeEntryZK — pointsLedgerRoot binding
    // =====================================================================

    function test_submitAmoeEntryZK_rejectsLedgerRootMismatch() public {
        uint256[8] memory inp = _defaults(111, 222);
        inp[6] = uint256(bytes32(uint256(0xDEAD))); // wrong ledger root
        vm.expectRevert(LotteryAmoeRouter.PointsLedgerRootMismatch.selector);
        _submit(inp);
    }

    function test_submitAmoeEntryZK_rejectsUnpublishedLedgerEpoch() public {
        // Publish allowlist for a fresh epoch, but NOT the points ledger root.
        uint64 freshEpoch = EPOCH + 100;
        vm.prank(publisher);
        router.setAllowlistRoot(freshEpoch, ALLOW_ROOT);

        uint256[8] memory inp = _defaults(111, 222);
        inp[3] = uint256(freshEpoch);
        // No setPointsLedgerRoot for freshEpoch -> on-chain root is zero.
        uint256[24] memory proof = _proof();
        vm.expectRevert(LotteryAmoeRouter.PointsLedgerEpochNotPublished.selector);
        router.submitAmoeEntryZK(buyer, coin, freshEpoch, proof, inp);
    }

    // =====================================================================
    // 3. submitAmoeEntryZK — pointsBurnedAsUSD ceiling (defense-in-depth)
    // =====================================================================

    function test_submitAmoeEntryZK_rejectsZeroPoints() public {
        uint256[8] memory inp = _pubInputs(111, 222, 0, uint256(DEFAULT_NULLIFIER));
        vm.expectRevert(LotteryAmoeRouter.PointsValueOutOfRange.selector);
        _submit(inp);
    }

    function test_submitAmoeEntryZK_rejectsPointsAboveMax() public {
        uint256 tooMuch = router.MAX_POINTS_AS_USD() + 1;
        uint256[8] memory inp = _pubInputs(111, 222, tooMuch, uint256(DEFAULT_NULLIFIER));
        vm.expectRevert(LotteryAmoeRouter.PointsValueOutOfRange.selector);
        _submit(inp);
    }

    function test_submitAmoeEntryZK_acceptsPointsAtMax() public {
        // Exactly MAX_POINTS_AS_USD must succeed (boundary inclusive).
        uint256 atMax = router.MAX_POINTS_AS_USD();
        uint256[8] memory inp = _pubInputs(111, 222, atMax, uint256(DEFAULT_NULLIFIER));
        uint256 id = _submit(inp);
        assertEq(id, 1);
        assertEq(managerMock.lastPoints(), atMax);
    }

    // =====================================================================
    // 4. submitAmoeEntryZK — pointsBurnNullifier replay guard (GLOBAL)
    // =====================================================================

    function test_submitAmoeEntryZK_rejectsNullifierReplay_sameEpoch() public {
        // First submit consumes the nullifier.
        _submit(_defaults(111, 222));

        // Second submit with a different wallet + nonce but same nullifier
        // (and same epoch) must revert.
        uint256[8] memory inp = _pubInputs(999, 333, DEFAULT_POINTS, uint256(DEFAULT_NULLIFIER));
        vm.expectRevert(LotteryAmoeRouter.PointsBurnReplayed.selector);
        _submit(inp);
    }

    function test_submitAmoeEntryZK_rejectsNullifierReplay_differentEpoch() public {
        // Replay guard is GLOBAL — the same nullifier reused in a *different*
        // epoch must still revert.
        _submit(_defaults(111, 222));

        // New epoch with everything fresh except the nullifier.
        uint64 nextEpoch = EPOCH + 1;
        vm.prank(publisher);
        router.setAllowlistRoot(nextEpoch, ALLOW_ROOT);
        vm.prank(pointsPublisher);
        router.setPointsLedgerRoot(nextEpoch, LEDGER_ROOT);

        uint256[8] memory inp = _pubInputs(999, 333, DEFAULT_POINTS, uint256(DEFAULT_NULLIFIER));
        inp[3] = uint256(nextEpoch);
        uint256[24] memory proof = _proof();
        vm.expectRevert(LotteryAmoeRouter.PointsBurnReplayed.selector);
        router.submitAmoeEntryZK(buyer, coin, nextEpoch, proof, inp);
    }

    // =====================================================================
    // 5. Replay-guard ordering: pointsBurnNullifier must be flipped only on
    //    success, not on a failed proof verification.
    // =====================================================================

    function test_submitAmoeEntryZK_failedProof_doesNotConsumeNullifier() public {
        verifier.setOk(false);
        uint256[8] memory inp = _defaults(111, 222);
        vm.expectRevert(LotteryAmoeRouter.InvalidProof.selector);
        _submit(inp);

        // None of the replay guards must have been flipped.
        assertFalse(router.usedPointsBurnNullifier(DEFAULT_NULLIFIER));
        assertFalse(router.usedNonceCommit(bytes32(uint256(222))));
        assertFalse(router.usedWalletCommit(EPOCH, bytes32(uint256(111))));

        // Re-running with a valid proof must now succeed.
        verifier.setOk(true);
        assertEq(_submit(inp), 1);
        assertTrue(router.usedPointsBurnNullifier(DEFAULT_NULLIFIER));
    }

    // =====================================================================
    // 6. Manager fan-out — the proven `pointsBurnedAsUSD` reaches the manager.
    // =====================================================================

    function test_submitAmoeEntryZK_managerReceivesProvenPointsValue() public {
        uint256 provenPoints = 500_000_000; // $500
        uint256[8] memory inp =
            _pubInputs(111, 222, provenPoints, uint256(DEFAULT_NULLIFIER));
        _submit(inp);

        assertEq(managerMock.callCount(), 1);
        assertEq(managerMock.lastBuyer(), buyer);
        assertEq(managerMock.lastCoin(), coin);
        assertEq(managerMock.lastPoints(), provenPoints);
    }

    function test_submitAmoeEntryZK_skipsManager_whenUnset() public {
        // Clear the manager pointer; entry must still record on-chain but not
        // attempt the fan-out.
        vm.prank(owner);
        router.setManager(address(0));

        uint256[8] memory inp = _defaults(111, 222);
        uint256 id = _submit(inp);
        assertEq(id, 1);
        assertEq(managerMock.callCount(), 0);
    }

    function test_submitAmoeEntryZK_managerRevert_propagates() public {
        // If the manager reverts (e.g. paused, registry inactive), the whole
        // entry must roll back so the replay guards don't leak.
        managerMock.setShouldRevert(true);

        uint256[8] memory inp = _defaults(111, 222);
        vm.expectRevert(); // bubbled-up MockManager string
        _submit(inp);

        assertFalse(router.usedPointsBurnNullifier(DEFAULT_NULLIFIER));
        assertFalse(router.usedNonceCommit(bytes32(uint256(222))));
        assertEq(router.nextEntryId(), 0);
    }

    // =====================================================================
    // 7. Settlement event — emitted only on the v2 path with the right values.
    // =====================================================================

    function test_submitAmoeEntryZK_emitsSettledEvent() public {
        uint256 provenPoints = 250_000_000;
        managerMock.setReturnEntryId(424242);

        uint256[8] memory inp =
            _pubInputs(111, 222, provenPoints, uint256(DEFAULT_NULLIFIER));
        uint256[24] memory proof = _proof();

        vm.expectEmit(true, true, true, true);
        emit LotteryAmoeRouter.AmoeEntrySettled(
            1,
            DEFAULT_NULLIFIER,
            provenPoints,
            424242
        );
        router.submitAmoeEntryZK(buyer, coin, EPOCH, proof, inp);
    }

    // =====================================================================
    // 8. Admin
    // =====================================================================

    function test_setPointsLedgerPublisher_onlyOwner() public {
        vm.expectRevert(LotteryAmoeRouter.NotOwner.selector);
        router.setPointsLedgerPublisher(address(0xDEAD));
    }

    function test_setPointsLedgerPublisher_rejectsZero() public {
        vm.prank(owner);
        vm.expectRevert(LotteryAmoeRouter.ZeroAddress.selector);
        router.setPointsLedgerPublisher(address(0));
    }

    function test_setManager_onlyOwner() public {
        vm.expectRevert(LotteryAmoeRouter.NotOwner.selector);
        router.setManager(address(0xDEAD));
    }

    function test_setManager_acceptsZero_toUnsetFanout() public {
        // Zero is allowed for setManager: it explicitly disables fan-out.
        vm.prank(owner);
        router.setManager(address(0));
        assertEq(address(router.manager()), address(0));
    }

    // =====================================================================
    // 9. Codex-flagged hardening
    //    a) setPointsLedgerRoot / setAllowlistRoot reject zero root
    //       (an accidental zero would brick the epoch under one-shot)
    //    b) Manager fan-out reverts when manager returns 0 (silent skip)
    //       so nullifiers don't get permanently burned for an entry that
    //       was never credited.
    // =====================================================================

    function test_setPointsLedgerRoot_rejectsZeroRoot() public {
        uint64 freshEpoch = EPOCH + 7;
        vm.prank(pointsPublisher);
        vm.expectRevert(LotteryAmoeRouter.ZeroRoot.selector);
        router.setPointsLedgerRoot(freshEpoch, bytes32(0));
        // Storage stays empty, so a corrected non-zero publish later still works.
        assertEq(router.pointsLedgerRootOf(freshEpoch), bytes32(0));
        vm.prank(pointsPublisher);
        router.setPointsLedgerRoot(freshEpoch, bytes32(uint256(0xC0DE)));
        assertEq(router.pointsLedgerRootOf(freshEpoch), bytes32(uint256(0xC0DE)));
    }

    function test_setAllowlistRoot_rejectsZeroRoot() public {
        uint64 freshEpoch = EPOCH + 8;
        vm.prank(publisher);
        vm.expectRevert(LotteryAmoeRouter.ZeroRoot.selector);
        router.setAllowlistRoot(freshEpoch, bytes32(0));
        // Storage stays empty so a corrected publish still works.
        assertEq(router.allowlistRootOf(freshEpoch), bytes32(0));
        vm.prank(publisher);
        router.setAllowlistRoot(freshEpoch, bytes32(uint256(0xABCD)));
        assertEq(router.allowlistRootOf(freshEpoch), bytes32(uint256(0xABCD)));
    }

    function test_submitAmoeEntryZK_revertsWhenManagerReturnsZero() public {
        // Simulate the manager's silent-skip branches (inactive coin,
        // sub-minSwap, lottery inactive) by having the mock return 0.
        managerMock.setReturnEntryId(0);

        uint256[8] memory inp = _defaults(111, 222);
        vm.expectRevert(LotteryAmoeRouter.ManagerDeclinedEntry.selector);
        _submit(inp);

        // Critical invariant: nullifiers must NOT be burned, so the user
        // can resubmit later when the manager is willing to credit.
        assertFalse(router.usedPointsBurnNullifier(DEFAULT_NULLIFIER));
        assertFalse(router.usedNonceCommit(bytes32(uint256(222))));
        assertFalse(router.usedWalletCommit(EPOCH, bytes32(uint256(111))));
        assertEq(router.nextEntryId(), 0);
    }

    function test_submitAmoeEntryZK_succeedsWhenManagerReturnsNonZero() public {
        // Sanity twin to the above: a non-zero manager return must NOT
        // revert, even with very small entry ids.
        managerMock.setReturnEntryId(1);
        uint256[8] memory inp = _defaults(111, 222);
        uint256 id = _submit(inp);
        assertEq(id, 1);
        assertEq(managerMock.callCount(), 1);
        assertTrue(router.usedPointsBurnNullifier(DEFAULT_NULLIFIER));
    }

    function test_submitAmoeEntryZK_managerReturnsZero_resubmitAfterFix() public {
        // First attempt: manager declines (returns 0) -> revert, nullifier preserved.
        managerMock.setReturnEntryId(0);
        uint256[8] memory inp = _defaults(111, 222);
        vm.expectRevert(LotteryAmoeRouter.ManagerDeclinedEntry.selector);
        _submit(inp);

        // Operator fixes the manager state (e.g. activates the coin, raises
        // pool depth above minSwap). Resubmitting the SAME proof + nullifier
        // now succeeds — proving the user-facing replay path is intact.
        managerMock.setReturnEntryId(9001);
        uint256 id = _submit(inp);
        assertEq(id, 1);
        assertTrue(router.usedPointsBurnNullifier(DEFAULT_NULLIFIER));
        // callCount is 1 — the first call's increment reverted along with the
        // outer tx, so only the successful resubmit is observable.
        assertEq(managerMock.callCount(), 1);
        assertEq(managerMock.lastPoints(), DEFAULT_POINTS);
    }
}
