// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {
    DeploymentBatcher,
    DeploymentBatcherPhase1Module,
    DeploymentBatcherPhase2Module
} from "@4626/shared/deploy/batchers/DeploymentBatcher.sol";
import "test/helpers/DeploymentBatcherFixture.sol";

/// @notice AUDIT-2026-07-08 P1: H-08 module codehash + NEW-H codeId allowlist.
contract Audit20260708_P1_BatcherSecurity is Test {
    address internal constant TREASURY = address(0xBEEF);

    DeploymentBatcher internal batcher;
    DeploymentBatcherFixture.Helpers internal helpers;

    function setUp() public {
        vm.chainId(8453);
        DeploymentBatcherFixture fixture = new DeploymentBatcherFixture();
        DeploymentBatcherFixture.BatcherConfig memory cfg = DeploymentBatcherFixture.BatcherConfig({
            registry: address(0x1001),
            bytecodeStore: address(0x1002),
            create2Deployer: address(0x1003),
            protocolTreasury: TREASURY,
            protocolAutomation: makeAddr("protocolAutomation"),
            poolManager: address(0x1004),
            taxHook: address(0x1005),
            chainlinkEthUsd: address(0x1006),
            vaultActivationBatcher: address(0x1007),
            lotteryManager: address(0x1008),
            permit2: address(0x1009),
            usdc: address(0x100A),
            uniswapV3Factory: address(0x100B),
            uniswapRouter: address(0x100C),
            ajnaFactory: address(0x100D),
            vaultCoreModule: address(0x100E),
            agentVaultCoreModule: address(0x100F),
            vaultStrategiesModule: address(0x1010),
            vaultAdminModule: address(0x1011)
        });
        (batcher, helpers) = fixture.deployBatcher(cfg);
    }

    function test_setPhase1Module_revertsWithoutCodehashApproval() public {
        // Fresh module address with no approval.
        address rogue = address(0xBAD1);
        vm.etch(rogue, hex"6001600055"); // minimal runtime
        vm.prank(TREASURY);
        vm.expectRevert(
            abi.encodeWithSelector(DeploymentBatcher.PhaseModuleCodehashNotApproved.selector, rogue)
        );
        batcher.setPhase1Module(rogue);
    }

    function test_setPhase1Module_revertsOnCodehashMismatch() public {
        address phase1 = address(helpers.phase1);
        // Overwrite approval with wrong hash.
        vm.prank(TREASURY);
        batcher.approvePhaseModuleCodehash(phase1, bytes32(uint256(0xdead)));
        vm.prank(TREASURY);
        vm.expectRevert(); // ModuleCodehashMismatch
        batcher.setPhase1Module(phase1);
    }

    function test_requireApprovedCodeId_enforcedWhenEnabled() public {
        bytes32 codeId = keccak256("evil-vault");
        // Fixture disabled allowlist — re-enable for this check.
        vm.prank(TREASURY);
        batcher.setCodeIdAllowlistEnabled(true);

        vm.expectRevert(abi.encodeWithSelector(DeploymentBatcher.CodeIdNotApproved.selector, codeId));
        batcher.requireApprovedCodeId(codeId);

        vm.prank(TREASURY);
        batcher.setApprovedCodeId(codeId, true);
        batcher.requireApprovedCodeId(codeId); // no revert
    }

    function test_freezeCodeIdAllowlist_blocksDisable() public {
        vm.startPrank(TREASURY);
        batcher.setCodeIdAllowlistEnabled(true);
        batcher.freezeCodeIdAllowlist();
        vm.expectRevert(DeploymentBatcher.CodeIdAllowlistFrozen.selector);
        batcher.setCodeIdAllowlistEnabled(false);
        vm.stopPrank();
        assertTrue(batcher.codeIdAllowlistEnabled());
        assertTrue(batcher.codeIdAllowlistFrozen());
    }

    function test_setApprovedCodeId_rejectsZero() public {
        vm.prank(TREASURY);
        vm.expectRevert(DeploymentBatcher.InvalidCodeId.selector);
        batcher.setApprovedCodeId(bytes32(0), true);
    }
}
