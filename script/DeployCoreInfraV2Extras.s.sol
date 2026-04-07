// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

import {CreatorOVaultFactory} from "../contracts/factories/CreatorOVaultFactory.sol";
import {CreatorVRFConsumerV2_5} from "../contracts/utilities/lottery/vrf/CreatorVRFConsumerV2_5.sol";

interface ICreatorRegistryAuth {
    function owner() external view returns (address);
    function setAuthorizedFactory(address factory, bool authorized) external;
}

/**
 * @notice Deploys the remaining "core infra" contracts that sit next to the vanity registry/lottery:
 *         - CreatorOVaultFactory (legacy deployment registrar)
 *         - CreatorVRFConsumerV2_5 (VRF hub)
 *
 * Wiring:
 * - registry.setAuthorizedFactory(factory, true)
 * - vrfConsumer.setVRFCoordinator(VRF_COORDINATOR) (optional)
 *
 * Notes:
 * - The VRF hub still needs `setVRFConfig(...)` + subscription consumer allowlist to be fully live.
 * - This script is safe to rerun only if you pass `SKIP_*` flags once deployed.
 */
contract DeployCoreInfraV2Extras is Script {
    // Base mainnet constants
    uint256 internal constant BASE_CHAIN_ID = 8453;
    address internal constant VRF_COORDINATOR_BASE = 0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634;

    // New vanity registry (suffix 4626) + canonical owner.
    address internal constant DEFAULT_REGISTRY = 0x888506B92181c57A2fD06516FFFb6F375b7A4626;
    address internal constant DEFAULT_OWNER = 0xB05Cf01231cF2fF99499682E64D3780d57c80FdD;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);

        address registryAddr = vm.envOr("REGISTRY", DEFAULT_REGISTRY);
        address owner = vm.envOr("OWNER", DEFAULT_OWNER);

        bool skipFactory = vm.envOr("SKIP_FACTORY", uint256(0)) == 1;
        bool skipVrfConsumer = vm.envOr("SKIP_VRF_CONSUMER", uint256(0)) == 1;
        bool skipVrfCoordinator = vm.envOr("SKIP_VRF_COORDINATOR", uint256(0)) == 1;

        console2.log("DeployCoreInfraV2Extras");
        console2.log("Chain ID:", block.chainid);
        console2.log("Broadcaster:", broadcaster);
        console2.log("Registry:", registryAddr);
        console2.log("Owner:", owner);
        console2.log("skipFactory:", skipFactory);
        console2.log("skipVrfConsumer:", skipVrfConsumer);
        console2.log("skipVrfCoordinator:", skipVrfCoordinator);

        require(block.chainid == BASE_CHAIN_ID, "Wrong chain");

        ICreatorRegistryAuth registry = ICreatorRegistryAuth(registryAddr);
        require(registry.owner() == owner, "Registry owner mismatch");

        vm.startBroadcast(pk);

        CreatorOVaultFactory factory;
        CreatorVRFConsumerV2_5 vrfConsumer;

        if (!skipFactory) {
            factory = new CreatorOVaultFactory(registryAddr, owner);
            console2.log("CreatorOVaultFactory (legacy registrar):", address(factory));
            registry.setAuthorizedFactory(address(factory), true);
            console2.log("registry.setAuthorizedFactory(legacyRegistrar, true)");
        } else {
            console2.log("SKIP legacy registrar deploy");
        }

        if (!skipVrfConsumer) {
            vrfConsumer = new CreatorVRFConsumerV2_5(registryAddr, owner);
            console2.log("CreatorVRFConsumerV2_5:", address(vrfConsumer));

            if (!skipVrfCoordinator) {
                vrfConsumer.setVRFCoordinator(VRF_COORDINATOR_BASE);
                console2.log("vrfConsumer.setVRFCoordinator:", VRF_COORDINATOR_BASE);
            } else {
                console2.log("SKIP vrf coordinator set");
            }
        } else {
            console2.log("SKIP vrf consumer deploy");
        }

        vm.stopBroadcast();

        console2.log("Done.");
    }
}

