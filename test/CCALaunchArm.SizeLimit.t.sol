// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "forge-std/Test.sol";

contract CCALaunchArmSizeLimitTest is Test {
    function test_runtimeCode_staysWithinEip170Limit() public view {
        bytes memory runtime = vm.getDeployedCode("contracts/shared/shareoft-mesh/cca/CCALaunchArm.sol:CCALaunchArm");
        assertLe(runtime.length, 24_576, "CCALaunchArm runtime exceeds EIP-170 limit");
    }
}
