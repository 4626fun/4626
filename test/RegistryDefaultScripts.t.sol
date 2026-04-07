// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {DeployLotteryManagerCreate2} from "../script/DeployLotteryManagerCreate2.s.sol";
import {DeployTier1Upgrade} from "../script/DeployTier1Upgrade.s.sol";
import {DeployRewardsEcosystem} from "../script/DeployRewardsEcosystem.s.sol";

contract DeployLotteryManagerCreate2Harness is DeployLotteryManagerCreate2 {
    function exposedRegistry() external pure returns (address) {
        return REGISTRY;
    }
}

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

contract RegistryDefaultScriptsTest is Test {
    address internal constant LIVE_REGISTRY = 0x888506B92181c57A2fD06516FFFb6F375b7A4626;
    DeployLotteryManagerCreate2Harness internal lotteryManagerCreate2;
    DeployTier1UpgradeHarness internal tier1Upgrade;
    DeployRewardsEcosystemHarness internal rewardsEcosystem;

    function setUp() external {
        lotteryManagerCreate2 = new DeployLotteryManagerCreate2Harness();
        tier1Upgrade = new DeployTier1UpgradeHarness();
        rewardsEcosystem = new DeployRewardsEcosystemHarness();
    }

    function testLotteryManagerCreate2UsesLiveRegistryDefault() external view {
        assertEq(lotteryManagerCreate2.exposedRegistry(), LIVE_REGISTRY);
    }

    function testTier1UpgradeUsesLiveRegistryDefault() external view {
        assertEq(tier1Upgrade.exposedRegistry(), LIVE_REGISTRY);
    }

    function testRewardsEcosystemUsesLiveRegistryDefault() external view {
        assertEq(rewardsEcosystem.exposedDefaultRegistry(), LIVE_REGISTRY);
    }
}
