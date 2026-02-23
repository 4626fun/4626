// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {
    CreatorVRFConsumerV2_5,
    IVRFCoordinatorV2Plus,
    RandomWordsRequest
} from "../../contracts/services/lottery/vrf/CreatorVRFConsumerV2_5.sol";
import {MessagingFee, Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {MessagingReceipt} from "@layerzerolabs/oapp-evm/contracts/oapp/OAppSender.sol";

contract MockEndpointV2 {
    address public delegate;

    function setDelegate(address _delegate) external {
        delegate = _delegate;
    }
}

contract MockCreatorRegistryForVRF {
    address public immutable endpoint;
    uint32 public immutable eid;

    constructor(address _endpoint, uint32 _eid) {
        endpoint = _endpoint;
        eid = _eid;
    }

    function getLayerZeroEndpoint(uint256) external view returns (address) {
        return endpoint;
    }

    function getEidForChainId(uint256) external view returns (uint32) {
        return eid;
    }

    function getSupportedChains() external pure returns (uint256[] memory chains) {
        chains = new uint256[](0);
    }
}

contract MockVRFCoordinatorV2Plus is IVRFCoordinatorV2Plus {
    uint256 public nextRequestId = 1;

    function requestRandomWords(RandomWordsRequest calldata) external returns (uint256 requestId) {
        requestId = nextRequestId;
        nextRequestId++;
    }
}

contract CreatorVRFConsumerHarness is CreatorVRFConsumerV2_5 {
    uint256 public mockNativeFee = 0.01 ether;
    uint256 public lzSendCount;
    uint32 public lastDstEid;
    uint256 public lastMsgValue;

    constructor(address _registry, address _owner) CreatorVRFConsumerV2_5(_registry, _owner) {}

    function setMockNativeFee(uint256 _fee) external {
        mockNativeFee = _fee;
    }

    function exposedLzReceive(Origin calldata origin, bytes calldata message_, bytes calldata composeMsg) external {
        _lzReceive(origin, bytes32(0), message_, address(0), composeMsg);
    }

    function _quote(uint32, bytes memory, bytes memory, bool) internal view override returns (MessagingFee memory fee) {
        fee = MessagingFee({nativeFee: mockNativeFee, lzTokenFee: 0});
    }

    function _lzSend(uint32 _dstEid, bytes memory, bytes memory, MessagingFee memory _fee, address)
        internal
        override
        returns (MessagingReceipt memory receipt)
    {
        lzSendCount += 1;
        lastDstEid = _dstEid;
        lastMsgValue = msg.value;
        receipt = MessagingReceipt({guid: bytes32(lzSendCount), nonce: uint64(lzSendCount), fee: _fee});
    }
}

contract CreatorVRFConsumerV25RelayFundingTest is Test {
    uint32 internal constant BASE_EID = 30184;
    uint32 internal constant REMOTE_EID = 30110;
    uint32 internal constant REMOTE_GAS_LIMIT = 200_000;

    bytes32 internal remotePeer = bytes32(uint256(0xBEEF));

    CreatorVRFConsumerHarness internal consumer;
    MockVRFCoordinatorV2Plus internal coordinator;

    address internal relayer = address(0x1234);
    address internal attacker = address(0x9999);

    function setUp() external {
        MockEndpointV2 endpoint = new MockEndpointV2();
        MockCreatorRegistryForVRF registry = new MockCreatorRegistryForVRF(address(endpoint), BASE_EID);
        coordinator = new MockVRFCoordinatorV2Plus();

        consumer = new CreatorVRFConsumerHarness(address(registry), address(this));
        consumer.setVRFCoordinator(address(coordinator));
        consumer.setVRFConfig(1, bytes32(uint256(0xAA)), 40000, 3);
        consumer.setSupportedChain(REMOTE_EID, true, REMOTE_GAS_LIMIT);
        consumer.setPeer(REMOTE_EID, remotePeer);
        consumer.setMockNativeFee(0.02 ether);

        vm.deal(relayer, 10 ether);
        vm.deal(attacker, 10 ether);
    }

    function test_remoteFulfillmentQueuesPendingWithoutAutoSend() external {
        uint64 sequence = 1;
        _submitRemoteRequest(sequence);
        _fulfillRequest(1, 123);

        assertTrue(consumer.pendingResponses(REMOTE_EID, sequence));
        assertEq(consumer.lzSendCount(), 0);

        (, bool pending, bool fulfilled, bool responseSent,,) = consumer.getPendingResponseStatus(REMOTE_EID, sequence);
        assertTrue(pending);
        assertTrue(fulfilled);
        assertFalse(responseSent);
    }

    function test_relayPendingResponseRequiresAuthorizedRelayerAndExactFee() external {
        uint64 sequence = 7;
        _submitRemoteRequest(sequence);
        _fulfillRequest(1, 777);

        (uint256 expectedFee, bool relayable) = consumer.quotePendingResponseFee(REMOTE_EID, sequence);
        assertTrue(relayable);
        assertGt(expectedFee, 0);

        vm.expectRevert(CreatorVRFConsumerV2_5.UnauthorizedRelayer.selector);
        vm.prank(attacker);
        consumer.relayPendingResponse{value: expectedFee}(REMOTE_EID, sequence);

        consumer.setRelayerAuthorization(relayer, true);

        vm.expectRevert(
            abi.encodeWithSelector(CreatorVRFConsumerV2_5.RelayFeeMismatch.selector, expectedFee - 1, expectedFee)
        );
        vm.prank(relayer);
        consumer.relayPendingResponse{value: expectedFee - 1}(REMOTE_EID, sequence);

        vm.prank(relayer);
        consumer.relayPendingResponse{value: expectedFee}(REMOTE_EID, sequence);

        assertEq(consumer.lzSendCount(), 1);
        assertEq(consumer.lastDstEid(), REMOTE_EID);
        assertEq(consumer.lastMsgValue(), expectedFee);
        assertFalse(consumer.pendingResponses(REMOTE_EID, sequence));

        (,, bool fulfilled, bool responseSent,,) = consumer.getPendingResponseStatus(REMOTE_EID, sequence);
        assertTrue(fulfilled);
        assertTrue(responseSent);
    }

    function test_rateLimitRejectsExcessRemoteRequests() external {
        consumer.setRateLimitDefaults(60, 1, true);

        _submitRemoteRequest(100);
        assertEq(consumer.sequenceToRequestId(REMOTE_EID, 100), 1);

        _submitRemoteRequest(101);
        assertEq(consumer.sequenceToRequestId(REMOTE_EID, 101), 0);
    }

    function _submitRemoteRequest(uint64 sequence) internal {
        Origin memory origin = Origin({srcEid: REMOTE_EID, sender: remotePeer, nonce: 1});
        consumer.exposedLzReceive(origin, abi.encode(sequence), hex"");
    }

    function _fulfillRequest(uint256 requestId, uint256 randomWord) internal {
        uint256[] memory words = new uint256[](1);
        words[0] = randomWord;
        vm.prank(address(coordinator));
        consumer.rawFulfillRandomWords(requestId, words);
    }
}
