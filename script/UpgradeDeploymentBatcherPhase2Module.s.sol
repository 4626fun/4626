// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

import {DeploymentBatcher, DeploymentBatcherPhase2Module} from "../contracts/helpers/batchers/DeploymentBatcher.sol";

/**
 * @title UpgradeDeploymentBatcherPhase2Module
 * @notice Deploy a fresh `DeploymentBatcherPhase2Module` and hot-swap it on an existing batcher.
 *
 * Required env:
 * - PRIVATE_KEY (must equal batcher.protocolTreasury())
 * - DEPLOYMENT_BATCHER (defaults to live split Phase-1 batcher)
 *
 * Optional:
 * - SET_PHASE2_MODULE=1 (default 1) — call `setPhase2Module` after deploy
 */
contract UpgradeDeploymentBatcherPhase2Module is Script {
    address constant DEFAULT_DEPLOYMENT_BATCHER = 0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);
        address batcherAddr = vm.envOr("DEPLOYMENT_BATCHER", DEFAULT_DEPLOYMENT_BATCHER);
        bool setPhase2Module = vm.envOr("SET_PHASE2_MODULE", uint256(1)) == 1;

        DeploymentBatcher batcher = DeploymentBatcher(batcherAddr);
        require(broadcaster == batcher.protocolTreasury(), "broadcaster must equal protocolTreasury");

        address previousModule = address(batcher.phase2Module());
        console2.log("Deployment batcher:", batcherAddr);
        console2.log("Previous phase2 module:", previousModule);

        vm.startBroadcast(pk);
        DeploymentBatcherPhase2Module module = new DeploymentBatcherPhase2Module(
            address(batcher.create2Deployer()),
            address(batcher.registry()),
            batcher.chainlinkEthUsd(),
            batcher.poolManager(),
            batcher.taxHook(),
            batcher.protocolTreasury(),
            batcher.lotteryManager(),
            batcher.vaultActivationBatcher(),
            batcherAddr
        );
        console2.log("New phase2 module:", address(module));

        if (setPhase2Module) {
            batcher.setPhase2Module(address(module));
            console2.log("setPhase2Module: updated");
        }
        vm.stopBroadcast();

        require(address(batcher.phase2Module()) == address(module), "phase2 module mismatch");
        require(module.batcher() == batcherAddr, "module batcher mismatch");
    }
}
