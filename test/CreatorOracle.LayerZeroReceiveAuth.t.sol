// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {CreatorOracle} from "../contracts/services/oracles/CreatorOracle.sol";
import {Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";

contract MockRegistryForOracleLzReceiveAuth {
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

contract CreatorOracleLayerZeroReceiveAuthTest is Test {
    uint32 internal constant HUB_EID = 30184;
    uint32 internal constant REMOTE_EID = 40231; // arbitrary non-hub EID

    // LayerZero Endpoint (address is irrelevant; we mock its calls)
    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    bytes4 internal constant INVALID_ORIGIN_EID_SELECTOR = bytes4(keccak256("InvalidOriginEid(uint32)"));
    bytes4 internal constant ONLY_PEER_SELECTOR = bytes4(keccak256("OnlyPeer(uint32,bytes32)"));

    address internal owner = address(0xA11CE);

    bytes32 internal constant HUB_PEER = bytes32(uint256(uint160(address(0xBEEF))));
    bytes32 internal constant REMOTE_PEER = bytes32(uint256(uint160(address(0xCAFE))));

    CreatorOracle internal oracle;

    function setUp() public {
        // OAppCore constructor calls endpoint.setDelegate(delegate); we must mock it.
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(owner));

        MockRegistryForOracleLzReceiveAuth registry = new MockRegistryForOracleLzReceiveAuth(LZ_ENDPOINT, HUB_EID);
        oracle = new CreatorOracle(address(registry), address(0), "TEST", owner);

        vm.startPrank(owner);
        oracle.setPeer(HUB_EID, HUB_PEER);
        oracle.setPeer(REMOTE_EID, REMOTE_PEER);
        vm.stopPrank();
    }

    function test_LzReceive_HubEidUpdatesPrice() public {
        Origin memory origin = Origin({srcEid: HUB_EID, sender: HUB_PEER, nonce: 1});
        bytes memory payload = abi.encode(int256(2e18), uint256(block.timestamp), string("TEST"));

        vm.prank(LZ_ENDPOINT);
        oracle.lzReceive(origin, bytes32(0), payload, address(0), "");

        assertEq(oracle.creatorPriceUSD(), 2e18);
    }

    function test_LzReceive_HubEidNonPeerSenderReverts() public {
        bytes32 notPeer = bytes32(uint256(uint160(address(0xDEAD))));
        Origin memory origin = Origin({srcEid: HUB_EID, sender: notPeer, nonce: 1});
        bytes memory payload = abi.encode(int256(2e18), uint256(block.timestamp), string("TEST"));

        vm.expectRevert(abi.encodeWithSelector(ONLY_PEER_SELECTOR, HUB_EID, notPeer));
        vm.prank(LZ_ENDPOINT);
        oracle.lzReceive(origin, bytes32(0), payload, address(0), "");
    }

    function test_LzReceive_NonHubEidRevertsEvenWithValidPeer() public {
        Origin memory origin = Origin({srcEid: REMOTE_EID, sender: REMOTE_PEER, nonce: 1});
        bytes memory payload = abi.encode(int256(2e18), uint256(block.timestamp), string("TEST"));

        vm.expectRevert(abi.encodeWithSelector(INVALID_ORIGIN_EID_SELECTOR, REMOTE_EID));
        vm.prank(LZ_ENDPOINT);
        oracle.lzReceive(origin, bytes32(0), payload, address(0), "");
    }

    function test_LzReceive_IgnoresOlderTimestampRollback() public {
        vm.warp(1_700_000_000);

        Origin memory origin = Origin({srcEid: HUB_EID, sender: HUB_PEER, nonce: 1});

        uint256 t1 = block.timestamp;
        bytes memory payload1 = abi.encode(int256(2e18), t1, string("TEST"));
        vm.prank(LZ_ENDPOINT);
        oracle.lzReceive(origin, bytes32(0), payload1, address(0), "");

        assertEq(oracle.creatorPriceUSD(), 2e18);
        assertEq(oracle.creatorPriceTimestamp(), t1);

        // Attempt to roll back with an older timestamp; should be ignored.
        uint256 t0 = t1 - 1;
        bytes memory payload0 = abi.encode(int256(3e18), t0, string("TEST"));
        vm.prank(LZ_ENDPOINT);
        oracle.lzReceive(origin, bytes32(0), payload0, address(0), "");

        assertEq(oracle.creatorPriceUSD(), 2e18, "older update should not overwrite price");
        assertEq(oracle.creatorPriceTimestamp(), t1, "older update should not overwrite timestamp");
    }

    function test_LzReceive_ClampsFutureTimestampToNow() public {
        uint256 nowTs = block.timestamp;
        uint256 future = nowTs + 1 days;

        Origin memory origin = Origin({srcEid: HUB_EID, sender: HUB_PEER, nonce: 1});
        bytes memory payload = abi.encode(int256(3e18), uint256(future), string("TEST"));

        vm.prank(LZ_ENDPOINT);
        oracle.lzReceive(origin, bytes32(0), payload, address(0), "");

        assertEq(oracle.creatorPriceTimestamp(), nowTs, "timestamp should be clamped to now");

        // Ensure the freshness path stays non-reverting (future timestamps can underflow).
        (int256 price, uint256 ts) = oracle.getCreatorPrice();
        assertEq(price, 3e18);
        assertEq(ts, nowTs);
    }
}

