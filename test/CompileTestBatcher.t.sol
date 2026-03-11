// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/helpers/batchers/StrategyDeploymentBatcher.sol";

/**
 * @title CompileTestBatcher
 * @notice Minimal test to verify StrategyDeploymentBatcher compiles
 */
contract CompileTestBatcher is Test {
    StrategyDeploymentBatcher public batcher;

    function setUp() public {
        batcher = new StrategyDeploymentBatcher();
    }

    function testBatcherExists() public {
        assertTrue(address(batcher) != address(0));
    }

    function testConstantsSet() public {
        assertEq(batcher.V3_FACTORY(), 0x33128a8fC17869897dcE68Ed026d694621f6FDfD);
        assertEq(batcher.UNISWAP_ROUTER(), 0x2626664c2603336E57B271c5C0b26F421741e481);
    }
}
