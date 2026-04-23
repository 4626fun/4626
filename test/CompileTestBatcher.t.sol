// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/helpers/batchers/StrategyDeploymentBatcher.sol";
import {
    CreatorCharmStrategyFactory,
    AjnaERC4626StrategyFactory
} from "../contracts/helpers/batchers/StrategyDeploymentFactories.sol";

/**
 * @title CompileTestBatcher
 * @notice Minimal test to verify StrategyDeploymentBatcher compiles
 */
contract CompileTestBatcher is Test {
    StrategyDeploymentBatcher public batcher;
    CreatorCharmStrategyFactory public creatorCharmFactory;
    AjnaERC4626StrategyFactory public ajnaFactory;

    function setUp() public {
        // FIX: 4626-401 / M-37 — factories are deployed separately so the batcher's
        // init-code stays under the EIP-3860 49,152-byte cap.
        creatorCharmFactory = new CreatorCharmStrategyFactory();
        ajnaFactory = new AjnaERC4626StrategyFactory();
        batcher = new StrategyDeploymentBatcher(address(creatorCharmFactory), address(ajnaFactory));
    }

    function testBatcherExists() public {
        assertTrue(address(batcher) != address(0));
    }

    function testConstantsSet() public {
        assertEq(batcher.V3_FACTORY(), 0x33128a8fC17869897dcE68Ed026d694621f6FDfD);
        assertEq(batcher.UNISWAP_ROUTER(), 0x2626664c2603336E57B271c5C0b26F421741e481);
    }
}
