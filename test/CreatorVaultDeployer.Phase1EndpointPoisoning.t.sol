// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {OFTBootstrapRegistry} from "../contracts/helpers/infra/OFTBootstrapRegistry.sol";

/**
 * @notice Regression coverage for the endpoint-poisoning class of issues.
 * @dev `OFTBootstrapRegistry` is intentionally write-free: it always returns the
 *      canonical LayerZero EndpointV2 address and exposes no setter.
 */
contract OFTBootstrapRegistryEndpointPoisoningTest is Test {
    function test_getLayerZeroEndpoint_ReturnsCanonicalEndpoint() public {
        OFTBootstrapRegistry bootstrap = new OFTBootstrapRegistry();

        assertEq(
            bootstrap.getLayerZeroEndpoint(uint16(block.chainid)),
            bootstrap.LZ_COMMON_ENDPOINT(),
            "bootstrap should always return canonical endpoint"
        );
    }

    function test_setLayerZeroEndpoint_DoesNotExist() public {
        OFTBootstrapRegistry bootstrap = new OFTBootstrapRegistry();

        // If a mutable setter exists, this call would succeed and enable endpoint poisoning.
        (bool ok,) = address(bootstrap)
            .call(
                abi.encodeWithSignature("setLayerZeroEndpoint(uint16,address)", uint16(block.chainid), address(0x1234))
            );

        assertFalse(ok, "bootstrap should be write-free (no setter)");
    }
}

