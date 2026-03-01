// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {CreatorRegistry} from "../contracts/core/CreatorRegistry.sol";

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
 * - SOLANA_CHAIN_ID (if set > 0, writes chainId <-> EID mapping too)
 */
contract SeedCreatorRegistrySolanaPeer is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        address registryAddr = vm.envAddress("REGISTRY");
        address creatorToken = vm.envAddress("CREATOR_TOKEN");
        uint32 solanaEid = uint32(vm.envUint("SOLANA_EID"));
        bytes32 remotePeer = vm.envBytes32("SOLANA_REMOTE_OFT_PEER_BYTES32");
        uint256 solanaChainId = vm.envOr("SOLANA_CHAIN_ID", uint256(0));

        CreatorRegistry registry = CreatorRegistry(registryAddr);
        require(registry.owner() == deployer, "Deployer is not registry owner");

        console.log("Registry:     ", registryAddr);
        console.log("CreatorToken: ", creatorToken);
        console.log("Solana EID:   ", solanaEid);
        console.logBytes32(remotePeer);

        vm.startBroadcast(deployerPrivateKey);

        if (solanaChainId > 0) {
            registry.setChainIdToEid(solanaChainId, solanaEid);
            console.log("Set chainId<->EID mapping for Solana chain ID");
            console.log(solanaChainId);
        }

        registry.setRemoteOFTPeerBytes32(creatorToken, solanaEid, remotePeer);

        vm.stopBroadcast();

        bytes32 configuredPeer = registry.getRemoteOFTPeerBytes32(creatorToken, solanaEid);
        require(configuredPeer == remotePeer, "Solana peer wiring verification failed");
        console.log("Solana bytes32 peer wired and verified.");
    }
}
