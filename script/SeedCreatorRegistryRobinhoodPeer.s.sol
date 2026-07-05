// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {Registry4626} from "../contracts/core/4626Registry.sol";

/**
 * @title SeedCreatorRegistryRobinhoodPeer
 * @notice Index Robinhood remote ShareOFT peer on Base Registry4626 for one creator token.
 *
 * Required env:
 * - PRIVATE_KEY
 * - REGISTRY
 * - CREATOR_TOKEN
 * - ROBINHOOD_EID (default 30416)
 * - ROBINHOOD_REMOTE_OFT (EVM address on Robinhood Chain)
 */
contract SeedCreatorRegistryRobinhoodPeer is Script {
    uint32 internal constant DEFAULT_ROBINHOOD_EID = 30416;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        address registryAddr = vm.envAddress("REGISTRY");
        address creatorToken = vm.envAddress("CREATOR_TOKEN");
        uint32 robinhoodEid = uint32(vm.envOr("ROBINHOOD_EID", uint256(DEFAULT_ROBINHOOD_EID)));
        address remoteOft = vm.envAddress("ROBINHOOD_REMOTE_OFT");

        Registry4626 registry = Registry4626(registryAddr);
        require(registry.owner() == deployer, "Deployer is not registry owner");

        console.log("Registry:      ", registryAddr);
        console.log("CreatorToken:  ", creatorToken);
        console.log("Robinhood EID: ", robinhoodEid);
        console.log("Remote ShareOFT:", remoteOft);

        vm.startBroadcast(deployerPrivateKey);
        registry.setRemoteOFTPeer(creatorToken, robinhoodEid, remoteOft);
        vm.stopBroadcast();

        address configuredPeer = registry.getRemoteOFTPeer(creatorToken, robinhoodEid);
        require(configuredPeer == remoteOft, "Robinhood peer wiring verification failed");
        console.log("Robinhood EVM peer wired and verified.");
    }
}
