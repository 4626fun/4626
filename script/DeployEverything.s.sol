// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/helpers/batchers/StrategyDeploymentBatcher.sol";
import {
    CreatorCharmStrategyFactory,
    AjnaERC4626StrategyFactory
} from "../contracts/helpers/batchers/StrategyDeploymentFactories.sol";
import "../contracts/helpers/batchers/VaultActivationBatcher.sol";

/**
 * @title DeployEverything
 * @notice Deploys all required contracts for 4626
 *
 * Usage:
 * forge script script/DeployEverything.s.sol:DeployEverything \
 *   --rpc-url base \
 *   --broadcast \
 *   --verify
 */
contract DeployEverything is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying from:", deployer);
        console.log("Balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // ═══════════════════════════════════════════════════════════
        // STEP 1: Deploy strategy factories, then StrategyDeploymentBatcher
        // ═══════════════════════════════════════════════════════════
        // FIX: 4626-401 / M-37 — the two strategy factories are deployed here instead of
        // inside `StrategyDeploymentBatcher`'s constructor so the batcher's init-code stays
        // under the EIP-3860 49,152-byte cap enforced by `forge build --sizes`.
        console.log("\n1a. Deploying CreatorCharmStrategyFactory...");
        CreatorCharmStrategyFactory creatorCharmFactory = new CreatorCharmStrategyFactory();
        console.log("    Address:", address(creatorCharmFactory));

        console.log("\n1b. Deploying AjnaERC4626StrategyFactory...");
        AjnaERC4626StrategyFactory ajnaFactory = new AjnaERC4626StrategyFactory();
        console.log("    Address:", address(ajnaFactory));

        console.log("\n1c. Deploying StrategyDeploymentBatcher...");
        StrategyDeploymentBatcher strategyBatcher =
            new StrategyDeploymentBatcher(address(creatorCharmFactory), address(ajnaFactory));
        console.log("    Address:", address(strategyBatcher));

        // ═══════════════════════════════════════════════════════════
        // STEP 2: Deploy VaultActivationBatcher
        // ═══════════════════════════════════════════════════════════
        console.log("\n2. Deploying VaultActivationBatcher...");
        address permit2 = vm.envOr("PERMIT2", address(0x000000000022D473030F116dDEE9F6B43aC78BA3));
        address registry = vm.envAddress("CREATOR_REGISTRY");
        VaultActivationBatcher activationBatcher = new VaultActivationBatcher(permit2, registry);
        console.log("   Address:", address(activationBatcher));

        vm.stopBroadcast();

        // ═══════════════════════════════════════════════════════════
        // SUMMARY
        // ═══════════════════════════════════════════════════════════
        console.log("\n");
        console.log("========================================");
        console.log("DEPLOYMENT COMPLETE!");
        console.log("========================================");
        console.log("CreatorCharmStrategyFactory:", address(creatorCharmFactory));
        console.log("AjnaERC4626StrategyFactory:", address(ajnaFactory));
        console.log("StrategyDeploymentBatcher:  ", address(strategyBatcher));
        console.log("VaultActivationBatcher:     ", address(activationBatcher));
        console.log("\n");
        console.log("NEXT STEPS:");
        console.log("1. Save these addresses");
        console.log("2. Deploy CCALaunchStrategy for each vault");
        console.log("3. Call setApprovedLauncher() on each CCA");
        console.log("========================================");
    }
}
