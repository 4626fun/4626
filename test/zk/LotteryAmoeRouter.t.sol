// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {
    LotteryAmoeRouter,
    ILotteryAmoeConsumer,
    IAmoeManager
} from "contracts/utilities/lottery/zk/LotteryAmoeRouter.sol";
import {IAmoePlonkVerifier} from "contracts/utilities/lottery/zk/IAmoePlonkVerifier.sol";

/// @notice Stub verifier (v2: 8 public inputs) returning whatever flag it's
///         configured with. The router's responsibility is the public-input
///         binding + replay guards; cryptographic correctness of the proof is
///         tested in the circuit integration tests (`circuits/amoe/test`).
contract MockVerifier is IAmoePlonkVerifier {
    bool public ok = true;
    function setOk(bool v) external { ok = v; }
    function verifyProof(
        uint256[24] calldata,
        uint256[8] calldata
    ) external view returns (bool) { return ok; }
}

/// @notice Stub legacy event-only consumer.
contract MockConsumer is ILotteryAmoeConsumer {
    event Recorded(address buyer, address coin, uint64 epoch, uint256 entryId);
    function recordAmoeEntry(address buyer, address coin, uint64 epoch, uint256 entryId) external {
        emit Recorded(buyer, coin, epoch, entryId);
    }
}

/// @notice Stub manager-shaped fan-out target (v2). Records the `pointsBurnedAsUSD`
///         it received so tests can assert the proven value reaches the manager.
contract MockManager is IAmoeManager {
    event Processed(address buyer, address coin, uint256 pointsBurnedAsUSD);

    address public lastBuyer;
    address public lastCoin;
    uint256 public lastPoints;
    uint256 public callCount;
    uint256 public returnEntryId = 1234; // fixture VRF id
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
        emit Processed(buyer, coin, pointsBurnedAsUSD);
        return returnEntryId;
    }
}

contract LotteryAmoeRouterTest is Test {
    LotteryAmoeRouter router;
    MockVerifier verifier;
    MockConsumer consumer;
    MockManager managerMock;

    address owner = address(0xAA);
    address publisher = address(0xBB);
    address pointsPublisher = address(0xCC);
    address buyer = address(0xCAFE);
    address coin = address(0xC0FFEE);

    uint64 constant EPOCH = 42;
    bytes32 constant ALLOW_ROOT = bytes32(uint256(0x1234));
    bytes32 constant LEDGER_ROOT = bytes32(uint256(0x5678));

    // Default points value used by happy-path fixtures: $1.00 USDC equivalent
    // (1e6 1e6 units). Fits comfortably under MAX_POINTS_AS_USD.
    uint256 constant DEFAULT_POINTS = 1_000_000;

    // Default nullifier (arbitrary, just needs to be non-zero).
    bytes32 constant DEFAULT_NULLIFIER = bytes32(uint256(0xDEADBEEF));

    function setUp() public {
        verifier = new MockVerifier();
        consumer = new MockConsumer();
        managerMock = new MockManager();
        router = new LotteryAmoeRouter(owner, publisher, address(verifier));
        vm.startPrank(owner);
        router.setConsumer(address(consumer));
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

    function _defaultPubInputs(uint256 walletCommit, uint256 nonceCommit)
        internal
        pure
        returns (uint256[8] memory)
    {
        return _pubInputs(walletCommit, nonceCommit, DEFAULT_POINTS, uint256(DEFAULT_NULLIFIER));
    }

    // =====================================================================
    // submitAmoeEntryZK (v2) — happy path & basic public-input bindings
    // =====================================================================

    function test_submitAmoeEntryZK_happyPath() public {
        uint256[24] memory proof = _proof();
        uint256 id = router.submitAmoeEntryZK(buyer, coin, EPOCH, proof, _defaultPubInputs(111, 222));
        assertEq(id, 1);
        assertTrue(router.usedNonceCommit(bytes32(uint256(222))));
        assertTrue(router.usedWalletCommit(EPOCH, bytes32(uint256(111))));
        assertTrue(router.usedPointsBurnNullifier(DEFAULT_NULLIFIER));
    }

    function test_submitAmoeEntryZK_rejectsRootMismatch() public {
        uint256[24] memory proof = _proof();
        uint256[8] memory inp = _defaultPubInputs(111, 222);
        inp[4] = uint256(bytes32(uint256(0xDEAD))); // wrong allowlist root
        vm.expectRevert(LotteryAmoeRouter.RootMismatch.selector);
        router.submitAmoeEntryZK(buyer, coin, EPOCH, proof, inp);
    }

    function test_submitAmoeEntryZK_rejectsCoinMismatch() public {
        uint256[24] memory proof = _proof();
        uint256[8] memory inp = _defaultPubInputs(111, 222);
        inp[1] = uint256(uint160(address(0xBADC0DE))); // wrong coin
        vm.expectRevert(LotteryAmoeRouter.InvalidProof.selector);
        router.submitAmoeEntryZK(buyer, coin, EPOCH, proof, inp);
    }

    function test_submitAmoeEntryZK_rejectsNonceReplay() public {
        uint256[24] memory proof = _proof();
        router.submitAmoeEntryZK(buyer, coin, EPOCH, proof, _defaultPubInputs(111, 222));
        // Different walletCommit, different nullifier, but same nonceCommit must still revert.
        uint256[8] memory inp = _pubInputs(999, 222, DEFAULT_POINTS, uint256(keccak256("n2")));
        vm.expectRevert(LotteryAmoeRouter.NonceReplayed.selector);
        router.submitAmoeEntryZK(buyer, coin, EPOCH, proof, inp);
    }

    function test_submitAmoeEntryZK_rejectsTwitterCreditReplay() public {
        uint256[24] memory proof = _proof();
        router.submitAmoeEntryZK(buyer, coin, EPOCH, proof, _defaultPubInputs(111, 222));
        // Same walletCommit (= same twitter credit), fresh nonce + nullifier, same epoch → revert.
        uint256[8] memory inp = _pubInputs(111, 333, DEFAULT_POINTS, uint256(keccak256("n2")));
        vm.expectRevert(LotteryAmoeRouter.WalletCreditReplayed.selector);
        router.submitAmoeEntryZK(buyer, coin, EPOCH, proof, inp);
    }

    function test_submitAmoeEntryZK_rejectsBadProof() public {
        verifier.setOk(false);
        uint256[24] memory proof = _proof();
        vm.expectRevert(LotteryAmoeRouter.InvalidProof.selector);
        router.submitAmoeEntryZK(buyer, coin, EPOCH, proof, _defaultPubInputs(111, 222));
    }

    // ---------------------------------------------------------------------
    // setAllowlistRoot
    // ---------------------------------------------------------------------

    function test_setAllowlistRoot_onlyPublisher() public {
        vm.expectRevert(LotteryAmoeRouter.NotPublisher.selector);
        router.setAllowlistRoot(99, bytes32(uint256(1)));
    }

    function test_setAllowlistRoot_oneShot() public {
        vm.prank(publisher);
        vm.expectRevert(LotteryAmoeRouter.EpochAlreadyPublished.selector);
        router.setAllowlistRoot(EPOCH, bytes32(uint256(2)));
    }

    // ---------------------------------------------------------------------
    // submitAmoeEntry (legacy ECDSA path) — deadline floor regression
    // tests for audit §4.2 (Slither `timestamp`, miner-drift hardening).
    // ---------------------------------------------------------------------

    function test_submitAmoeEntry_rejectsExpiredDeadline() public {
        // deadline already in the past -> DeadlineExpired
        vm.warp(1_000);
        vm.prank(publisher);
        vm.expectRevert(LotteryAmoeRouter.DeadlineExpired.selector);
        router.submitAmoeEntry(
            buyer,
            coin,
            keccak256("nonce-A"),
            999, // strictly < block.timestamp
            ""
        );
    }

    function test_submitAmoeEntry_rejectsDeadlineInsideMinerDrift() public {
        // deadline equal to block.timestamp passes the strict-greater check
        // but is well inside the 60s miner-drift floor.
        vm.warp(1_000_000);
        vm.prank(publisher);
        vm.expectRevert(LotteryAmoeRouter.DeadlineTooSoon.selector);
        router.submitAmoeEntry(
            buyer,
            coin,
            keccak256("nonce-B"),
            1_000_000, // equal to now
            ""
        );

        // 30s in the future: also inside the floor.
        vm.prank(publisher);
        vm.expectRevert(LotteryAmoeRouter.DeadlineTooSoon.selector);
        router.submitAmoeEntry(
            buyer,
            coin,
            keccak256("nonce-C"),
            1_000_030,
            ""
        );

        // 59s in the future: still inside (boundary exclusive).
        vm.prank(publisher);
        vm.expectRevert(LotteryAmoeRouter.DeadlineTooSoon.selector);
        router.submitAmoeEntry(
            buyer,
            coin,
            keccak256("nonce-D"),
            1_000_059,
            ""
        );
    }

    function test_submitAmoeEntry_acceptsDeadlineAtBufferBoundary() public {
        // deadline exactly MIN_DEADLINE_BUFFER seconds in the future passes.
        vm.warp(1_000_000);
        uint256 deadline = 1_000_000 + router.MIN_DEADLINE_BUFFER();
        vm.prank(publisher);
        uint256 entryId = router.submitAmoeEntry(
            buyer,
            coin,
            keccak256("nonce-E"),
            deadline,
            ""
        );
        assertGt(entryId, 0);
    }
}
