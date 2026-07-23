// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {
    ChainlinkVRFAdapter,
    IChainlinkVRFConsumerLike
} from "@4626/shared/lottery/randomness/ChainlinkVRFAdapter.sol";

contract MockVrfConsumerAdapterAuth is IChainlinkVRFConsumerLike {
    uint256 public nextId = 1;
    uint256 public requestCount;

    function requestRandomWords() external returns (uint256 requestId) {
        requestCount += 1;
        requestId = nextId;
        nextId += 1;
    }

    function getRequestStatus(uint256)
        external
        pure
        returns (address, bool, bool, uint256, uint256)
    {
        return (address(0), false, false, 0, 0);
    }
}

contract ChainlinkVRFAdapterRequesterAuthTest is Test {
    ChainlinkVRFAdapter internal adapter;
    MockVrfConsumerAdapterAuth internal consumer;
    address internal owner = address(this);
    address internal router = address(0xBEEF);
    address internal attacker = address(0xBAD);

    function setUp() public {
        consumer = new MockVrfConsumerAdapterAuth();
        adapter = new ChainlinkVRFAdapter(IChainlinkVRFConsumerLike(address(consumer)), owner);
        adapter.setRequester(router);
    }

    function test_nonRouter_request_reverts() public {
        vm.prank(attacker);
        vm.expectRevert(ChainlinkVRFAdapter.UnauthorizedRequester.selector);
        adapter.request();
        assertEq(consumer.requestCount(), 0);
    }

    function test_router_request_ok() public {
        vm.prank(router);
        uint256 id = adapter.request();
        assertEq(id, 1);
        assertEq(consumer.requestCount(), 1);
    }
}
