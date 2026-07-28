// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {CreatorOracleQuoteLib} from "@4626/creator/oracles/CreatorOracleQuoteLib.sol";

/**
 * @title DeployCreatorOracleQuoteLib
 * @notice CREATE2-deploy CreatorOracleQuoteLib at Foundry's default library address
 *         (EIP-2470 + create2_library_salt 0) before seeding/using linked CreatorOracle.
 *
 * Run:
 *   forge script script/DeployCreatorOracleQuoteLib.s.sol:DeployCreatorOracleQuoteLib \
 *     --rpc-url $BASE_RPC_URL --broadcast
 *
 * @dev Mirrors LotteryManager4626PricingLib ensure pattern: predict address, deploy if
 *      empty, verify extcodesize. Do not treat UniversalBytecodeStore seeding as install.
 */
contract DeployCreatorOracleQuoteLib is Script {
    address constant EIP2470 = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        bytes memory initCode = type(CreatorOracleQuoteLib).creationCode;
        address predicted = address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), EIP2470, bytes32(0), keccak256(initCode)))))
        );

        console2.log("Predicted CreatorOracleQuoteLib:", predicted);
        if (predicted.code.length > 0) {
            console2.log("Already deployed");
            return;
        }

        vm.startBroadcast(pk);
        (bool ok,) = EIP2470.call(abi.encodePacked(bytes32(0), initCode));
        require(ok, "EIP-2470 deploy failed");
        require(predicted.code.length > 0, "CreatorOracleQuoteLib missing after CREATE2");
        console2.log("Deployed CreatorOracleQuoteLib:", predicted);
        vm.stopBroadcast();
    }
}
