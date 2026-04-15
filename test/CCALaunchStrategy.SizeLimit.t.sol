// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "forge-std/Test.sol";

contract CCALaunchStrategySizeLimitTest is Test {
    function test_runtimeCode_staysWithinEip170Limit() public view {
        bytes memory runtime = vm.getDeployedCode("contracts/vault/strategies/CCALaunchStrategy.sol:CCALaunchStrategy");
        assertLe(runtime.length, 24_576, "CCALaunchStrategy runtime exceeds EIP-170 limit");
    }
}
