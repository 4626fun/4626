// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";

// Reuse the existing hub harness + mocks to avoid duplicate mock contract names.
import {
    CreatorVRFConsumerHarness,
    MockVRFCoordinatorV2Plus,
    MockCreatorRegistryForVRF,
    MockEndpointV2
} from "test/vault/CreatorVRFConsumerV2_5.RelayFunding.t.sol";

contract CreatorVRFConsumerV25SequenceScopingTest is Test {
    uint32 internal constant BASE_EID = 30184;

    uint32 internal constant REMOTE_EID_A = 30110;
    uint32 internal constant REMOTE_EID_B = 30111;
    uint32 internal constant REMOTE_GAS_LIMIT = 200_000;

    bytes32 internal constant REMOTE_PEER_A = bytes32(uint256(0xA11CE));
    bytes32 internal constant REMOTE_PEER_B = bytes32(uint256(0xB0B));

    CreatorVRFConsumerHarness internal consumer;
    MockVRFCoordinatorV2Plus internal coordinator;

    function setUp() external {
        MockEndpointV2 endpoint = new MockEndpointV2();
        MockCreatorRegistryForVRF registry = new MockCreatorRegistryForVRF(address(endpoint), BASE_EID);
        coordinator = new MockVRFCoordinatorV2Plus();

        consumer = new CreatorVRFConsumerHarness(address(registry), address(this));
        consumer.setVRFCoordinator(address(coordinator));
        consumer.setVRFConfig(1, bytes32(uint256(0xAA)), 40000, 3);

        consumer.setSupportedChain(REMOTE_EID_A, true, REMOTE_GAS_LIMIT);
        consumer.setPeer(REMOTE_EID_A, REMOTE_PEER_A);

        consumer.setSupportedChain(REMOTE_EID_B, true, REMOTE_GAS_LIMIT);
        consumer.setPeer(REMOTE_EID_B, REMOTE_PEER_B);
    }

    function test_sequenceIsUniquePerSourceChain() external {
        // Pre-fix: this reverts with DuplicateSequence due to global `sequenceToRequestId`.
        // Post-fix: both requests succeed because uniqueness is scoped by (srcEid, sequence).
        uint64 sequence = 1;

        _submitRemoteRequest(REMOTE_EID_A, REMOTE_PEER_A, sequence);
        _submitRemoteRequest(REMOTE_EID_B, REMOTE_PEER_B, sequence);

        (, uint32 src1,,,,,,,,) = consumer.vrfRequests(1);
        (, uint32 src2,,,,,,,,) = consumer.vrfRequests(2);

        assertEq(src1, REMOTE_EID_A);
        assertEq(src2, REMOTE_EID_B);
    }

    function test_duplicateSequenceSameChainIsIdempotent() external {
        // Pre-fix: this reverts with DuplicateSequence.
        // Post-fix: the second delivery is treated as a no-op (no revert, no VRF spend).
        uint64 sequence = 42;

        _submitRemoteRequest(REMOTE_EID_A, REMOTE_PEER_A, sequence);
        uint256 nextRequestIdAfterFirst = coordinator.nextRequestId();

        _submitRemoteRequest(REMOTE_EID_A, REMOTE_PEER_A, sequence);
        assertEq(coordinator.nextRequestId(), nextRequestIdAfterFirst);
    }

    function _submitRemoteRequest(uint32 srcEid, bytes32 sender, uint64 sequence) internal {
        Origin memory origin = Origin({srcEid: srcEid, sender: sender, nonce: 1});
        consumer.exposedLzReceive(origin, abi.encode(sequence), hex"");
    }
}

