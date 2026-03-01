// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {CreatorLotteryManager} from "../contracts/utilities/lottery/CreatorLotteryManager.sol";

/**
 * @title DeployLotteryManagerCreate2
 * @notice Deploys CreatorLotteryManager via the Deterministic Deployment Proxy (CREATE2)
 *         to a vanity address starting with 0x777 and ending in 4626.
 *
 * Deployer: 0x4e59...B4956C (Deterministic Deployment Proxy)
 * Initcode hash: 0x9887537b7bb629ec4558f3fc4607673108717efc232e0e47be88bb6482d0eeb0
 * Salt: 0x0100000000000000b67a63000000000000000000000000000000000000000000
 * Address: 0x77740C44A3E1d8262e8bfAB6204A29B2cbeE4626
 */
contract DeployLotteryManagerCreate2 is Script {
    /// @notice Deterministic Deployment Proxy (EIP-2470)
    address constant DETERMINISTIC_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    /// @notice Mined salt for vanity address
    bytes32 constant SALT = 0x0100000000000000b67a63000000000000000000000000000000000000000000;

    /// @notice Expected deployed address
    address constant EXPECTED_ADDRESS = 0x77740C44A3E1d8262e8bfAB6204A29B2cbeE4626;

    /// @notice Base mainnet registry + owner
    address constant REGISTRY = 0x888482d648D1fCa1A735268A9e579b44Bf644626;
    address constant OWNER = 0xB05Cf01231cF2fF99499682E64D3780d57c80FdD;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("");
        console.log(
            unicode"╔════════════════════════════════════════════════════════════════╗"
        );
        console.log(unicode"║   CreatorLotteryManager — CREATE2 Vanity Deployment (4626)     ║");
        console.log(
            unicode"╚════════════════════════════════════════════════════════════════╝"
        );
        console.log("");
        console.log("Deployer (tx sender):", deployer);
        console.log("Chain ID:            ", block.chainid);
        console.log("Registry:            ", REGISTRY);
        console.log("Owner:               ", OWNER);
        console.log("Salt:                ", vm.toString(SALT));
        console.log("Expected address:    ", EXPECTED_ADDRESS);
        console.log("");

        // Build initcode: creation bytecode + constructor args
        bytes memory initcode = abi.encodePacked(type(CreatorLotteryManager).creationCode, abi.encode(REGISTRY, OWNER));

        // Verify init code hash
        bytes32 initCodeHash = keccak256(initcode);
        console.log("Init code hash:      ", vm.toString(initCodeHash));

        // Predict address
        address predicted = address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), DETERMINISTIC_DEPLOYER, SALT, initCodeHash))))
        );
        console.log("Predicted address:   ", predicted);

        require(predicted == EXPECTED_ADDRESS, "Predicted address does not match expected; salt/initcode mismatch");
        console.log(unicode"  ✓ Address prediction verified");
        console.log("");

        // Skip if already deployed
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(predicted)
        }
        if (codeSize > 0) {
            console.log(unicode"  ✗ Contract already deployed at this address!");
            console.log("    Skipping deployment.");
            return;
        }

        vm.startBroadcast(deployerPrivateKey);

        // Calldata = salt (32 bytes) ++ initcode
        bytes memory callData = abi.encodePacked(SALT, initcode);
        (bool success,) = DETERMINISTIC_DEPLOYER.call(callData);
        require(success, "CREATE2 deployment failed");

        vm.stopBroadcast();

        // Verify deployment
        uint256 newCodeSize;
        assembly {
            newCodeSize := extcodesize(predicted)
        }
        require(newCodeSize > 0, "No code at expected address after deployment");

        // Verify owner
        CreatorLotteryManager lottery = CreatorLotteryManager(payable(predicted));
        require(lottery.owner() == OWNER, "Owner mismatch");

        console.log("");
        console.log(
            unicode"╔════════════════════════════════════════════════════════════════╗"
        );
        console.log(unicode"║                    DEPLOYMENT COMPLETE                         ║");
        console.log(
            unicode"╚════════════════════════════════════════════════════════════════╝"
        );
        console.log("");
        console.log(unicode"  ✓ CreatorLotteryManager deployed at:", predicted);
        console.log("    Owner:                         ", OWNER);
        console.log("");
        console.log(
            unicode"┌─────────────────────────────────────────────────────────────────┐"
        );
        console.log(unicode"│  ENVIRONMENT VARIABLE                                           │");
        console.log(
            unicode"├─────────────────────────────────────────────────────────────────┤"
        );
        console.log("  LOTTERY_MANAGER=", predicted);
        console.log(
            unicode"└─────────────────────────────────────────────────────────────────┘"
        );
        console.log("");
    }
}
