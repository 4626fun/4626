// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";

import {AgentOVaultCoreModule} from "@4626/agent/vault/modules/AgentOVaultCoreModule.sol";
import {CreatorOVaultCoreModule} from "@4626/creator/vault/modules/CreatorOVaultCoreModule.sol";
import {
    DeploymentBatcher,
    DeploymentBatcherPhase1Module,
    DeploymentBatcherPhase2Module
} from "@4626/shared/deploy/batchers/DeploymentBatcher.sol";
import {IOVaultModuleIdentity} from "@4626/shared/interfaces/vault/IOVaultModuleIdentity.sol";
import {OVaultAdminModule} from "@4626/shared/vault/modules/OVaultAdminModule.sol";
import {OVaultStrategiesModule} from "@4626/shared/vault/modules/OVaultStrategiesModule.sol";

/// @notice Rehearses the v1.19.3 Phase1 + Phase2 hot swap against the live
///         v1.19.1 greenfield batcher shell without broadcasting to Base.
contract DeploymentBatcherV193ModuleHotSwapForkTest is Test {
    address constant LIVE_BATCHER = 0xa18169caf37fa0347285B16aAFC2B09eCB43F145;
    address constant LIVE_LOTTERY_MANAGER = 0xB45E68a5867935a5734E4185977F81c528006650;
    bytes32 constant MODULE_STORAGE_V5 = keccak256("OVaultModuleStorage.v5");

    DeploymentBatcher internal batcher;
    DeploymentBatcherPhase1Module internal phase1;
    DeploymentBatcherPhase2Module internal phase2;

    function setUp() public {
        if (!_forkEnabled()) return;

        vm.createSelectFork(vm.envString("BASE_RPC_URL"));
        batcher = DeploymentBatcher(LIVE_BATCHER);

        DeploymentBatcherPhase1Module previousPhase1 = batcher.phase1Module();
        CreatorOVaultCoreModule creatorCore = new CreatorOVaultCoreModule();
        AgentOVaultCoreModule agentCore = new AgentOVaultCoreModule();
        OVaultStrategiesModule strategies = new OVaultStrategiesModule();
        OVaultAdminModule admin = new OVaultAdminModule();

        phase1 = new DeploymentBatcherPhase1Module(
            address(previousPhase1.create2Deployer()),
            address(previousPhase1.bytecodeStore()),
            previousPhase1.registry(),
            address(creatorCore),
            address(agentCore),
            address(strategies),
            address(admin),
            previousPhase1.vaultActivationBatcher(),
            address(previousPhase1.utilsHelper()),
            LIVE_BATCHER
        );

        phase2 = new DeploymentBatcherPhase2Module(
            address(batcher.create2Deployer()),
            address(batcher.registry()),
            batcher.chainlinkEthUsd(),
            batcher.poolManager(),
            batcher.taxHook(),
            batcher.protocolTreasury(),
            LIVE_LOTTERY_MANAGER,
            batcher.vaultActivationBatcher(),
            LIVE_BATCHER
        );

        vm.startPrank(batcher.protocolTreasury());
        batcher.approvePhaseModuleCodehash(address(phase1), address(phase1).codehash);
        batcher.setPhase1Module(address(phase1));
        batcher.approvePhaseModuleCodehash(address(phase2), address(phase2).codehash);
        batcher.setPhase2Module(address(phase2));
        vm.stopPrank();
    }

    function test_fork_v193ModuleHotSwapPreservesLiveShellDependencies() public view {
        if (!_forkEnabled()) return;

        assertEq(address(batcher.phase1Module()), address(phase1), "Phase1 hot swap");
        assertEq(address(batcher.phase2Module()), address(phase2), "Phase2 hot swap");
        assertEq(phase1.batcher(), LIVE_BATCHER, "Phase1 batcher");
        assertEq(phase2.batcher(), LIVE_BATCHER, "Phase2 batcher");
        assertEq(phase2.lotteryManager(), LIVE_LOTTERY_MANAGER, "Phase2 lottery manager");
        assertEq(address(phase1.create2Deployer()), address(batcher.create2Deployer()), "CREATE2 deployer");
        assertEq(address(phase1.bytecodeStore()), address(batcher.bytecodeStore()), "bytecode store");
        assertEq(phase1.registry(), address(batcher.registry()), "registry");
        assertEq(phase1.vaultActivationBatcher(), batcher.vaultActivationBatcher(), "activation batcher");
        assertEq(phase1.batcher(), phase2.batcher(), "module shell parity");

        assertEq(
            IOVaultModuleIdentity(phase1.vaultCoreModule()).moduleStorageVersion(),
            MODULE_STORAGE_V5,
            "creator core fingerprint"
        );
        assertEq(
            IOVaultModuleIdentity(phase1.agentVaultCoreModule()).moduleStorageVersion(),
            MODULE_STORAGE_V5,
            "agent core fingerprint"
        );
        assertEq(
            IOVaultModuleIdentity(phase1.vaultStrategiesModule()).moduleStorageVersion(),
            MODULE_STORAGE_V5,
            "strategies fingerprint"
        );
        assertEq(
            IOVaultModuleIdentity(phase1.vaultAdminModule()).moduleStorageVersion(),
            MODULE_STORAGE_V5,
            "admin fingerprint"
        );
    }

    function _forkEnabled() internal view returns (bool) {
        return vm.envOr("RUN_FORK_TESTS", uint256(0)) == 1 && bytes(vm.envOr("BASE_RPC_URL", string(""))).length > 0;
    }
}
