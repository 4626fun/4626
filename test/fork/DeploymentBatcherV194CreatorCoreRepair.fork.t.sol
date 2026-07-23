// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";

import {CreatorOVaultCoreModule} from "@4626/creator/vault/modules/CreatorOVaultCoreModule.sol";
import {DeploymentBatcher, DeploymentBatcherPhase1Module} from "@4626/shared/deploy/batchers/DeploymentBatcher.sol";
import {IOVaultModuleIdentity} from "@4626/shared/interfaces/vault/IOVaultModuleIdentity.sol";

/// @notice Rehearses the creator-core-only repair and a fresh AKITA Phase 1 on
///         a Base mainnet fork. No broadcast is performed by this test.
contract DeploymentBatcherV194CreatorCoreRepairForkTest is Test {
    address constant LIVE_BATCHER = 0xa18169caf37fa0347285B16aAFC2B09eCB43F145;
    address constant LIVE_LOTTERY_MANAGER = 0xB45E68a5867935a5734E4185977F81c528006650;
    address constant AKITA = 0x5b674196812451B7cEC024FE9d22D2c0b172fa75;
    address constant CANONICAL_CSW = 0xAb6d5C10b03300326CD7fAb7267Ae192842967b5;

    bytes32 constant MODULE_STORAGE_V5 = keccak256("OVaultModuleStorage.v5");
    bytes32 constant MODULES_SET_TOPIC = keccak256("ModulesSet(address,address,address)");

    DeploymentBatcher internal batcher;
    DeploymentBatcherPhase1Module internal previousPhase1;
    DeploymentBatcherPhase1Module internal replacementPhase1;
    CreatorOVaultCoreModule internal replacementCreatorCore;
    address internal previousPhase2;

    function setUp() public {
        if (!_forkEnabled()) return;

        vm.createSelectFork(vm.envString("BASE_RPC_URL"));
        batcher = DeploymentBatcher(LIVE_BATCHER);
        previousPhase1 = batcher.phase1Module();
        previousPhase2 = address(batcher.phase2Module());

        replacementCreatorCore = new CreatorOVaultCoreModule();
        replacementPhase1 = new DeploymentBatcherPhase1Module(
            address(previousPhase1.create2Deployer()),
            address(previousPhase1.bytecodeStore()),
            previousPhase1.registry(),
            address(replacementCreatorCore),
            previousPhase1.agentVaultCoreModule(),
            previousPhase1.vaultStrategiesModule(),
            previousPhase1.vaultAdminModule(),
            previousPhase1.vaultActivationBatcher(),
            address(previousPhase1.utilsHelper()),
            LIVE_BATCHER
        );

        vm.startPrank(batcher.protocolTreasury());
        batcher.approvePhaseModuleCodehash(address(replacementPhase1), address(replacementPhase1).codehash);
        batcher.setPhase1Module(address(replacementPhase1));
        vm.stopPrank();
    }

    function test_fork_creatorCoreOnlyRepairPreservesLiveDependenciesAndLottery() public view {
        if (!_forkEnabled()) return;

        assertEq(address(batcher.phase1Module()), address(replacementPhase1), "Phase1 repair not wired");
        assertEq(replacementPhase1.batcher(), LIVE_BATCHER, "Phase1 batcher changed");
        assertEq(
            address(replacementPhase1.create2Deployer()),
            address(previousPhase1.create2Deployer()),
            "CREATE2 deployer changed"
        );
        assertEq(
            address(replacementPhase1.bytecodeStore()),
            address(previousPhase1.bytecodeStore()),
            "bytecode store changed"
        );
        assertEq(replacementPhase1.registry(), previousPhase1.registry(), "registry changed");
        assertEq(replacementPhase1.agentVaultCoreModule(), previousPhase1.agentVaultCoreModule(), "Agent core changed");
        assertEq(
            replacementPhase1.vaultStrategiesModule(), previousPhase1.vaultStrategiesModule(), "Strategies changed"
        );
        assertEq(replacementPhase1.vaultAdminModule(), previousPhase1.vaultAdminModule(), "Admin changed");
        assertEq(address(batcher.phase2Module()), previousPhase2, "Phase2 changed");
        assertEq(batcher.lotteryManager(), LIVE_LOTTERY_MANAGER, "LotteryManager changed");
        assertEq(
            IOVaultModuleIdentity(address(replacementCreatorCore)).moduleStorageVersion(),
            MODULE_STORAGE_V5,
            "replacement Creator core storage fingerprint"
        );
    }

    function test_fork_freshAkitaPhase1UsesReplacementCreatorCore() public {
        if (!_forkEnabled()) return;

        DeploymentBatcher.Phase1Params memory params = DeploymentBatcher.Phase1Params({
            creatorToken: AKITA,
            owner: CANONICAL_CSW,
            vaultName: "AKITA Vault",
            vaultSymbol: "vAKITA",
            shareName: "AKITA Vault Share",
            shareSymbol: unicode"■AKITA",
            version: "v1.19.4-akita-fork-rehearsal",
            vaultKind: DeploymentBatcher.VaultKind.Creator
        });
        DeploymentBatcher.CodeIds memory codeIds = _creatorCodeIds();

        vm.prank(CANONICAL_CSW);
        vm.expectRevert(
            abi.encodeWithSelector(
                DeploymentBatcher.CodeIdNotApproved.selector,
                bytes32(0x9bb42a9ec995799d84d43a6915238d181fa5d13092365d2420fbd1e2123ab723)
            )
        );
        batcher.deployPhase1CoreWithSalt(params, codeIds, bytes32(0));

        vm.prank(batcher.protocolTreasury());
        batcher.setApprovedCodeIds(_akitaV193CodeIds(), true);

        vm.recordLogs();
        vm.prank(CANONICAL_CSW);
        DeploymentBatcher.Phase1Result memory core = batcher.deployPhase1CoreWithSalt(params, codeIds, bytes32(0));
        Vm.Log[] memory logs = vm.getRecordedLogs();

        assertGt(core.vault.code.length, 0, "fresh AKITA vault missing");
        assertGt(core.wrapper.code.length, 0, "fresh AKITA wrapper missing");
        assertTrue(
            _sawModulesSet(
                logs,
                core.vault,
                address(replacementCreatorCore),
                replacementPhase1.vaultStrategiesModule(),
                replacementPhase1.vaultAdminModule()
            ),
            "fresh AKITA vault did not bind replacement modules"
        );

        vm.prank(CANONICAL_CSW);
        DeploymentBatcher.Phase1Result memory finalized = batcher.finalizePhase1WithSalt(params, codeIds, bytes32(0));
        assertEq(finalized.vault, core.vault, "vault changed during finalize");
        assertEq(finalized.wrapper, core.wrapper, "wrapper changed during finalize");
        assertGt(finalized.shareOFT.code.length, 0, "fresh AKITA ShareOFT missing");
        assertEq(address(batcher.phase2Module()), previousPhase2, "AKITA Phase1 changed Phase2");
        assertEq(batcher.lotteryManager(), LIVE_LOTTERY_MANAGER, "AKITA Phase1 changed LotteryManager");
    }

    function _creatorCodeIds() internal pure returns (DeploymentBatcher.CodeIds memory codeIds) {
        codeIds.vault = 0x9bb42a9ec995799d84d43a6915238d181fa5d13092365d2420fbd1e2123ab723;
        codeIds.wrapper = 0xb0fcecd3983d8e2d9abc95ad54f856b19593277958eb56b6ecea07815e5c680b;
        codeIds.shareOFT = 0x8c9de580c15c346d3754b98ea5fb77cdf20f03138bb8e92480eba400769a1c36;
        codeIds.gauge = 0xab01c10b502870f8c98d0536fcc5f36f3a0807565b5306e57c4ef4b4f909500b;
        codeIds.cca = 0x820ce7118b75c4582c75c363afd768788720c126e7c32b29a53dcf7916aec085;
        codeIds.oracle = 0x00d8de27c2775fb6f315b1f2f67948a39db99a8d5e1b8364808de0577717526d;
        codeIds.oftBootstrap = 0xb4e332b02f3bacec4db7d40990c9a1667116dfafb521acbd96ba623e19005546;
    }

    function _akitaV193CodeIds() internal pure returns (bytes32[] memory codeIds) {
        codeIds = new bytes32[](8);
        codeIds[0] = 0x9bb42a9ec995799d84d43a6915238d181fa5d13092365d2420fbd1e2123ab723;
        codeIds[1] = 0xb0fcecd3983d8e2d9abc95ad54f856b19593277958eb56b6ecea07815e5c680b;
        codeIds[2] = 0x8c9de580c15c346d3754b98ea5fb77cdf20f03138bb8e92480eba400769a1c36;
        codeIds[3] = 0xab01c10b502870f8c98d0536fcc5f36f3a0807565b5306e57c4ef4b4f909500b;
        codeIds[4] = 0x7dd5594065984da6d5dd380e0804cbc9554acbb8c3c003f539bd61f291101c5d;
        codeIds[5] = 0x3fa4c424c567e6e106d9a76e004f96c35d5d39706cb765f73adbeddb223d5b39;
        codeIds[6] = 0xfb600532bbb0d49a8cd4d8cb018d743e9c6802f10d8487ea92869c07cf6a5f7f;
        codeIds[7] = 0x408b225f576c1345b59f58c64ab0932a0f69841928a7e9a88777d24ee3193bca;
    }

    function _sawModulesSet(Vm.Log[] memory logs, address vault, address creatorCore, address strategies, address admin)
        internal
        pure
        returns (bool)
    {
        for (uint256 i = 0; i < logs.length; i++) {
            Vm.Log memory entry = logs[i];
            if (
                entry.emitter == vault && entry.topics.length == 4 && entry.topics[0] == MODULES_SET_TOPIC
                    && address(uint160(uint256(entry.topics[1]))) == creatorCore
                    && address(uint160(uint256(entry.topics[2]))) == strategies
                    && address(uint160(uint256(entry.topics[3]))) == admin
            ) return true;
        }
        return false;
    }

    function _forkEnabled() internal view returns (bool) {
        return vm.envOr("RUN_FORK_TESTS", uint256(0)) == 1 && bytes(vm.envOr("BASE_RPC_URL", string(""))).length != 0;
    }
}
