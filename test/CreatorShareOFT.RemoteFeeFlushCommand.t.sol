// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {stdStorage, StdStorage} from "forge-std/StdStorage.sol";
import {CreatorShareOFT} from "@4626/creator/vault/CreatorShareOFT.sol";
import {SendParam, MessagingFee} from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";

contract MockFlushRegistry {
    function getLayerZeroEndpoint(uint256) external pure returns (address) {
        return 0x1a44076050125825900e736c501f859c50fE728c;
    }

    function getEidForChainId(uint256) external pure returns (uint32) {
        return 30_184;
    }
}

contract CreatorShareOFTDirectSpokeFeeFlushTest is Test {
    using stdStorage for StdStorage;

    address internal constant OWNER = address(0xA11CE);
    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    MockFlushRegistry internal registry;
    CreatorShareOFT internal oft;

    function setUp() external {
        registry = new MockFlushRegistry();
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(OWNER));

        vm.prank(OWNER);
        oft = new CreatorShareOFT("Test Shares", unicode"■TEST", address(registry), OWNER);
    }

    function test_flushFees_revertsWhenHub() external {
        vm.prank(OWNER);
        oft.setHubConfig(true, 0, address(0));

        vm.expectRevert(CreatorShareOFT.NotHub.selector);
        oft.flushFees(_emptySendParam(), MessagingFee({nativeFee: 0, lzTokenFee: 0}));
    }

    function test_flushFees_revertsWhenRemoteHasNothingPending() external {
        vm.prank(OWNER);
        oft.setHubConfig(false, 30_184, address(0x1234));

        vm.expectRevert(CreatorShareOFT.NothingToFlush.selector);
        oft.flushFees(_emptySendParam(), MessagingFee({nativeFee: 0, lzTokenFee: 0}));
    }

    function test_buildFlushSendParam_usesDirectSpokeRoute() external {
        vm.prank(OWNER);
        oft.setHubConfig(false, 30_184, address(0x1234));

        SendParam memory sendParam = oft.buildFlushSendParam();
        assertEq(sendParam.dstEid, 30_184);
        assertEq(sendParam.to, bytes32(uint256(uint160(address(0x1234)))));
        assertEq(sendParam.amountLD, 0);
        assertEq(sendParam.minAmountLD, 0);
        assertGt(sendParam.extraOptions.length, 0);
    }

    function test_flushFees_revertsWhenComposeMsgNonEmpty() external {
        vm.prank(OWNER);
        oft.setHubConfig(false, 30_184, address(0x1234));
        stdstore.target(address(oft)).sig("pendingFees()").checked_write(uint256(1e18));

        SendParam memory sendParam = oft.buildFlushSendParam();
        sendParam.composeMsg = hex"01";

        vm.expectRevert(bytes("No compose allowed"));
        oft.flushFees(sendParam, MessagingFee({nativeFee: 0, lzTokenFee: 0}));
    }

    function test_renounceOwnership_disabled() external {
        vm.prank(OWNER);
        vm.expectRevert(bytes("RenounceDisabled"));
        oft.renounceOwnership();
    }

    function _emptySendParam() internal pure returns (SendParam memory) {
        return SendParam({
            dstEid: 0,
            to: bytes32(0),
            amountLD: 0,
            minAmountLD: 0,
            extraOptions: "",
            composeMsg: "",
            oftCmd: ""
        });
    }
}
