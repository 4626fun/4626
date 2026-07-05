// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CreatorShareOFT} from "../contracts/utilities/messaging/CreatorShareOFT.sol";

contract MockFlushRegistry {
    function getLayerZeroEndpoint(uint256) external pure returns (address) {
        return 0x1a44076050125825900e736c501f859c50fE728c;
    }

    function getEidForChainId(uint256) external pure returns (uint32) {
        return 30_184;
    }
}

contract CreatorShareOFTFeeFlushCommandTest is Test {
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

    function test_requestRemoteFeeFlush_revertsWhenNotHub() external {
        vm.prank(OWNER);
        oft.setHubConfig(false, 30_184, address(0x1234));

        vm.expectRevert(CreatorShareOFT.NotHub.selector);
        oft.requestRemoteFeeFlush{value: 1}(30_110, 0);
    }

    function test_requestRemoteFeeFlush_revertsWhenPeerUnset() external {
        vm.prank(OWNER);
        oft.setHubConfig(true, 30_184, address(this));

        vm.expectRevert(CreatorShareOFT.PeerNotConfigured.selector);
        oft.requestRemoteFeeFlush{value: 1}(30_110, 0);
    }

    function test_remoteFlushCommandGasLimit_defaults() external view {
        assertEq(oft.remoteFlushCommandGasLimit(), oft.DEFAULT_REMOTE_FLUSH_COMMAND_GAS());
    }

    function test_remoteFlushCommandGasLimit_updates() external {
        vm.prank(OWNER);
        oft.setRemoteFlushCommandGasLimit(400_000);
        assertEq(oft.remoteFlushCommandGasLimit(), 400_000);
    }

    function test_remoteFlushCommandGasLimit_revertsWhenOutOfBounds() external {
        vm.startPrank(OWNER);
        vm.expectRevert(bytes("Invalid flush command gas"));
        oft.setRemoteFlushCommandGasLimit(100_000);
        vm.expectRevert(bytes("Invalid flush command gas"));
        oft.setRemoteFlushCommandGasLimit(2_000_000);
        vm.stopPrank();
    }
}
