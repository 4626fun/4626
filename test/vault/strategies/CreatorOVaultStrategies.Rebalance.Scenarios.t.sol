// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {RebalanceTestHarness} from "./RebalanceTestHarness.sol";

/// @notice Runs 100 explicit rebalance edge-case scenarios against fresh vault instances.
contract CreatorOVaultStrategiesRebalanceScenariosTest is RebalanceTestHarness {
    function test_scenarioMatrix_hasExactly100Entries() external pure {
        RebalanceScenario[100] memory scenarios = _build100Scenarios();
        scenarios;
    }

    function test_rebalanceScenarios_batch00() external {
        _runScenarioBatch(0, 10);
    }

    function test_rebalanceScenarios_batch01() external {
        _runScenarioBatch(10, 20);
    }

    function test_rebalanceScenarios_batch02() external {
        _runScenarioBatch(20, 30);
    }

    function test_rebalanceScenarios_batch03() external {
        _runScenarioBatch(30, 40);
    }

    function test_rebalanceScenarios_batch04() external {
        _runScenarioBatch(40, 50);
    }

    function test_rebalanceScenarios_batch05() external {
        _runScenarioBatch(50, 60);
    }

    function test_rebalanceScenarios_batch06() external {
        _runScenarioBatch(60, 70);
    }

    function test_rebalanceScenarios_batch07() external {
        _runScenarioBatch(70, 80);
    }

    function test_rebalanceScenarios_batch08() external {
        _runScenarioBatch(80, 90);
    }

    function test_rebalanceScenarios_batch09() external {
        _runScenarioBatch(90, 100);
    }

    function test_scenarioByIndex(uint256 index) external {
        index = bound(index, 0, 99);
        RebalanceScenario[100] memory scenarios = _build100Scenarios();
        _runScenario(index, scenarios[index]);
    }

    function _runScenarioBatch(uint256 start, uint256 end) internal {
        RebalanceScenario[100] memory scenarios = _build100Scenarios();
        for (uint256 i = start; i < end; i++) {
            _runScenario(i, scenarios[i]);
        }
    }
}
