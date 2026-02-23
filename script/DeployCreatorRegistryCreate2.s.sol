// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {CreatorRegistry} from "../contracts/core/CreatorRegistry.sol";

/**
 * @title DeployCreatorRegistryCreate2
 * @author 0xakita.eth
 * @notice Deploys CreatorRegistry via the Deterministic Deployment Proxy (CREATE2)
 *         to a vanity address ending in 4626.
 *
 * @dev HOW IT WORKS:
 *      The Deterministic Deployment Proxy (0x4e59...956C) deploys contracts via CREATE2.
 *      The calldata sent to the proxy is: salt (32 bytes) ++ initcode (bytecode + constructor args).
 *      The resulting address is: keccak256(0xff ++ proxy ++ salt ++ keccak256(initcode))[12..]
 *
 *      The salt was mined using `cast create2` to produce an address ending in "4626".
 *
 * @dev PREREQUISITES:
 *      1. PRIVATE_KEY env var set (deployer wallet)
 *      2. Sufficient ETH on the deployment chain
 *      3. The Deterministic Deployment Proxy must be deployed at 0x4e59...956C
 *         (it's available on all major EVM chains)
 *
 * @dev RUN COMMAND:
 *      forge script script/DeployCreatorRegistryCreate2.s.sol:DeployCreatorRegistryCreate2 \
 *          --rpc-url base \
 *          --broadcast \
 *          --verify \
 *          -vvvv
 *
 * @dev DRY RUN (no broadcast):
 *      forge script script/DeployCreatorRegistryCreate2.s.sol:DeployCreatorRegistryCreate2 \
 *          --rpc-url base \
 *          -vvvv
 */
contract DeployCreatorRegistryCreate2 is Script {
    // ═══════════════════════════════════════════════════════════════════
    //                    DETERMINISTIC DEPLOYMENT PROXY
    // ═══════════════════════════════════════════════════════════════════

    /// @notice The canonical Deterministic Deployment Proxy
    /// @dev Available on all major EVM chains at this address
    address constant DETERMINISTIC_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    // ═══════════════════════════════════════════════════════════════════
    //                    MINED SALT → ADDRESS ENDING IN 4626
    // ═══════════════════════════════════════════════════════════════════
    //
    //  These were mined with `cast create2`:
    //
    //    cast create2 --init-code-hash <initCodeHash> --starts-with 888 --ends-with 4626
    //
    //  The init code hash depends on:
    //   - the CreatorRegistry bytecode, and
    //   - the constructor args (owner address).
    //  If either changes, the salt must be re-mined to keep the vanity suffix.
    //
    //  Results (owner = 0xB05Cf01231cF2fF99499682E64D3780d57c80FdD):
    //    Init code hash: 0xb9f69ba28177a5646b913753b98b2dc17b997bfd782451705d4ba50206af65e1
    //    Salt:          0x14266ffc5394023d8ef7a879e273c01eee258d6b32c16f1a5451ce85484e8158
    //    → Address:     0x888506B92181c57A2fD06516FFFb6F375b7A4626
    //
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Default owner for the registry (override with env `OWNER`)
    address constant DEFAULT_OWNER = 0xB05Cf01231cF2fF99499682E64D3780d57c80FdD;

    /// @notice Default salt (override with env `SALT`)
    bytes32 constant DEFAULT_SALT = 0x14266ffc5394023d8ef7a879e273c01eee258d6b32c16f1a5451ce85484e8158;

    /// @notice Default expected address (override with env `EXPECTED_ADDRESS`)
    address constant DEFAULT_EXPECTED_ADDRESS = 0x888506B92181c57A2fD06516FFFb6F375b7A4626;

    function run() external {
        uint256 broadcasterPrivateKey = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(broadcasterPrivateKey);
        address owner = vm.envOr("OWNER", DEFAULT_OWNER);

        console.log("");
        console.log(
            unicode"╔════════════════════════════════════════════════════════════════╗"
        );
        console.log(unicode"║       CreatorRegistry — CREATE2 Vanity Deployment (4626)       ║");
        console.log(
            unicode"╚════════════════════════════════════════════════════════════════╝"
        );
        console.log("");
        console.log("Broadcaster (tx):", broadcaster);
        console.log("Owner:           ", owner);
        console.log("Chain ID:        ", block.chainid);
        bytes32 salt = vm.envOr("SALT", DEFAULT_SALT);
        address expected = vm.envOr("EXPECTED_ADDRESS", DEFAULT_EXPECTED_ADDRESS);
        console.log("Salt:            ", vm.toString(salt));
        if (expected != address(0)) {
            console.log("Expected address:", expected);
        } else {
            console.log("Expected address: (not set)");
        }
        console.log("");

        // Build the initcode: bytecode + ABI-encoded constructor args
        bytes memory initcode = abi.encodePacked(type(CreatorRegistry).creationCode, abi.encode(owner));

        // Verify the init code hash matches what we mined against
        bytes32 initCodeHash = keccak256(initcode);
        console.log("Init code hash:  ", vm.toString(initCodeHash));

        // Predict the address
        address predicted = address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), DETERMINISTIC_DEPLOYER, salt, initCodeHash))))
        );
        console.log("Predicted address:", predicted);

        if (expected != address(0)) {
            require(predicted == expected, "Predicted address does not match expected");
        }
        console.log("");
        console.log(unicode"  ✓ Address prediction ready");
        console.log("");

        // Check if already deployed
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(predicted)
        }
        if (codeSize > 0) {
            console.log(unicode"  ✗ Contract already deployed at this address!");
            console.log("    Skipping deployment.");
            return;
        }

        vm.startBroadcast(broadcasterPrivateKey);

        // Deploy via the Deterministic Deployment Proxy
        // Calldata = salt (32 bytes) ++ initcode
        bytes memory callData = abi.encodePacked(salt, initcode);

        (bool success,) = DETERMINISTIC_DEPLOYER.call(callData);
        require(success, "CREATE2 deployment failed");

        vm.stopBroadcast();

        // Verify deployment
        uint256 newCodeSize;
        assembly {
            newCodeSize := extcodesize(predicted)
        }
        require(newCodeSize > 0, "No code at expected address after deployment");

        // Verify the registry is functional
        CreatorRegistry registry = CreatorRegistry(predicted);
        require(registry.owner() == owner, "Owner mismatch");

        console.log("");
        console.log(
            unicode"╔════════════════════════════════════════════════════════════════╗"
        );
        console.log(unicode"║                    DEPLOYMENT COMPLETE                         ║");
        console.log(
            unicode"╚════════════════════════════════════════════════════════════════╝"
        );
        console.log("");
        console.log(unicode"  ✓ CreatorRegistry deployed at:", predicted);
        console.log("    Owner:                      ", owner);
        console.log("");
        console.log(
            unicode"┌─────────────────────────────────────────────────────────────────┐"
        );
        console.log(unicode"│  ENVIRONMENT VARIABLE                                           │");
        console.log(
            unicode"├─────────────────────────────────────────────────────────────────┤"
        );
        console.log("  CREATOR_REGISTRY=", predicted);
        console.log(
            unicode"└─────────────────────────────────────────────────────────────────┘"
        );
        console.log("");
        console.log(
            unicode"┌─────────────────────────────────────────────────────────────────┐"
        );
        console.log(unicode"│  NEXT STEPS                                                     │");
        console.log(
            unicode"├─────────────────────────────────────────────────────────────────┤"
        );
        console.log(unicode"│  1. Update env/config with CREATOR_REGISTRY                      │");
        console.log(unicode"│  2. Seed the new registry (chains, LZ endpoints/EIDs, DEX infra) │");
        console.log(unicode"│  3. Redeploy/wire dependent contracts to the new registry        │");
        console.log(
            unicode"└─────────────────────────────────────────────────────────────────┘"
        );
    }
}
