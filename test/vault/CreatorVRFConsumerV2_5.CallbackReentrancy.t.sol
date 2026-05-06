// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {
    CreatorVRFConsumerHarness,
    MockCreatorRegistryForVRF,
    MockEndpointV2,
    MockVRFCoordinatorV2Plus
} from "test/vault/CreatorVRFConsumerV2_5.RelayFunding.t.sol";

contract ReentrantVRFCoordinator is MockVRFCoordinatorV2Plus {
    uint256 public fulfillAttempts;
    bool public lastFulfillSucceeded;
    bytes public lastFulfillReturnData;

    function fulfill(CreatorVRFConsumerHarness consumer, uint256 requestId, uint256[] memory randomWords) external {
        fulfillAttempts++;
        consumer.rawFulfillRandomWords(requestId, randomWords);
    }

    function tryFulfill(CreatorVRFConsumerHarness consumer, uint256 requestId, uint256[] memory randomWords)
        external
        returns (bool ok, bytes memory returnData)
    {
        fulfillAttempts++;
        (ok, returnData) = address(consumer)
            .call(abi.encodeWithSelector(consumer.rawFulfillRandomWords.selector, requestId, randomWords));
        lastFulfillSucceeded = ok;
        lastFulfillReturnData = returnData;
    }
}

contract ReentrantLocalVrfRequester {
    CreatorVRFConsumerHarness public immutable consumer;
    ReentrantVRFCoordinator public immutable coordinator;
    uint256 public callbackCount;
    bool public reentryCallSucceeded;
    bytes public reentryReturnData;

    constructor(CreatorVRFConsumerHarness consumer_, ReentrantVRFCoordinator coordinator_) {
        consumer = consumer_;
        coordinator = coordinator_;
    }

    function request() external returns (uint256 requestId) {
        requestId = consumer.requestRandomWords();
    }

    function receiveRandomWords(uint256 requestId, uint256[] memory randomWords) external {
        callbackCount++;
        (bool coordinatorCallSucceeded, bytes memory coordinatorReturnData) = address(coordinator)
            .call(abi.encodeWithSelector(coordinator.tryFulfill.selector, consumer, requestId, randomWords));
        require(coordinatorCallSucceeded, "coordinator reentry wrapper failed");
        (reentryCallSucceeded, reentryReturnData) = abi.decode(coordinatorReturnData, (bool, bytes));
    }
}

contract CreatorVRFConsumerV25CallbackReentrancyTest is Test {
    uint32 internal constant BASE_EID = 30184;

    CreatorVRFConsumerHarness internal consumer;
    ReentrantVRFCoordinator internal coordinator;
    ReentrantLocalVrfRequester internal requester;

    function setUp() external {
        MockEndpointV2 endpoint = new MockEndpointV2();
        MockCreatorRegistryForVRF registry = new MockCreatorRegistryForVRF(address(endpoint), BASE_EID);
        coordinator = new ReentrantVRFCoordinator();

        consumer = new CreatorVRFConsumerHarness(address(registry), address(this));
        consumer.setVRFCoordinator(address(coordinator));
        consumer.setVRFConfig(1, bytes32(uint256(0xAA)), 40000, 3);

        requester = new ReentrantLocalVrfRequester(consumer, coordinator);
        consumer.setLocalCallerAuthorization(address(requester), true);
    }

    function test_localCallbackCannotReenterFulfillment() external {
        uint256 requestId = requester.request();

        uint256[] memory words = new uint256[](1);
        words[0] = 123456;

        coordinator.fulfill(consumer, requestId, words);

        assertEq(requester.callbackCount(), 1, "callback should run once");
        assertFalse(requester.reentryCallSucceeded(), "reentrant raw fulfill must fail");
        assertEq(coordinator.fulfillAttempts(), 2, "callback should attempt reentry through coordinator");
        assertFalse(coordinator.lastFulfillSucceeded(), "coordinator reentry must hit fulfilled guard");

        (,,,,, uint256 randomWord, bool fulfilled,, bool callbackSent,) = consumer.vrfRequests(requestId);
        assertTrue(fulfilled, "request should be fulfilled before callback reentry");
        assertTrue(callbackSent, "callback should be marked sent after successful callback");
        assertEq(randomWord, words[0], "random word should not be overwritten");
    }
}
