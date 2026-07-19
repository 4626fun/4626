// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {LotteryAmoeRouter, IAmoeManager} from "@4626/shared/lottery/zk/LotteryAmoeRouter.sol";
import {IAmoePlonkVerifier} from "@4626/shared/lottery/zk/IAmoePlonkVerifier.sol";

contract ScanM2MockVerifier is IAmoePlonkVerifier {
    function verifyProof(uint256[24] calldata, uint256[9] calldata) external pure returns (bool) {
        return true;
    }
}

contract ScanM2MockManager is IAmoeManager {
    function processAmoeEntry(address, address, uint256) external pure returns (uint256) {
        return 1;
    }
}

/// @notice SCAN-M2: ZK submit must not burn nullifiers when manager is unset.
contract LotteryAmoeRouterScanM2Test is Test {
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
        // Intentionally leave manager unset — production ZK path requires it.
        router = new LotteryAmoeRouter(owner, publisher, address(new ScanM2MockVerifier()));
        vm.prank(owner);
        router.setPointsLedgerPublisher(pointsPublisher);
        vm.prank(publisher);
        router.setAllowlistRoot(EPOCH, ALLOW_ROOT);
        vm.prank(pointsPublisher);
        router.setPointsLedgerRoot(EPOCH, LEDGER_ROOT);
        // ODA-426-F3: roots mature after ROOT_PUBLICATION_TIMELOCK before ZK use.
        vm.warp(block.timestamp + router.ROOT_PUBLICATION_TIMELOCK());
    }

    function _submit() internal {
        uint256[24] memory proof;
        uint256[9] memory inp;
        inp[0] = 111; // walletCommit
        inp[1] = uint256(uint160(coin));
        inp[2] = 222; // nonceCommit
        inp[3] = EPOCH;
        inp[4] = uint256(ALLOW_ROOT);
        inp[5] = 1_000_000;
        inp[6] = uint256(LEDGER_ROOT);
        inp[7] = uint256(NULLIFIER);
        inp[8] = uint160(buyer);
        router.submitAmoeEntryZK(buyer, coin, EPOCH, proof, inp);
    }

    function test_submitAmoeEntryZK_revertsManagerNotSet_beforeNullifierBurn() public {
        assertEq(address(router.manager()), address(0));

        vm.expectRevert(LotteryAmoeRouter.ManagerNotSet.selector);
        _submit();

        assertFalse(router.usedPointsBurnNullifier(NULLIFIER));
        assertFalse(router.usedNonceCommit(bytes32(uint256(222))));
        assertEq(router.nextEntryId(), 0);
    }

    function test_submitAmoeEntryZK_revertsAfterTimelockedUnset() public {
        ScanM2MockManager managerMock = new ScanM2MockManager();
        vm.prank(owner);
        router.setManager(address(managerMock));

        // Unset is timelocked once a manager has been wired.
        vm.prank(owner);
        router.setManager(address(0));
        vm.warp(block.timestamp + router.CONFIG_UPDATE_TIMELOCK());
        vm.prank(owner);
        router.executeManagerUpdate();
        assertEq(address(router.manager()), address(0));

        vm.expectRevert(LotteryAmoeRouter.ManagerNotSet.selector);
        _submit();
        assertFalse(router.usedPointsBurnNullifier(NULLIFIER));
    }
}
