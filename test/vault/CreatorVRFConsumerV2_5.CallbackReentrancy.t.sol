// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {
    CreatorVRFConsumerHarness,
    MockCreatorRegistryForVRF,
    MockEndpointV2,
    MockVRFCoordinatorV2Plus
} from "test/vault/CreatorVRFConsumerV2_5.RelayFunding.t.sol";

contract ReentrantLocalVrfRequester {
    CreatorVRFConsumerHarness public immutable consumer;
    uint256 public callbackCount;
    bool public reentryCallSucceeded;
    bytes public reentryReturnData;

    constructor(CreatorVRFConsumerHarness consumer_) {
        consumer = consumer_;
    }

    function request() external returns (uint256 requestId) {
        requestId = consumer.requestRandomWords();
    }

    function receiveRandomWords(uint256 requestId, uint256[] memory randomWords) external {
        callbackCount++;
        (reentryCallSucceeded, reentryReturnData) = address(consumer)
            .call(abi.encodeWithSelector(consumer.rawFulfillRandomWords.selector, requestId, randomWords));
    }
}

contract CreatorVRFConsumerV25CallbackReentrancyTest is Test {
    uint32 internal constant BASE_EID = 30184;

    CreatorVRFConsumerHarness internal consumer;
    MockVRFCoordinatorV2Plus internal coordinator;
    ReentrantLocalVrfRequester internal requester;

    function setUp() external {
        MockEndpointV2 endpoint = new MockEndpointV2();
        MockCreatorRegistryForVRF registry = new MockCreatorRegistryForVRF(address(endpoint), BASE_EID);
        coordinator = new MockVRFCoordinatorV2Plus();

        consumer = new CreatorVRFConsumerHarness(address(registry), address(this));
        consumer.setVRFCoordinator(address(coordinator));
        consumer.setVRFConfig(1, bytes32(uint256(0xAA)), 40000, 3);

        requester = new ReentrantLocalVrfRequester(consumer);
        consumer.setLocalCallerAuthorization(address(requester), true);
    }

    function test_localCallbackCannotReenterFulfillment() external {
        uint256 requestId = requester.request();

        uint256[] memory words = new uint256[](1);
        words[0] = 123456;

        vm.prank(address(coordinator));
        consumer.rawFulfillRandomWords(requestId, words);

        assertEq(requester.callbackCount(), 1, "callback should run once");
        assertFalse(requester.reentryCallSucceeded(), "reentrant raw fulfill must fail");

        (,,,,, uint256 randomWord, bool fulfilled,, bool callbackSent,) = consumer.vrfRequests(requestId);
        assertTrue(fulfilled, "request should be fulfilled before callback reentry");
        assertTrue(callbackSent, "callback should be marked sent after successful callback");
        assertEq(randomWord, words[0], "random word should not be overwritten");
    }
}
