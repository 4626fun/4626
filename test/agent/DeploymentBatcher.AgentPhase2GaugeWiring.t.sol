// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {DeploymentBatcher, DeploymentBatcherPhase2Module} from "@4626/shared/deploy/batchers/DeploymentBatcher.sol";

contract MockDualLaneGauge {
    address public creatorCoin;
    address public agentToken;

    function setCreatorCoin(address token) external {
        creatorCoin = token;
    }

    function setAgentToken(address token) external {
        agentToken = token;
    }
}

contract Phase2GaugeWiringProbe is DeploymentBatcherPhase2Module {
    constructor(
        address _create2Deployer,
        address _registry,
        address _chainlinkEthUsd,
        address _poolManager,
        address _taxHook,
        address _protocolTreasury,
        address _lotteryManager,
        address _vaultActivationBatcher,
        address _batcher
    )
        DeploymentBatcherPhase2Module(
            _create2Deployer,
            _registry,
            _chainlinkEthUsd,
            _poolManager,
            _taxHook,
            _protocolTreasury,
            _lotteryManager,
            _vaultActivationBatcher,
            _batcher
        )
    {}

    function wireGaugeAssetToken(
        address gaugeController,
        address assetToken,
        DeploymentBatcher.VaultKind vaultKind
    ) external {
        _wireGaugeAssetToken(gaugeController, assetToken, vaultKind);
    }
}

contract DeploymentBatcherAgentPhase2GaugeWiringTest is Test {
    Phase2GaugeWiringProbe internal probe;
    MockDualLaneGauge internal gauge;
    address internal assetToken = makeAddr("assetToken");

    function setUp() public {
        probe = new Phase2GaugeWiringProbe(
            makeAddr("create2"),
            makeAddr("registry"),
            makeAddr("chainlink"),
            makeAddr("poolManager"),
            makeAddr("taxHook"),
            makeAddr("treasury"),
            makeAddr("lottery"),
            address(0),
            address(this)
        );
        gauge = new MockDualLaneGauge();
    }

    function test_wireGaugeAssetToken_creatorLaneUsesSetCreatorCoin() public {
        probe.wireGaugeAssetToken(address(gauge), assetToken, DeploymentBatcher.VaultKind.Creator);
        assertEq(gauge.creatorCoin(), assetToken);
        assertEq(gauge.agentToken(), address(0));
    }

    function test_wireGaugeAssetToken_agentLaneUsesSetAgentToken() public {
        probe.wireGaugeAssetToken(address(gauge), assetToken, DeploymentBatcher.VaultKind.Agent);
        assertEq(gauge.agentToken(), assetToken);
        assertEq(gauge.creatorCoin(), address(0));
    }
}
