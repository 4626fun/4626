// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {OFTBootstrapRegistry} from "../contracts/helpers/infra/OFTBootstrapRegistry.sol";

contract OFTBootstrapRegistryTest is Test {
    OFTBootstrapRegistry internal registry;

    function setUp() external {
        registry = new OFTBootstrapRegistry();
    }

    function testBaseEndpointAndEid() external view {
        assertEq(registry.getLayerZeroEndpoint(8453), 0x1a44076050125825900e736c501f859c50fE728c);
        assertEq(registry.getEidForChainId(8453), 30184);
    }

    function testRobinhoodEndpointAndEid() external view {
        assertEq(registry.getLayerZeroEndpoint(4663), 0x6F475642a6e85809B1c36Fa62763669b1b48DD5B);
        assertEq(registry.getEidForChainId(4663), 30416);
    }

    function testUnknownChainReturnsZeroEid() external view {
        assertEq(registry.getEidForChainId(42161), 0);
    }
}
