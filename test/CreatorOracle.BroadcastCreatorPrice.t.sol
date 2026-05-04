// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {CreatorOracle} from "../contracts/utilities/oracles/CreatorOracle.sol";

import {
    MessagingParams,
    MessagingReceipt,
    MessagingFee
} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";

contract MockLayerZeroEndpointForCreatorOracleBroadcast {
    address public delegate;

    uint256 public sendCount;
    uint32[] public sentDstEids;
    uint256[] public sentValues;
    address[] public sentRefundAddresses;

    function setDelegate(address _delegate) external {
        delegate = _delegate;
    }

    function send(MessagingParams calldata _params, address _refundAddress)
        external
        payable
        returns (MessagingReceipt memory receipt)
    {
        sentDstEids.push(_params.dstEid);
        sentValues.push(msg.value);
        sentRefundAddresses.push(_refundAddress);
        sendCount++;

        // Return a minimal receipt; tests only assert that `send` was called with the expected msg.value.
        receipt = MessagingReceipt({
            guid: bytes32(uint256(sendCount)),
            nonce: uint64(sendCount),
            fee: MessagingFee({nativeFee: msg.value, lzTokenFee: 0})
        });
    }
}

contract MockRegistryForCreatorOracleBroadcast {
    address public immutable endpoint;
    uint32 public immutable hubEid;

    constructor(address _endpoint, uint32 _hubEid) {
        endpoint = _endpoint;
        hubEid = _hubEid;
    }

    function getLayerZeroEndpoint(uint256) external view returns (address) {
        return endpoint;
    }

    function hubChainEid() external view returns (uint32) {
        return hubEid;
    }
}

contract CreatorOracleBroadcastCreatorPriceTest is Test {
    uint32 internal constant HUB_EID = 30184;

    CreatorOracle internal oracle;
    MockLayerZeroEndpointForCreatorOracleBroadcast internal endpoint;

    function setUp() public {
        endpoint = new MockLayerZeroEndpointForCreatorOracleBroadcast();
        MockRegistryForCreatorOracleBroadcast registry = new MockRegistryForCreatorOracleBroadcast(address(endpoint), HUB_EID);

        oracle = new CreatorOracle(address(registry), address(0), "TEST", address(this));

        // Configure peers so `_lzSend` can resolve receiver addresses.
        oracle.setPeer(111, bytes32(uint256(uint160(address(0x1111)))));
        oracle.setPeer(222, bytes32(uint256(uint160(address(0x2222)))));
        oracle.setPeer(333, bytes32(uint256(uint160(address(0x3333)))));

        oracle.initializeCreatorPrice(int256(2e18));
    }

    function test_BroadcastCreatorPrice_MultiSend_UsesDivisibleSplit() public {
        uint32[] memory dstEids = new uint32[](3);
        dstEids[0] = 111;
        dstEids[1] = 222;
        dstEids[2] = 333;

        vm.expectRevert(CreatorOracle.BroadcastEqualSplitDeprecated.selector);
        oracle.broadcastCreatorPrice{value: 9}(dstEids, "");
    }

    function test_BroadcastCreatorPrice_RefundsRemainderWhenFeeNotDivisible() public {
        uint32[] memory dstEids = new uint32[](3);
        dstEids[0] = 111;
        dstEids[1] = 222;
        dstEids[2] = 333;

        vm.expectRevert(CreatorOracle.BroadcastEqualSplitDeprecated.selector);
        oracle.broadcastCreatorPrice{value: 10}(dstEids, "");
    }

    receive() external payable {}

    function test_BroadcastCreatorPrice_RevertsWhenNoDestinations() public {
        uint32[] memory dstEids = new uint32[](0);
        vm.expectRevert(CreatorOracle.BroadcastEqualSplitDeprecated.selector);
        oracle.broadcastCreatorPrice{value: 0}(dstEids, "");
    }
}

