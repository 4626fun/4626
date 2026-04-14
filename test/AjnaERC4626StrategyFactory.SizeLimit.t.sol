// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "forge-std/Test.sol";

contract AjnaERC4626StrategyFactorySizeLimitTest is Test {
    function test_runtimeCode_staysWithinEip170Limit() public view {
        bytes memory runtime = vm.getDeployedCode(
            "contracts/helpers/batchers/StrategyDeploymentFactories.sol:AjnaERC4626StrategyFactory"
        );
        assertLe(runtime.length, 24_576, "AjnaERC4626StrategyFactory runtime exceeds EIP-170 limit");
    }
}
