// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {RouteCoherenceChecker} from "../contracts/helpers/batchers/RouteCoherenceChecker.sol";
import {ICreatorRegistry} from "../contracts/interfaces/core/ICreatorRegistry.sol";

contract MockRegistryRouteCoherence {
    mapping(address => ICreatorRegistry.CreatorCoinInfo) internal infoByToken;

    function setCreatorCoinInfo(
        address token,
        address vault,
        address shareOFT,
        address oracle,
        address gaugeController,
        bool isActive
    ) external {
        ICreatorRegistry.CreatorCoinInfo storage info = infoByToken[token];
        info.token = token;
        info.vault = vault;
        info.shareOFT = shareOFT;
        info.oracle = oracle;
        info.gaugeController = gaugeController;
        info.isActive = isActive;
    }

    function getCreatorCoin(address token) external view returns (ICreatorRegistry.CreatorCoinInfo memory) {
        return infoByToken[token];
    }
}

contract RouteCoherenceIntegrationTest is Test {
    RouteCoherenceChecker internal checker;
    MockRegistryRouteCoherence internal registry;

    address internal creatorToken = makeAddr("creatorToken");
    address internal expectedVault = makeAddr("vault");
    address internal expectedShareOFT = makeAddr("shareOFT");
    address internal expectedOracle = makeAddr("oracle");
    address internal expectedGauge = makeAddr("gauge");

    function setUp() public {
        vm.chainId(8453);
        registry = new MockRegistryRouteCoherence();
        registry.setCreatorCoinInfo(
            creatorToken, expectedVault, expectedShareOFT, expectedOracle, expectedGauge, true
        );

        checker = new RouteCoherenceChecker(address(registry));
    }

    function test_routeCoherence_failsOnDrift_passesAfterRepair() external {
        RouteCoherenceChecker.RouteCoherenceStatus memory status = checker.checkRouteCoherence(
            creatorToken, expectedVault, expectedShareOFT, expectedOracle, expectedGauge
        );
        assertTrue(status.ok, "baseline coherence must pass");
        assertEq(status.mismatchBitmap, 0, "baseline mismatch bitmap");

        // Drift one endpoint.
        registry.setCreatorCoinInfo(
            creatorToken, expectedVault, expectedShareOFT, makeAddr("driftOracle"), expectedGauge, true
        );
        status = checker.checkRouteCoherence(
            creatorToken, expectedVault, expectedShareOFT, expectedOracle, expectedGauge
        );
        assertFalse(status.ok, "coherence should fail after drift");
        assertEq(status.mismatchBitmap, 4, "oracle mismatch bit expected");

        // Repair drift.
        registry.setCreatorCoinInfo(
            creatorToken, expectedVault, expectedShareOFT, expectedOracle, expectedGauge, true
        );
        status = checker.checkRouteCoherence(
            creatorToken, expectedVault, expectedShareOFT, expectedOracle, expectedGauge
        );
        assertTrue(status.ok, "coherence should pass after repair");
        assertEq(status.mismatchBitmap, 0, "mismatch should clear after repair");
    }

    function test_settledFlow_requiresCoherencePass() external {
        _requireCoherentBeforeSettle();

        registry.setCreatorCoinInfo(
            creatorToken, expectedVault, expectedShareOFT, makeAddr("driftOracle"), expectedGauge, true
        );
        RouteCoherenceChecker.RouteCoherenceStatus memory status = checker.checkRouteCoherence(
            creatorToken, expectedVault, expectedShareOFT, expectedOracle, expectedGauge
        );
        assertFalse(status.ok, "drift should fail coherence check");
        assertEq(status.mismatchBitmap, 4, "expected oracle drift bit");

        vm.expectRevert("route_coherence_failed");
        this.requireCoherenceExternal();
    }

    function _requireCoherentBeforeSettle() internal view {
        RouteCoherenceChecker.RouteCoherenceStatus memory status = checker.checkRouteCoherence(
            creatorToken, expectedVault, expectedShareOFT, expectedOracle, expectedGauge
        );
        require(status.ok, "route_coherence_failed");
    }

    function requireCoherenceExternal() external view {
        _requireCoherentBeforeSettle();
    }
}

