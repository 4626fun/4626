// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "../../contracts/helpers/batchers/DeploymentBatcher.sol";

/**
 * @title DeploymentBatcherPhase2ModuleHotSwap fork rehearsal
 * @notice Validates the live-shell + new-Phase2Module pairing on a Base mainnet fork
 *         before the production `setPhase2Module` hot-swap:
 *         1. deploys a fresh DeploymentBatcherPhase2Module from current source against
 *            the live batcher config,
 *         2. impersonates the protocol treasury Safe to hot-swap it,
 *         3. proves the widened [50M, 100M] first-deposit gate behaves through the
 *            live shell's delegatecall path (selector stability included).
 *
 * Run explicitly with:
 *   RUN_FORK_TESTS=1 BASE_RPC_URL=https://mainnet.base.org \
 *     forge test --match-path "test/fork/DeploymentBatcherPhase2ModuleHotSwap.fork.t.sol" -vv
 */
contract DeploymentBatcherPhase2ModuleHotSwapForkTest is Test {
    address constant LIVE_BATCHER = 0xa99058f424FB3ACC639F59355C65C40149030651;
    address constant AKITA = 0x5b674196812451B7cEC024FE9d22D2c0b172fa75;
    address constant CANONICAL_CSW = 0xAb6d5C10b03300326CD7fAb7267Ae192842967b5;

    DeploymentBatcher internal batcher;
    DeploymentBatcherPhase2Module internal newModule;

    function setUp() public {
        if (!_forkEnabled()) return;
        vm.createSelectFork(vm.envString("BASE_RPC_URL"));
        batcher = DeploymentBatcher(LIVE_BATCHER);

        newModule = new DeploymentBatcherPhase2Module(
            address(batcher.create2Deployer()),
            address(batcher.registry()),
            batcher.chainlinkEthUsd(),
            batcher.poolManager(),
            batcher.taxHook(),
            batcher.protocolTreasury(),
            batcher.lotteryManager(),
            batcher.vaultActivationBatcher(),
            LIVE_BATCHER
        );

        vm.prank(batcher.protocolTreasury());
        batcher.setPhase2Module(address(newModule));
        assertEq(address(batcher.phase2Module()), address(newModule), "hot-swap failed");
    }

    function test_fork_depositGate_throughLiveShell() public {
        if (!_forkEnabled()) {
            vm.skip(true);
            return;
        }

        // Out-of-range deposits must die at the new module's range gate.
        _expectFinalizeRevert(50_000_000e18 - 1, DeploymentBatcherPhase2Module.InvalidDepositAmount.selector);
        _expectFinalizeRevert(100_000_000e18 + 1, DeploymentBatcherPhase2Module.InvalidDepositAmount.selector);

        // In-range deposits pass the gate and surface the next check (no Phase-1
        // contracts exist for this synthetic version string -> Phase1Missing).
        _expectFinalizeRevert(50_000_000e18, DeploymentBatcherPhase2Module.Phase1Missing.selector);
        _expectFinalizeRevert(100_000_000e18, DeploymentBatcherPhase2Module.Phase1Missing.selector);
    }

    function _expectFinalizeRevert(uint256 depositAmount, bytes4 expectedSelector) internal {
        vm.prank(CANONICAL_CSW);
        IERC20(AKITA).approve(LIVE_BATCHER, depositAmount);

        DeploymentBatcher.Phase2FinalizeParams memory params;
        params.creatorToken = AKITA;
        params.owner = CANONICAL_CSW;
        params.vault = makeAddr("forkVault");
        params.wrapper = makeAddr("forkWrapper");
        params.shareOFT = makeAddr("forkShareOFT");
        params.gaugeController = makeAddr("forkGauge");
        params.ccaStrategy = makeAddr("forkCca");
        params.oracle = makeAddr("forkOracle");
        params.version = "fork-hot-swap-rehearsal";
        params.depositAmount = depositAmount;

        vm.prank(CANONICAL_CSW);
        vm.expectRevert(expectedSelector);
        batcher.finalizePhase2(params);
    }

    function _forkEnabled() internal view returns (bool) {
        return vm.envOr("RUN_FORK_TESTS", uint256(0)) == 1 && bytes(vm.envOr("BASE_RPC_URL", string(""))).length != 0;
    }
}
