// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "forge-std/Test.sol";

contract CharmStrategy4626FactorySizeLimitTest is Test {
    function test_runtimeCode_staysWithinEip170Limit() public view {
        bytes memory runtime =
            vm.getDeployedCode("contracts/shared/deploy/batchers/StrategyDeploymentFactories.sol:CharmStrategy4626Factory");
        assertLe(runtime.length, 24_576, "CharmStrategy4626Factory runtime exceeds EIP-170 limit");
    }
}
