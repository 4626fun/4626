// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

import {DeploymentBatcher, DeploymentBatcherPhase3Helper} from "../contracts/helpers/batchers/DeploymentBatcher.sol";

/**
 * @title DeployDeploymentBatcherPhase3HelperOnly
 * @notice Deploy fresh Phase 3 helper bytecode; wiring stays a separate protocol-treasury Safe step.
 *
 * Required env:
 * - PRIVATE_KEY (EOA with Base ETH for deploy gas)
 * - DEPLOYMENT_BATCHER (defaults to live shell)
 */
contract DeployDeploymentBatcherPhase3HelperOnly is Script {
    address constant DEFAULT_DEPLOYMENT_BATCHER = 0xa99058f424FB3ACC639F59355C65C40149030651;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address batcherAddr = vm.envOr("DEPLOYMENT_BATCHER", DEFAULT_DEPLOYMENT_BATCHER);

        DeploymentBatcher batcher = DeploymentBatcher(batcherAddr);
        address previousHelper = address(batcher.phase3Helper());
        require(previousHelper != address(0), "phase3 helper missing");
        DeploymentBatcherPhase3Helper previous =
            DeploymentBatcherPhase3Helper(previousHelper);

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
        vm.stopBroadcast();

        console2.log("HANDOFF:NEW_PHASE3_HELPER=", address(helper));
        console2.log("HANDOFF:DEPLOYMENT_BATCHER=", batcherAddr);
        console2.log("HANDOFF:PHASE2_MODULE=", address(batcher.phase2Module()));
        console2.log("HANDOFF:UNIV4_HELPER=", address(batcher.uniV4Helper()));
        console2.log("HANDOFF:UTILS_HELPER=", address(batcher.utilsHelper()));
    }
}
