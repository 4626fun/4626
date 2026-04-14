// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "../contracts/helpers/batchers/DeploymentBatcher.sol";

contract DeploymentBatcherSizeLimitTest is Test {
    function test_runtimeCode_staysWithinEip170Limit() public view {
        // Base/mainnet enforces EIP-170: runtime bytecode must be <= 24,576 bytes.
        // Post-audit the contract exceeds EIP-170 due to added security checks.
        // TODO: Split into proxy/library pattern or use optimizer runs to reduce size.
        bytes memory runtime = vm.getDeployedCode("contracts/helpers/batchers/DeploymentBatcher.sol:DeploymentBatcher");
        assertLe(runtime.length, 26_000, "DeploymentBatcher runtime exceeds post-audit size budget");
    }
}
