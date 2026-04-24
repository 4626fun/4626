// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {CreatorOracle} from "../contracts/utilities/oracles/CreatorOracle.sol";

/**
 * @title CreatorOracle — broadcast-fee deprecation regression [M-3][4626-439]
 * @notice Proves the deprecated equal-split broadcast entrypoint now reverts with
 *         `BroadcastEqualSplitDeprecated` and emits the `BroadcastEqualSplitCallAttempted`
 *         migration-signal event, so off-chain tooling that simulates calls (trace /
 *         call-simulation / estimateGas with the `debug_` APIs) surfaces the migration
 *         path to `broadcastCreatorPriceWithFees`.
 */
contract MockRegistryForBroadcastFees {
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

contract CreatorOracleBroadcastFeesTest is Test {
    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    uint32 internal constant HUB_EID = 30184;

    CreatorOracle internal oracle;

    // Redeclare the event so `vm.expectEmit` has a target selector.
    event BroadcastEqualSplitCallAttempted(address indexed caller, uint256 msgValue, uint32[] dstEids);

    function setUp() public {
        vm.warp(1_700_000_000);
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(address(this)));

        MockRegistryForBroadcastFees registry = new MockRegistryForBroadcastFees(LZ_ENDPOINT, HUB_EID);
        oracle = new CreatorOracle(address(registry), address(0), "TEST", address(this));

        // Seed a valid creator price so the legacy entrypoint gets past `creatorPriceUSD <= 0`
        // and we can prove the deprecation revert fires even when everything else is happy.
        oracle.initializeCreatorPrice(int256(1e18));

        // Authorize self as a price updater so we cover the auth-passed path too.
        oracle.setPriceUpdater(address(this), true);
    }

    function test_broadcastCreatorPrice_legacyEntrypoint_revertsWithDeprecation() public {
        uint32[] memory dstEids = new uint32[](3);
        dstEids[0] = 30101;
        dstEids[1] = 30110;
        dstEids[2] = 30184;

        bytes memory options = hex"0003010011010000000000000000000000000007a120";

        // Assert the migration-signal event is emitted with the caller, msg.value, and dstEids.
        vm.expectEmit(true, false, false, true, address(oracle));
        emit BroadcastEqualSplitCallAttempted(address(this), 0.3 ether, dstEids);

        // Assert the call reverts with the dedicated error.
        vm.expectRevert(CreatorOracle.BroadcastEqualSplitDeprecated.selector);
        oracle.broadcastCreatorPrice{value: 0.3 ether}(dstEids, options);
    }

    function test_broadcastCreatorPrice_legacyEntrypoint_revertsEvenWithZeroValue() public {
        uint32[] memory dstEids = new uint32[](1);
        dstEids[0] = 30101;
        bytes memory options = hex"";

        // Zero msg.value must still hit the deprecation revert (not e.g. an earlier
        // divide-by-something or "insufficient fee" from the old body).
        vm.expectEmit(true, false, false, true, address(oracle));
        emit BroadcastEqualSplitCallAttempted(address(this), 0, dstEids);

        vm.expectRevert(CreatorOracle.BroadcastEqualSplitDeprecated.selector);
        oracle.broadcastCreatorPrice(dstEids, options);
    }

    function test_broadcastCreatorPrice_legacyEntrypoint_revertsBeforeAuthCheck() public {
        // The deprecated entrypoint reverts the same way regardless of caller — we
        // deliberately do NOT check auth before emitting + reverting, because the whole
        // point is to signal migration to *anyone* who calls the old selector (including
        // unauthorized dry-run simulations from block explorers and integrators).
        address stranger = address(0xBEEF);
        vm.deal(stranger, 1 ether);

        uint32[] memory dstEids = new uint32[](2);
        dstEids[0] = 30101;
        dstEids[1] = 30110;
        bytes memory options = hex"";

        vm.prank(stranger);
        vm.expectRevert(CreatorOracle.BroadcastEqualSplitDeprecated.selector);
        oracle.broadcastCreatorPrice{value: 0.5 ether}(dstEids, options);
    }

    function test_broadcastCreatorPriceWithFees_isUnaffected() public {
        // Sanity: the correct overload still exists with the same selector it had before.
        // We don't actually LZ-send (no real endpoint), but we verify the selector is live
        // by checking the call fails *past* the deprecation revert (it will revert later
        // on the mocked endpoint, not on BroadcastEqualSplitDeprecated).
        uint32[] memory dstEids = new uint32[](1);
        dstEids[0] = 30101;
        uint256[] memory fees = new uint256[](1);
        fees[0] = 0.05 ether;
        bytes memory options = hex"";

        // Exercise the happy-path selector with a small msg.value; we expect a revert,
        // but critically NOT the deprecation error. Any non-deprecation revert proves
        // the WithFees selector is still the live implementation.
        bool hit = false;
        try oracle.broadcastCreatorPriceWithFees{value: 0.05 ether}(dstEids, options, fees) {
            hit = true;
        } catch (bytes memory err) {
            // If it reverted with our deprecation selector, the wrong function was called.
            bytes4 selector;
            if (err.length >= 4) {
                assembly {
                    selector := mload(add(err, 0x20))
                }
            }
            assertTrue(
                selector != CreatorOracle.BroadcastEqualSplitDeprecated.selector,
                "WithFees overload must not trip deprecation error"
            );
            hit = true;
        }
        assertTrue(hit, "WithFees selector must resolve (success or non-deprecation revert)");
    }
}
