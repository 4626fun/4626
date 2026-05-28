// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

import {DeploymentBatcher, DeploymentBatcherPhase3Helper} from "../contracts/helpers/batchers/DeploymentBatcher.sol";

/**
 * @title UpgradeDeploymentBatcherPhase3Helper
 * @notice Deploy a fresh `DeploymentBatcherPhase3Helper` and hot-swap it on the live batcher shell.
 *
 * v1.12.0 bytecode epoch: keeps the existing `DeploymentBatcher` address and re-wires helpers via
 * `wireDeploymentHelpers`, replacing only the Phase 3 helper module bytecode.
 *
 * Required env:
 * - PRIVATE_KEY (must equal batcher.protocolTreasury())
 * - DEPLOYMENT_BATCHER (defaults to live v1.11.2-pipe-a shell)
 *
 * Optional:
 * - WIRE_HELPERS=1 (default 1) — call `wireDeploymentHelpers` after deploy
 */
contract UpgradeDeploymentBatcherPhase3Helper is Script {
    address constant DEFAULT_DEPLOYMENT_BATCHER = 0xa99058f424FB3ACC639F59355C65C40149030651;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);
        address batcherAddr = vm.envOr("DEPLOYMENT_BATCHER", DEFAULT_DEPLOYMENT_BATCHER);
        bool wireHelpers = vm.envOr("WIRE_HELPERS", uint256(1)) == 1;

        DeploymentBatcher batcher = DeploymentBatcher(batcherAddr);
        require(broadcaster == batcher.protocolTreasury(), "broadcaster must equal protocolTreasury");

        address previousHelper = address(batcher.phase3Helper());
        require(previousHelper != address(0), "phase3 helper missing");
        DeploymentBatcherPhase3Helper previous =
            DeploymentBatcherPhase3Helper(previousHelper);
        address phase2Module = address(batcher.phase2Module());
        address uniV4Helper = address(batcher.uniV4Helper());
        address utilsHelper = address(batcher.utilsHelper());

        console2.log("Deployment batcher:", batcherAddr);
        console2.log("Previous phase3 helper:", previousHelper);
        console2.log("Keeping phase2 module:", phase2Module);
        console2.log("Keeping uniV4 helper:", uniV4Helper);
        console2.log("Keeping utils helper:", utilsHelper);

        vm.startBroadcast(pk);
        DeploymentBatcherPhase3Helper helper = new DeploymentBatcherPhase3Helper(
            address(batcher.create2Deployer()),
            batcher.protocolTreasury(),
            previous.protocolAutomation(),
            previous.usdc(),
            previous.uniswapV3Factory(),
            previous.uniswapRouter(),
            previous.ajnaFactory(),
            batcherAddr
        );
        console2.log("New phase3 helper:", address(helper));

        if (wireHelpers) {
            batcher.wireDeploymentHelpers(phase2Module, address(helper), uniV4Helper, utilsHelper);
            console2.log("wireDeploymentHelpers: phase3 helper updated");
        }
        vm.stopBroadcast();

        require(address(batcher.phase3Helper()) == address(helper), "phase3 helper mismatch");
        require(helper.batcher() == batcherAddr, "helper batcher mismatch");
    }
}
