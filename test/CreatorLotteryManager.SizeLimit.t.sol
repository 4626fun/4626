// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

contract CreatorLotteryManagerSizeLimitTest is Test {
    function test_runtimeCode_staysWithinEip170Limit() public view {
        // Base/mainnet enforces EIP-170: runtime bytecode must be <= 24,576 bytes.
        bytes memory runtime =
            vm.getDeployedCode("contracts/utilities/lottery/CreatorLotteryManager.sol:CreatorLotteryManager");
        assertLe(runtime.length, 24_576, "CreatorLotteryManager runtime exceeds EIP-170 limit");
    }
}
