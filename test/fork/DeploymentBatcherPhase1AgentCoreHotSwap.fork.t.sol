// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {DeploymentBatcher, DeploymentBatcherPhase1Module} from "@4626/shared/deploy/batchers/DeploymentBatcher.sol";

/**
 * @title Phase1 agent-core hot-swap fork rehearsal
 * @notice Deploys a Phase1Module with AgentOVaultCoreModule wired as
 *         `agentVaultCoreModule`, then Safe-impersonates protocol treasury to
 *         approve + setPhase1Module on the live v1.19.1 batcher.
 *
 * Run:
 *   RUN_FORK_TESTS=1 BASE_RPC_URL=$BASE_RPC_URL \
 *     forge test --match-path "test/fork/DeploymentBatcherPhase1AgentCoreHotSwap.fork.t.sol" -vv
 */
contract DeploymentBatcherPhase1AgentCoreHotSwapForkTest is Test {
    address constant LIVE_BATCHER = 0xa18169caf37fa0347285B16aAFC2B09eCB43F145;
    address constant AGENT_VAULT_CORE_MODULE = 0xE9350e3AD91cCD00cb5C9c03C0CBE7271694E5f2;

    DeploymentBatcher internal batcher;
    DeploymentBatcherPhase1Module internal newModule;

    function setUp() public {
        if (!_forkEnabled()) return;
        vm.createSelectFork(vm.envString("BASE_RPC_URL"));
        batcher = DeploymentBatcher(LIVE_BATCHER);

        DeploymentBatcherPhase1Module oldPhase1 = batcher.phase1Module();
        require(address(oldPhase1) != address(0), "live phase1 missing");
        require(AGENT_VAULT_CORE_MODULE.code.length > 0, "agent core missing on fork");
        require(oldPhase1.agentVaultCoreModule() != AGENT_VAULT_CORE_MODULE, "already agent-cored");

        newModule = new DeploymentBatcherPhase1Module(
            address(oldPhase1.create2Deployer()),
            address(oldPhase1.bytecodeStore()),
            oldPhase1.registry(),
            oldPhase1.vaultCoreModule(),
            AGENT_VAULT_CORE_MODULE,
            oldPhase1.vaultStrategiesModule(),
            oldPhase1.vaultAdminModule(),
            oldPhase1.vaultActivationBatcher(),
            address(oldPhase1.utilsHelper()),
            LIVE_BATCHER
        );

        vm.startPrank(batcher.protocolTreasury());
        batcher.approvePhaseModuleCodehash(address(newModule), address(newModule).codehash);
        batcher.setPhase1Module(address(newModule));
        vm.stopPrank();
    }

    function test_fork_phase1AgentCoreHotSwap() public {
        if (!_forkEnabled()) {
            vm.skip(true);
            return;
        }

        assertEq(address(batcher.phase1Module()), address(newModule), "hot-swap failed");
        assertEq(newModule.agentVaultCoreModule(), AGENT_VAULT_CORE_MODULE, "agent core");
        assertEq(newModule.vaultCoreModule(), batcher.vaultCoreModule(), "creator core unchanged");
        assertTrue(
            newModule.agentVaultCoreModule() != newModule.vaultCoreModule(), "agent/creator cores must diverge"
        );
        assertEq(newModule.batcher(), LIVE_BATCHER, "module batcher");
    }

    function _forkEnabled() internal view returns (bool) {
        return vm.envOr("RUN_FORK_TESTS", uint256(0)) == 1 && bytes(vm.envOr("BASE_RPC_URL", string(""))).length > 0;
    }
}
