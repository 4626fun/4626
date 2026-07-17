// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

import {DeploymentBatcher, DeploymentBatcherPhase1Module} from "@4626/shared/deploy/batchers/DeploymentBatcher.sol";

/**
 * @title UpgradeDeploymentBatcherPhase1AgentCore
 * @notice Deploy a fresh Phase1Module for the live v1.19.1 batcher with
 *         `agentVaultCoreModule` pinned to AgentOVaultCoreModule (not creator core).
 *
 * Live gap: Phase1 `0x7284910e…` reports `agentVaultCoreModule() == vaultCoreModule()`
 * (creator core). Agent Phase1 therefore cannot install AgentOVaultCoreModule.
 *
 * Required env:
 * - PRIVATE_KEY (funded EOA for CREATE deploy)
 * - DEPLOYMENT_BATCHER (defaults to live v1.19.1 shell)
 *
 * Optional:
 * - AGENT_VAULT_CORE_MODULE (default live pointer `0xE9350e3A…`)
 * - SET_PHASE1_MODULE=0 (default) — when 1, broadcaster must be protocolTreasury and
 *   will approvePhaseModuleCodehash + setPhase1Module. For the live Safe treasury, keep
 *   0 and finish via `frontend/scripts/ops/execute-set-phase1-module-safe.ts`.
 */
contract UpgradeDeploymentBatcherPhase1AgentCore is Script {
    address constant DEFAULT_DEPLOYMENT_BATCHER = 0xa18169caf37fa0347285B16aAFC2B09eCB43F145;
    address constant DEFAULT_AGENT_VAULT_CORE_MODULE = 0xE9350e3AD91cCD00cb5C9c03C0CBE7271694E5f2;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);
        address batcherAddr = vm.envOr("DEPLOYMENT_BATCHER", DEFAULT_DEPLOYMENT_BATCHER);
        address agentCore = vm.envOr("AGENT_VAULT_CORE_MODULE", DEFAULT_AGENT_VAULT_CORE_MODULE);
        bool setPhase1Module = vm.envOr("SET_PHASE1_MODULE", uint256(0)) == 1;

        require(agentCore != address(0), "AGENT_VAULT_CORE_MODULE required");
        require(agentCore.code.length > 0, "agent core has no code");

        DeploymentBatcher batcher = DeploymentBatcher(batcherAddr);
        DeploymentBatcherPhase1Module oldPhase1 = batcher.phase1Module();
        require(address(oldPhase1) != address(0), "phase1 module missing");

        address create2Deployer = address(oldPhase1.create2Deployer());
        address store = address(oldPhase1.bytecodeStore());
        address registry = oldPhase1.registry();
        address vaultCore = oldPhase1.vaultCoreModule();
        address strategies = oldPhase1.vaultStrategiesModule();
        address admin = oldPhase1.vaultAdminModule();
        address vaultActivation = oldPhase1.vaultActivationBatcher();
        address utilsHelper = address(oldPhase1.utilsHelper());
        address phase1Batcher = oldPhase1.batcher();

        require(phase1Batcher == batcherAddr, "old phase1 batcher mismatch");
        require(vaultCore != agentCore, "agent core must differ from creator core");

        console2.log("Deployment batcher:", batcherAddr);
        console2.log("Previous phase1 module:", address(oldPhase1));
        console2.log("Previous agentVaultCoreModule:", oldPhase1.agentVaultCoreModule());
        console2.log("New agentVaultCoreModule:", agentCore);
        console2.log("Broadcaster:", broadcaster);

        if (setPhase1Module) {
            require(broadcaster == batcher.protocolTreasury(), "broadcaster must equal protocolTreasury");
        }

        vm.startBroadcast(pk);
        DeploymentBatcherPhase1Module module = new DeploymentBatcherPhase1Module(
            create2Deployer,
            store,
            registry,
            vaultCore,
            agentCore,
            strategies,
            admin,
            vaultActivation,
            utilsHelper,
            batcherAddr
        );
        console2.log("New phase1 module:", address(module));

        if (setPhase1Module) {
            bytes32 codehash = address(module).codehash;
            batcher.approvePhaseModuleCodehash(address(module), codehash);
            batcher.setPhase1Module(address(module));
            console2.log("setPhase1Module: updated");
        }
        vm.stopBroadcast();

        require(module.batcher() == batcherAddr, "module batcher mismatch");
        require(module.agentVaultCoreModule() == agentCore, "module agent core mismatch");
        require(module.vaultCoreModule() == vaultCore, "module creator core mismatch");

        if (setPhase1Module) {
            require(address(batcher.phase1Module()) == address(module), "phase1 module mismatch");
        } else {
            console2.log("SET_PHASE1_MODULE=0 - finish via protocol treasury Safe:");
            console2.log("  pnpm -C frontend exec tsx scripts/ops/execute-set-phase1-module-safe.ts \\");
            console2.log(string.concat("    --phase1-module ", vm.toString(address(module))));
        }

        console2.log(string.concat("HANDOFF:DEPLOYMENT_BATCHER_PHASE1_MODULE=", vm.toString(address(module))));
        console2.log(string.concat("HANDOFF:AGENT_VAULT_CORE_MODULE=", vm.toString(agentCore)));
        console2.log(string.concat("HANDOFF:OLD_PHASE1_MODULE=", vm.toString(address(oldPhase1))));
    }
}
