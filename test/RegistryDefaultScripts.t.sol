// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {DeployRewardsEcosystem} from "script/DeployRewardsEcosystem.s.sol";
import {DeployBaseMainnetDeployer} from "script/DeployBaseMainnetDeployer.s.sol";

contract DeployRewardsEcosystemHarness is DeployRewardsEcosystem {
    function exposedDefaultRegistry() external pure returns (address) {
        return DEFAULT_REGISTRY;
    }

    function exposedDefaultLotteryManager() external pure returns (address) {
        return DEFAULT_LOTTERY_MANAGER;
    }
}

contract DeployBaseMainnetDeployerHarness is DeployBaseMainnetDeployer {
    function exposedDefaultRegistry() external pure returns (address) {
        return DEFAULT_REGISTRY;
    }

    function exposedDefaultVaultActivationBatcher() external pure returns (address) {
        return DEFAULT_VAULT_ACTIVATION_BATCHER;
    }

    function exposedDefaultLotteryManager() external pure returns (address) {
        return DEFAULT_LOTTERY_MANAGER;
    }
}

contract RegistryDefaultScriptsTest is Test {
    address internal constant LIVE_REGISTRY = 0xDb8570Dd434b6fCb7f4463d1e7C6F01d4459A4E0;
    address internal constant LIVE_VAULT_ACT_BATCHER = 0x4c4B8113ED37D8Fc4564f867edAf2B8EC13264a3;
    address internal constant LIVE_LOTTERY_MANAGER = 0xB68F359e01626Ec5d15C624037311C70DacAba43;
    DeployRewardsEcosystemHarness internal rewardsEcosystem;
    DeployBaseMainnetDeployerHarness internal baseMainnetDeployer;

    function setUp() external {
        rewardsEcosystem = new DeployRewardsEcosystemHarness();
        baseMainnetDeployer = new DeployBaseMainnetDeployerHarness();
    }

    function testRewardsEcosystemUsesLiveV1180Defaults() external view {
        assertEq(rewardsEcosystem.exposedDefaultRegistry(), LIVE_REGISTRY);
        assertEq(rewardsEcosystem.exposedDefaultLotteryManager(), LIVE_LOTTERY_MANAGER);
    }

    function testBaseMainnetDeployerUsesLiveSharedGlobalDefaults() external view {
        assertEq(baseMainnetDeployer.exposedDefaultRegistry(), LIVE_REGISTRY);
        assertEq(baseMainnetDeployer.exposedDefaultVaultActivationBatcher(), LIVE_VAULT_ACT_BATCHER);
        assertEq(baseMainnetDeployer.exposedDefaultLotteryManager(), LIVE_LOTTERY_MANAGER);
    }
}
