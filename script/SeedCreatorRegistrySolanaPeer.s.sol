// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {CreatorRegistry} from "../contracts/core/CreatorRegistry.sol";
import {ICreatorRegistry} from "../contracts/interfaces/core/ICreatorRegistry.sol";

/**
 * @title SeedCreatorRegistrySolanaPeer
 * @notice Wires Solana bytes32 OFT peer metadata in CreatorRegistry for one creator token.
 *
 * Required env:
 * - PRIVATE_KEY
 * - REGISTRY
 * - CREATOR_TOKEN
 * - SOLANA_EID
 * - SOLANA_REMOTE_OFT_PEER_BYTES32
 *
 * Optional env:
 * - SOLANA_REGISTRY_KEY (if set > 0, writes the Solana registry key <-> EID mapping too)
 * - OVAULT_HUB_COMPOSER
 * - OVAULT_ASSET_MESH_TOKEN
 * - OVAULT_SHARE_MESH_TOKEN
 * - OVAULT_SOLANA_ASSET_MINT
 * - OVAULT_MESH_ENABLED (default 1)
 */
contract SeedCreatorRegistrySolanaPeer is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        address registryAddr = vm.envAddress("REGISTRY");
        address creatorToken = vm.envAddress("CREATOR_TOKEN");
        uint32 solanaEid = uint32(vm.envUint("SOLANA_EID"));
        bytes32 remotePeer = vm.envBytes32("SOLANA_REMOTE_OFT_PEER_BYTES32");
        uint256 solanaRegistryKey = vm.envOr("SOLANA_REGISTRY_KEY", uint256(0));
        address ovaultHubComposer = vm.envOr("OVAULT_HUB_COMPOSER", address(0));
        address ovaultAssetMeshToken = vm.envOr("OVAULT_ASSET_MESH_TOKEN", address(0));
        address ovaultShareMeshToken = vm.envOr("OVAULT_SHARE_MESH_TOKEN", address(0));
        bytes32 ovaultSolanaAssetMint = vm.envOr("OVAULT_SOLANA_ASSET_MINT", bytes32(0));
        bool ovaultMeshEnabled = vm.envOr("OVAULT_MESH_ENABLED", uint256(1)) == 1;
        bool configureOvaultMesh = ovaultHubComposer != address(0) || ovaultAssetMeshToken != address(0)
            || ovaultShareMeshToken != address(0) || ovaultSolanaAssetMint != bytes32(0);
        if (configureOvaultMesh) {
            require(ovaultHubComposer != address(0), "OVAULT_HUB_COMPOSER required");
            require(ovaultAssetMeshToken != address(0), "OVAULT_ASSET_MESH_TOKEN required");
            require(ovaultShareMeshToken != address(0), "OVAULT_SHARE_MESH_TOKEN required");
            require(ovaultSolanaAssetMint != bytes32(0), "OVAULT_SOLANA_ASSET_MINT required");
        }

        CreatorRegistry registry = CreatorRegistry(registryAddr);
        require(registry.owner() == deployer, "Deployer is not registry owner");

        console.log("Registry:     ", registryAddr);
        console.log("CreatorToken: ", creatorToken);
        console.log("Solana EID:   ", solanaEid);
        console.logBytes32(remotePeer);

        vm.startBroadcast(deployerPrivateKey);

        if (solanaRegistryKey > 0) {
            registry.setChainIdToEid(solanaRegistryKey, solanaEid);
            console.log("Set registry key <-> EID mapping for Solana");
            console.log(solanaRegistryKey);
        }

        registry.setRemoteOFTPeerBytes32(creatorToken, solanaEid, remotePeer);

        if (configureOvaultMesh) {
            registry.setOmnichainVaultMesh(
                creatorToken,
                ICreatorRegistry.OmnichainVaultMeshConfig({
                    solanaEid: solanaEid,
                    hubComposer: ovaultHubComposer,
                    assetMeshToken: ovaultAssetMeshToken,
                    shareMeshToken: ovaultShareMeshToken,
                    solanaAssetMint: ovaultSolanaAssetMint,
                    enabled: ovaultMeshEnabled
                })
            );
        }

        vm.stopBroadcast();

        bytes32 configuredPeer = registry.getRemoteOFTPeerBytes32(creatorToken, solanaEid);
        require(configuredPeer == remotePeer, "Solana peer wiring verification failed");
        if (configureOvaultMesh) {
            ICreatorRegistry.OmnichainVaultMeshConfig memory cfg = registry.getOmnichainVaultMesh(creatorToken);
            require(cfg.solanaEid == solanaEid, "OVault mesh EID mismatch");
            require(cfg.hubComposer == ovaultHubComposer, "OVault mesh composer mismatch");
            require(cfg.assetMeshToken == ovaultAssetMeshToken, "OVault asset mesh token mismatch");
            require(cfg.shareMeshToken == ovaultShareMeshToken, "OVault share mesh token mismatch");
            require(cfg.solanaAssetMint == ovaultSolanaAssetMint, "OVault mesh Solana mint mismatch");
            require(cfg.enabled == ovaultMeshEnabled, "OVault mesh enabled mismatch");
        }
        console.log("Solana bytes32 peer wired and verified.");
    }
}
