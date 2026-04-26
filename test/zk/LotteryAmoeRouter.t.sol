// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {LotteryAmoeRouter, ILotteryAmoeConsumer} from "contracts/utilities/lottery/zk/LotteryAmoeRouter.sol";
import {IAmoeGroth16Verifier} from "contracts/utilities/lottery/zk/IAmoeGroth16Verifier.sol";

/// @notice Stub verifier that returns whatever flag it's configured with. The
///         router's responsibility is the public-input binding + replay guards;
///         the cryptographic correctness of the proof is tested in the circuit
///         integration tests (`circuits/amoe/test`).
contract MockVerifier is IAmoeGroth16Verifier {
    bool public ok = true;
    function setOk(bool v) external { ok = v; }
    function verifyProof(
        uint256[2] calldata,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[5] calldata
    ) external view returns (bool) { return ok; }
}

/// @notice Stub consumer to confirm the router fans out correctly.
contract MockConsumer is ILotteryAmoeConsumer {
    event Recorded(address buyer, address coin, uint64 epoch, uint256 entryId);
    function recordAmoeEntry(address buyer, address coin, uint64 epoch, uint256 entryId) external {
        emit Recorded(buyer, coin, epoch, entryId);
    }
}

contract LotteryAmoeRouterTest is Test {
    LotteryAmoeRouter router;
    MockVerifier verifier;
    MockConsumer consumer;

    address owner = address(0xAA);
    address publisher = address(0xBB);
    address buyer = address(0xCAFE);
    address coin = address(0xC0FFEE);

    uint64 constant EPOCH = 42;
    bytes32 constant ROOT = bytes32(uint256(0x1234));

    function setUp() public {
        verifier = new MockVerifier();
        consumer = new MockConsumer();
        router = new LotteryAmoeRouter(owner, publisher, address(verifier));
        vm.prank(owner);
        router.setConsumer(address(consumer));
        vm.prank(publisher);
        router.setAllowlistRoot(EPOCH, ROOT);
    }

    function _proof()
        internal
        pure
        returns (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c)
    {
        a = [uint256(1), uint256(2)];
        b = [[uint256(3), uint256(4)], [uint256(5), uint256(6)]];
        c = [uint256(7), uint256(8)];
    }

    function _pubInputs(uint256 walletCommit, uint256 nonceCommit)
        internal
        pure
        returns (uint256[5] memory)
    {
        uint256[5] memory inp;
        inp[0] = walletCommit;
        inp[1] = uint256(uint160(0xC0FFEE));
        inp[2] = nonceCommit;
        inp[3] = uint256(EPOCH);
        inp[4] = uint256(ROOT);
        return inp;
    }

    function test_submitAmoeEntryZK_happyPath() public {
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c) = _proof();
        uint256 id = router.submitAmoeEntryZK(buyer, coin, EPOCH, a, b, c, _pubInputs(111, 222));
        assertEq(id, 1);
        assertTrue(router.usedNonceCommit(bytes32(uint256(222))));
        assertTrue(router.usedWalletCommit(EPOCH, bytes32(uint256(111))));
    }

    function test_submitAmoeEntryZK_rejectsRootMismatch() public {
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c) = _proof();
        uint256[5] memory inp = _pubInputs(111, 222);
        inp[4] = uint256(bytes32(uint256(0xDEAD))); // wrong root
        vm.expectRevert(LotteryAmoeRouter.RootMismatch.selector);
        router.submitAmoeEntryZK(buyer, coin, EPOCH, a, b, c, inp);
    }

    function test_submitAmoeEntryZK_rejectsCoinMismatch() public {
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c) = _proof();
        uint256[5] memory inp = _pubInputs(111, 222);
        inp[1] = uint256(uint160(address(0xBADC0DE))); // wrong coin
        vm.expectRevert(LotteryAmoeRouter.InvalidProof.selector);
        router.submitAmoeEntryZK(buyer, coin, EPOCH, a, b, c, inp);
    }

    function test_submitAmoeEntryZK_rejectsNonceReplay() public {
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c) = _proof();
        router.submitAmoeEntryZK(buyer, coin, EPOCH, a, b, c, _pubInputs(111, 222));
        // Different walletCommit but same nonceCommit must still revert.
        vm.expectRevert(LotteryAmoeRouter.NonceReplayed.selector);
        router.submitAmoeEntryZK(buyer, coin, EPOCH, a, b, c, _pubInputs(999, 222));
    }

    function test_submitAmoeEntryZK_rejectsTwitterCreditReplay() public {
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c) = _proof();
        router.submitAmoeEntryZK(buyer, coin, EPOCH, a, b, c, _pubInputs(111, 222));
        // Same walletCommit (= same twitter credit) with a fresh nonce must revert.
        vm.expectRevert(LotteryAmoeRouter.WalletCreditReplayed.selector);
        router.submitAmoeEntryZK(buyer, coin, EPOCH, a, b, c, _pubInputs(111, 333));
    }

    function test_submitAmoeEntryZK_rejectsBadProof() public {
        verifier.setOk(false);
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c) = _proof();
        vm.expectRevert(LotteryAmoeRouter.InvalidProof.selector);
        router.submitAmoeEntryZK(buyer, coin, EPOCH, a, b, c, _pubInputs(111, 222));
    }

    function test_setAllowlistRoot_onlyPublisher() public {
        vm.expectRevert(LotteryAmoeRouter.NotPublisher.selector);
        router.setAllowlistRoot(99, bytes32(uint256(1)));
    }

    function test_setAllowlistRoot_oneShot() public {
        vm.prank(publisher);
        vm.expectRevert(LotteryAmoeRouter.EpochAlreadyPublished.selector);
        router.setAllowlistRoot(EPOCH, bytes32(uint256(2)));
    }
}
