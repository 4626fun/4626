// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

import {Registry4626} from "@4626/shared/core/Registry4626.sol";
import {RegistryBootstrap4626} from "@4626/shared/deploy/factories/RegistryBootstrap4626.sol";

/**
 * @title DeployRegistryBootstrap4626
 * @author 0xakita.eth
 * @notice Deploys the owner-gated RegistryBootstrap4626 helper and (by default)
 *         authorizes it on Registry4626 so `bootstrapToken` can write.
 *
 * @dev Purpose: ad hoc / manual registry registration + first-time field binds in
 *      one transaction. Does **not** deploy BribesFactory4626 / ve4626 — leave
 *      `BRIBES_FACTORY` unset until that governance stack is live.
 *
 * @dev Env (required):
 *      - PRIVATE_KEY
 *
 * @dev Env (optional):
 *      - REGISTRY_4626 or REGISTRY  (default: v1.19.1 Registry4626 on Base)
 *      - OWNER                      (default: broadcaster) — Ownable owner of the helper
 *      - AUTH_ON_REGISTRY=1|0       (default: 1) call registry.setAuthorizedFactory
 *      - BRIBES_FACTORY=0x...       (default: 0) wire optional bribes factory after deploy
 *
 * @dev Dry run:
 *      forge script script/DeployRegistryBootstrap4626.s.sol:DeployRegistryBootstrap4626 \
 *          --rpc-url "$BASE_RPC_URL" -vvvv
 *
 * @dev Broadcast:
 *      forge script script/DeployRegistryBootstrap4626.s.sol:DeployRegistryBootstrap4626 \
 *          --rpc-url "$BASE_RPC_URL" --broadcast -vvvv
 *
 * @dev After deploy, register a token (from a separate cast/script call as helper owner):
 *      RegistryBootstrap4626.bootstrapToken({ token, name, symbol, creator, pool, poolFee,
 *        vault, wrapper, shareOFT, oracle, gaugeController,
 *        setOmnichainMesh: false, omnichainMesh: ..., setSolanaShareOFTPeer: false, ...,
 *        createBribeDepot: false })
 */
contract DeployRegistryBootstrap4626 is Script {
    /// @notice v1.19.1 greenfield registry on Base (same default as SeedRegistry4626).
    address internal constant DEFAULT_REGISTRY = 0x1365e9CEfc516f8A287c51FBaeF96FB4581c6CA2;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);

        address registryAddr = vm.envOr("REGISTRY_4626", vm.envOr("REGISTRY", DEFAULT_REGISTRY));
        address owner = vm.envOr("OWNER", broadcaster);
        bool authOnRegistry = vm.envOr("AUTH_ON_REGISTRY", uint256(1)) == 1;
        address bribesFactory = vm.envOr("BRIBES_FACTORY", address(0));

        require(registryAddr != address(0), "REGISTRY required");
        require(owner != address(0), "OWNER required");

        Registry4626 registry = Registry4626(registryAddr);

        console2.log("");
        console2.log("=== DeployRegistryBootstrap4626 ===");
        console2.log("Chain ID:     ", block.chainid);
        console2.log("Broadcaster:  ", broadcaster);
        console2.log("Registry:     ", registryAddr);
        console2.log("Helper owner: ", owner);
        console2.log("Auth on registry:", authOnRegistry);
        console2.log("Bribes factory:", bribesFactory);
        console2.log("");

        if (authOnRegistry) {
            address registryOwner = registry.owner();
            require(
                registryOwner == broadcaster,
                "AUTH_ON_REGISTRY=1 requires PRIVATE_KEY to be Registry4626.owner()"
            );
            console2.log("Registry owner matches broadcaster - will authorize helper");
        }

        vm.startBroadcast(pk);

        RegistryBootstrap4626 bootstrap = new RegistryBootstrap4626(registryAddr, owner);
        console2.log("RegistryBootstrap4626:", address(bootstrap));

        if (authOnRegistry) {
            if (registry.authorizedFactories(address(bootstrap))) {
                console2.log("Already authorized on Registry4626 (unexpected for fresh deploy)");
            } else {
                registry.setAuthorizedFactory(address(bootstrap), true);
                console2.log("Authorized helper via Registry4626.setAuthorizedFactory");
            }
        } else {
            console2.log("AUTH_ON_REGISTRY=0 - skipping setAuthorizedFactory");
            console2.log("  (registry owner must authorize before bootstrapToken will succeed)");
        }

        if (bribesFactory != address(0)) {
            require(owner == broadcaster, "BRIBES_FACTORY set requires PRIVATE_KEY == OWNER");
            bootstrap.setBribesFactory(bribesFactory);
            console2.log("Wired BribesFactory4626 on helper");
        } else {
            console2.log("BRIBES_FACTORY unset - createBribeDepot will revert until configured");
        }

        vm.stopBroadcast();

        // ── Verification (read-only) ──────────────────────────────────────────
        console2.log("");
        console2.log("--- Verification ---");
        require(address(bootstrap.registry()) == registryAddr, "helper.registry mismatch");
        require(bootstrap.owner() == owner, "helper.owner mismatch");
        require(bootstrap.bribesFactory() == bribesFactory, "helper.bribesFactory mismatch");

        bool authorized = registry.authorizedFactories(address(bootstrap));
        console2.log("helper.registry:      ", address(bootstrap.registry()));
        console2.log("helper.owner:         ", bootstrap.owner());
        console2.log("helper.bribesFactory: ", bootstrap.bribesFactory());
        console2.log("registry.authorized:  ", authorized);
        if (authOnRegistry) {
            require(authorized, "helper not authorized on registry after deploy");
        }

        console2.log("");
        console2.log(string.concat("HANDOFF:REGISTRY=", vm.toString(registryAddr)));
        console2.log(string.concat("HANDOFF:REGISTRY_BOOTSTRAP_4626=", vm.toString(address(bootstrap))));
        console2.log(string.concat("HANDOFF:OWNER=", vm.toString(owner)));
        if (bribesFactory != address(0)) {
            console2.log(string.concat("HANDOFF:BRIBES_FACTORY=", vm.toString(bribesFactory)));
        }
    }
}
