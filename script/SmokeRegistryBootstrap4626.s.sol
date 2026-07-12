// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";
import {RegistryBootstrap4626} from "@4626/shared/deploy/factories/RegistryBootstrap4626.sol";

/**
 * @title SmokeRegistryBootstrap4626
 * @notice Fork/mainnet smoke: call bootstrapToken once and verify registry fields.
 *
 * Env (required):
 *   - PRIVATE_KEY (must be helper owner)
 *   - REGISTRY_BOOTSTRAP_4626
 *
 * Env (optional):
 *   - REGISTRY / REGISTRY_4626 (for post-check; default from helper.registry())
 *   - SMOKE_TOKEN (default: 0xB000...0001)
 *
 * Usage (against local fork after DeployRegistryBootstrap4626):
 *   REGISTRY_BOOTSTRAP_4626=0x... forge script script/SmokeRegistryBootstrap4626.s.sol:SmokeRegistryBootstrap4626 \
 *     --rpc-url http://127.0.0.1:8545 --broadcast -vvvv
 */
contract SmokeRegistryBootstrap4626 is Script {
    address internal constant DEFAULT_SMOKE_TOKEN = 0xb000000000000000000000000000000000000001;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);
        address bootstrapAddr = vm.envAddress("REGISTRY_BOOTSTRAP_4626");
        address smokeToken = vm.envOr("SMOKE_TOKEN", DEFAULT_SMOKE_TOKEN);

        RegistryBootstrap4626 bootstrap = RegistryBootstrap4626(bootstrapAddr);
        IRegistry4626 registry = bootstrap.registry();

        require(bootstrap.owner() == broadcaster, "PRIVATE_KEY must be helper owner");

        address vault = address(uint160(uint256(keccak256("smoke-vault"))));
        address wrapper = address(uint160(uint256(keccak256("smoke-wrapper"))));
        address shareOFT = address(uint160(uint256(keccak256("smoke-share"))));
        address oracle = address(uint160(uint256(keccak256("smoke-oracle"))));
        address gauge = address(uint160(uint256(keccak256("smoke-gauge"))));
        address creator = broadcaster;

        console2.log("=== SmokeRegistryBootstrap4626 ===");
        console2.log("Bootstrap:", bootstrapAddr);
        console2.log("Registry: ", address(registry));
        console2.log("Token:    ", smokeToken);

        RegistryBootstrap4626.BootstrapParams memory p;
        p.token = smokeToken;
        p.name = "Fork Smoke Token";
        p.symbol = "SMOKE";
        p.creator = creator;
        p.pool = address(0);
        p.poolFee = 0;
        p.vault = vault;
        p.wrapper = wrapper;
        p.shareOFT = shareOFT;
        p.oracle = oracle;
        p.gaugeController = gauge;
        p.setOmnichainMesh = false;
        p.setSolanaShareOFTPeer = false;
        p.createBribeDepot = false;

        vm.startBroadcast(pk);
        bootstrap.bootstrapToken(p);
        // Idempotent re-run must succeed as a no-op.
        bootstrap.bootstrapToken(p);
        vm.stopBroadcast();

        IRegistry4626.TokenInfo memory info = registry.getTokenInfo(smokeToken);
        require(info.token == smokeToken, "token not registered");
        require(info.vault == vault, "vault mismatch");
        require(info.wrapper == wrapper, "wrapper mismatch");
        require(info.shareOFT == shareOFT, "shareOFT mismatch");
        require(info.oracle == oracle, "oracle mismatch");
        require(info.gaugeController == gauge, "gauge mismatch");

        console2.log("--- Smoke verification OK ---");
        console2.log("vault:           ", info.vault);
        console2.log("wrapper:         ", info.wrapper);
        console2.log("shareOFT:        ", info.shareOFT);
        console2.log("oracle:          ", info.oracle);
        console2.log("gaugeController: ", info.gaugeController);
        console2.log(string.concat("HANDOFF:SMOKE_TOKEN=", vm.toString(smokeToken)));
    }
}
