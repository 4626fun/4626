// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {LotteryAmoeRouter, IAmoeManager} from "@4626/shared/lottery/zk/LotteryAmoeRouter.sol";
import {IAmoePlonkVerifier} from "@4626/shared/lottery/zk/IAmoePlonkVerifier.sol";

contract RootTlMockVerifier is IAmoePlonkVerifier {
    function verifyProof(uint256[24] calldata, uint256[9] calldata) external pure returns (bool) {
        return true;
    }
}

contract RootTlMockManager is IAmoeManager {
    function processAmoeEntry(address, address, uint256) external pure returns (uint256) {
        return 1;
    }
}

/// @notice ODA-426-F3: AMOE roots mature before ZK settlement can use them.
contract LotteryAmoeRouterRootTimelockTest is Test {
    LotteryAmoeRouter internal router;
    address internal owner = address(0xAA);
    address internal publisher = address(0xBB);
    address internal pointsPublisher = address(0xCC);
    address internal buyer = address(0x1234567890AbcdEF1234567890aBcdef12345678);
    address internal coin = address(0x00000000C0FFEec0FfeeC0Ffeec0ffeEc0fFeeC0);

    uint64 internal constant EPOCH = 42;
    bytes32 internal constant ALLOW_ROOT = bytes32(uint256(0x1234));
    bytes32 internal constant LEDGER_ROOT = bytes32(uint256(0x5678));
    bytes32 internal constant NULLIFIER = bytes32(uint256(0xDEADBEEF));

    function setUp() public {
        router = new LotteryAmoeRouter(owner, publisher, address(new RootTlMockVerifier()));
        vm.startPrank(owner);
        router.setPointsLedgerPublisher(pointsPublisher);
        router.setManager(address(new RootTlMockManager()));
        vm.stopPrank();
    }

    function _submit(uint64 epoch, bytes32 nullifier) internal {
        uint256[24] memory proof;
        uint256[9] memory inp;
        inp[0] = 111;
        inp[1] = uint256(uint160(coin));
        inp[2] = 222;
        inp[3] = epoch;
        inp[4] = uint256(ALLOW_ROOT);
        inp[5] = 1_000_000;
        inp[6] = uint256(LEDGER_ROOT);
        inp[7] = uint256(nullifier);
        inp[8] = uint160(buyer);
        router.submitAmoeEntryZK(buyer, coin, epoch, proof, inp);
    }

    function test_submitAmoeEntryZK_rejectsImmatureRoots_thenSucceedsAfterMaturity() public {
        vm.prank(publisher);
        router.setAllowlistRoot(EPOCH, ALLOW_ROOT);
        vm.prank(pointsPublisher);
        router.setPointsLedgerRoot(EPOCH, LEDGER_ROOT);

        uint256 effectiveAt = router.allowlistRootEffectiveAt(EPOCH);
        assertEq(effectiveAt, router.pointsLedgerRootEffectiveAt(EPOCH));
        assertGt(effectiveAt, block.timestamp);

        vm.expectRevert(abi.encodeWithSelector(LotteryAmoeRouter.RootTimelockActive.selector, effectiveAt));
        _submit(EPOCH, NULLIFIER);

        vm.warp(effectiveAt);
        _submit(EPOCH, NULLIFIER);
        assertTrue(router.usedPointsBurnNullifier(NULLIFIER));
        assertEq(router.nextEntryId(), 1);
    }

    function test_setAllowlistRoot_storesEffectiveAt() public {
        vm.prank(publisher);
        router.setAllowlistRoot(EPOCH, ALLOW_ROOT);
        assertEq(router.allowlistRootOf(EPOCH), ALLOW_ROOT);
        assertEq(router.allowlistRootEffectiveAt(EPOCH), block.timestamp + router.ROOT_PUBLICATION_TIMELOCK());
    }
}
