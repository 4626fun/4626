// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "../contracts/helpers/batchers/DeploymentBatcher.sol";

contract MockOwnableVaultForPhase3Bounds {
    address public owner;

    constructor(address owner_) {
        owner = owner_;
    }
}

contract DeploymentBatcherThreeWaySplitTest is Test {
    DeploymentBatcher internal batcher;
    MockOwnableVaultForPhase3Bounds internal vault;

    function setUp() public {
        vault = new MockOwnableVaultForPhase3Bounds(address(this));
        batcher = new DeploymentBatcher(
            makeAddr("registry"),
            makeAddr("bytecodeStore"),
            makeAddr("create2Deployer"),
            makeAddr("protocolTreasury"),
            makeAddr("poolManager"),
            makeAddr("taxHook"),
            makeAddr("chainlinkEthUsd"),
            makeAddr("vaultActivationBatcher"),
            makeAddr("lotteryManager"),
            makeAddr("permit2"),
            makeAddr("usdc"),
            makeAddr("uniswapV3Factory"),
            makeAddr("uniswapRouter"),
            makeAddr("ajnaFactory"),
            makeAddr("vaultCoreModule"),
            makeAddr("vaultStrategiesModule"),
            makeAddr("vaultAdminModule")
        );
    }

    function test_deployPhase3Strategies_revertsWhenTotalWeightExceeds10000() public {
        DeploymentBatcher.Phase3Params memory params = DeploymentBatcher.Phase3Params({
            creatorToken: makeAddr("creatorToken"),
            owner: address(this),
            vault: address(vault),
            version: "v1",
            initialSqrtPriceX96: 0,
            charmVaultName: "Charm Vault",
            charmVaultSymbol: "CHRM",
            ajnaVaultName: "Ajna Inner Vault",
            ajnaVaultSymbol: "AIV",
            charmWeightBps: 7_000,
            ajnaWeightBps: 2_000,
            solanaWeightBps: 1_100,
            ajnaBufferRatioBps: 1_000,
            ajnaMinBucketIndex: 4_156,
            ajnaKeeper: makeAddr("ajnaKeeper"),
            solanaKeeper: makeAddr("solanaKeeper"),
            solanaMaxNavAge: 3600,
            solanaMaxNavDeltaBpsPerUpdate: 500,
            solanaMinBaseLiquidityBps: 1_000,
            solanaBridgeAddress: makeAddr("solanaBridge"),
            enableAutoAllocate: false
        });

        DeploymentBatcher.StrategyCodeIds memory codeIds = DeploymentBatcher.StrategyCodeIds({
            charmAlphaVaultDeploy: bytes32(uint256(1)),
            creatorCharmStrategy: bytes32(uint256(2)),
            ajnaVaultAuth: bytes32(uint256(3)),
            ajnaVault: bytes32(uint256(4)),
            erc4626StrategyAdapter: bytes32(uint256(5)),
            solanaStrategy: bytes32(uint256(6))
        });

        vm.expectRevert(DeploymentBatcher.InvalidWeight.selector);
        batcher.deployPhase3Strategies(params, codeIds);
    }

    function test_phase1SaltOverrideEntrypoints_areDisabled() public {
        DeploymentBatcher.Phase1Params memory params = DeploymentBatcher.Phase1Params({
            creatorToken: makeAddr("creatorToken"),
            owner: address(this),
            vaultName: "Creator OVault",
            vaultSymbol: "ovCR8R",
            shareName: "Creator Share",
            shareSymbol: "sCR8R",
            version: "v1"
        });
        DeploymentBatcher.CodeIds memory codeIds = DeploymentBatcher.CodeIds({
            vault: bytes32(uint256(1)),
            wrapper: bytes32(uint256(2)),
            shareOFT: bytes32(uint256(3)),
            gauge: bytes32(uint256(4)),
            cca: bytes32(uint256(5)),
            oracle: bytes32(uint256(6)),
            oftBootstrap: bytes32(uint256(7))
        });

        bytes32 saltOverride = keccak256("custom-share-oft-salt");

        vm.expectRevert(DeploymentBatcher.SaltOverrideDisabled.selector);
        batcher.deployPhase1CoreWithSalt(params, codeIds, saltOverride);

        vm.expectRevert(DeploymentBatcher.SaltOverrideDisabled.selector);
        batcher.finalizePhase1WithSalt(params, codeIds, saltOverride);
    }

    function test_phase2ShareSplitAndDepositBounds_remainFixed() public view {
        assertEq(batcher.MIN_DEPOSIT(), 50_000_000e18, "minimum first deposit drifted");
        assertEq(batcher.MAX_DEPOSIT(), 50_000_000e18, "maximum first deposit drifted");
        assertEq(batcher.AUCTION_PERCENT(), 40, "CCA split drifted");
        assertEq(batcher.VESTING_PERCENT(), 40, "creator vesting split drifted");
        assertEq(100 - batcher.AUCTION_PERCENT() - batcher.VESTING_PERCENT(), 20, "LP reserve split drifted");
    }
}
