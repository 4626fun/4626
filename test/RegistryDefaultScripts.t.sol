// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {DeployTier1Upgrade} from "../script/DeployTier1Upgrade.s.sol";
import {DeployRewardsEcosystem} from "../script/DeployRewardsEcosystem.s.sol";
import {DeployBaseMainnetDeployer} from "../script/DeployBaseMainnetDeployer.s.sol";

contract DeployTier1UpgradeHarness is DeployTier1Upgrade {
    function exposedRegistry() external pure returns (address) {
        return REGISTRY;
    }
}

contract DeployRewardsEcosystemHarness is DeployRewardsEcosystem {
    function exposedDefaultRegistry() external pure returns (address) {
        return DEFAULT_REGISTRY;
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
    address internal constant LIVE_REGISTRY = 0x9D86e8FAfA39527c4FE13AAa8FBD2B424f9f65Fb;
    address internal constant LIVE_VAULT_ACT_BATCHER = 0x7Cc0050842433968cc7A0884d192b61FD0b46F63;
    address internal constant LIVE_LOTTERY_MANAGER = 0xd593A8A58BDf7E7448D2dAbDE0Ae3B2BAFDA1357;
    DeployTier1UpgradeHarness internal tier1Upgrade;
    DeployRewardsEcosystemHarness internal rewardsEcosystem;
    DeployBaseMainnetDeployerHarness internal baseMainnetDeployer;

    function setUp() external {
        tier1Upgrade = new DeployTier1UpgradeHarness();
        rewardsEcosystem = new DeployRewardsEcosystemHarness();
        baseMainnetDeployer = new DeployBaseMainnetDeployerHarness();
    }

    function testTier1UpgradeUsesLiveRegistryDefault() external view {
        assertEq(tier1Upgrade.exposedRegistry(), LIVE_REGISTRY);
    }

    function testRewardsEcosystemUsesLiveRegistryDefault() external view {
        assertEq(rewardsEcosystem.exposedDefaultRegistry(), LIVE_REGISTRY);
    }

    function testBaseMainnetDeployerUsesLiveSharedGlobalDefaults() external view {
        assertEq(baseMainnetDeployer.exposedDefaultRegistry(), LIVE_REGISTRY);
        assertEq(baseMainnetDeployer.exposedDefaultVaultActivationBatcher(), LIVE_VAULT_ACT_BATCHER);
        assertEq(baseMainnetDeployer.exposedDefaultLotteryManager(), LIVE_LOTTERY_MANAGER);
    }
}
