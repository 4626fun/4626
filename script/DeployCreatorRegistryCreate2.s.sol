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
 *      The salt was mined using tools/create2-miner to produce an address ending in "4626".
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
    //  These were mined with tools/create2-miner:
    //
    //    ./create2-miner \
    //      --init-code-hash 0xf36909e3e6419fbf814ce67dfdd83c0136dd6f6a489b1b81a0af2f71cd6b0d73 \
    //      --suffix 4626
    //
    //  The init code hash depends on the constructor args (owner address).
    //  If the owner changes, the salt must be re-mined.
    //
    //  Results (owner = 0xB05Cf01231cF2fF99499682E64D3780d57c80FdD):
    //    Salt: 0x00000000000000000000000000000000000000000000000049ffffffffe6b074
    //    → Address: 0x888482d648D1fCa1A735268A9e579b44Bf644626
    //
    // ═══════════════════════════════════════════════════════════════════

    bytes32 constant SALT = 0x00000000000000000000000000000000000000000000000049ffffffffe6b074;

    /// @notice Expected address (for verification)
    address constant EXPECTED_ADDRESS = 0x888482d648D1fCa1A735268A9e579b44Bf644626;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("");
        console.log(unicode"╔════════════════════════════════════════════════════════════════╗");
        console.log(unicode"║       CreatorRegistry — CREATE2 Vanity Deployment (4626)       ║");
        console.log(unicode"╚════════════════════════════════════════════════════════════════╝");
        console.log("");
        console.log("Deployer (owner):", deployer);
        console.log("Chain ID:        ", block.chainid);
        console.log("Salt:            ", vm.toString(SALT));
        console.log("Expected address:", EXPECTED_ADDRESS);
        console.log("");

        // Build the initcode: bytecode + ABI-encoded constructor args
        bytes memory initcode = abi.encodePacked(
            type(CreatorRegistry).creationCode,
            abi.encode(deployer)
        );

        // Verify the init code hash matches what we mined against
        bytes32 initCodeHash = keccak256(initcode);
        console.log("Init code hash:  ", vm.toString(initCodeHash));

        // Predict the address
        address predicted = address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            bytes1(0xff),
                            DETERMINISTIC_DEPLOYER,
                            SALT,
                            initCodeHash
                        )
                    )
                )
            )
        );
        console.log("Predicted address:", predicted);

        require(
            predicted == EXPECTED_ADDRESS,
            "Predicted address does not match expected! Salt may be stale."
        );
        console.log("");
        console.log(unicode"  ✓ Address prediction verified");
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

        vm.startBroadcast(deployerPrivateKey);

        // Deploy via the Deterministic Deployment Proxy
        // Calldata = salt (32 bytes) ++ initcode
        bytes memory callData = abi.encodePacked(SALT, initcode);

        (bool success, ) = DETERMINISTIC_DEPLOYER.call(callData);
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
        require(registry.owner() == deployer, "Owner mismatch");

        console.log("");
        console.log(unicode"╔════════════════════════════════════════════════════════════════╗");
        console.log(unicode"║                    DEPLOYMENT COMPLETE                         ║");
        console.log(unicode"╚════════════════════════════════════════════════════════════════╝");
        console.log("");
        console.log(unicode"  ✓ CreatorRegistry deployed at:", predicted);
        console.log("    Owner:                      ", deployer);
        console.log("");
        console.log(unicode"┌─────────────────────────────────────────────────────────────────┐");
        console.log(unicode"│  ENVIRONMENT VARIABLE                                           │");
        console.log(unicode"├─────────────────────────────────────────────────────────────────┤");
        console.log("  CREATOR_REGISTRY=", predicted);
        console.log(unicode"└─────────────────────────────────────────────────────────────────┘");
        console.log("");
        console.log(unicode"┌─────────────────────────────────────────────────────────────────┐");
        console.log(unicode"│  NEXT STEPS                                                     │");
        console.log(unicode"├─────────────────────────────────────────────────────────────────┤");
        console.log(unicode"│  1. Update .env with new CREATOR_REGISTRY address               │");
        console.log(unicode"│  2. Update DeployTier1Upgrade.s.sol REGISTRY constant            │");
        console.log(unicode"│  3. Migrate data from old registry (if applicable)              │");
        console.log(unicode"│  4. Point all dependent contracts to new registry               │");
        console.log(unicode"└─────────────────────────────────────────────────────────────────┘");
    }
}
