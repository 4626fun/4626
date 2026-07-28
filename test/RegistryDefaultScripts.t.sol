// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {DeployTier1Upgrade} from "script/DeployTier1Upgrade.s.sol";
import {DeployRewardsEcosystem} from "script/DeployRewardsEcosystem.s.sol";
import {DeployBaseMainnetDeployer} from "script/DeployBaseMainnetDeployer.s.sol";

contract DeployTier1UpgradeHarness is DeployTier1Upgrade {
    function exposedRegistry() external pure returns (address) {
        return REGISTRY;
    }
}

contract DeployRewardsEcosystemHarness is DeployRewardsEcosystem {
    function exposedDefaultRegistry() external pure returns (address) {
        return DEFAULT_REGISTRY;
    }

    function exposedDefaultLotteryManager() external pure returns (address) {
        return DEFAULT_LOTTERY_MANAGER;
    }

    function exposedDefaultProtocolTreasury() external pure returns (address) {
        return DEFAULT_PROTOCOL_TREASURY;
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
    /// @dev Legacy pin still used by DeployTier1Upgrade (pre-v1.18 script).
    address internal constant LEGACY_REGISTRY = 0xDD7B106a15540bA2F59464590222bF47D8C9394E;

    /// @dev v1.20.0-greenfield pins (SeedRegistry / RewardsEcosystem / BaseMainnetDeployer /
    ///      docs/reference/addresses.md).
    address internal constant LIVE_REGISTRY = 0xF60a1490C4129f2b6ae540734D3C2C8C6111824e;
    address internal constant LIVE_VAULT_ACT_BATCHER = 0x37A9136dcD3e3245E4E992a1302dfEBD3d8673B3;
    address internal constant LIVE_LOTTERY_MANAGER = 0x0fC6f30adFD9e82097895Bb166536FdFD8EaC97b;
    address internal constant LIVE_PROTOCOL_TREASURY = 0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3;

    DeployTier1UpgradeHarness internal tier1Upgrade;
    DeployRewardsEcosystemHarness internal rewardsEcosystem;
    DeployBaseMainnetDeployerHarness internal baseMainnetDeployer;

    function setUp() external {
        tier1Upgrade = new DeployTier1UpgradeHarness();
        rewardsEcosystem = new DeployRewardsEcosystemHarness();
        baseMainnetDeployer = new DeployBaseMainnetDeployerHarness();
    }

    function testTier1UpgradeUsesLiveRegistryDefault() external view {
        assertEq(tier1Upgrade.exposedRegistry(), LEGACY_REGISTRY);
    }

    function testRewardsEcosystemUsesLiveV1200Defaults() external view {
        assertEq(rewardsEcosystem.exposedDefaultRegistry(), LIVE_REGISTRY);
        assertEq(rewardsEcosystem.exposedDefaultLotteryManager(), LIVE_LOTTERY_MANAGER);
        assertEq(rewardsEcosystem.exposedDefaultProtocolTreasury(), LIVE_PROTOCOL_TREASURY);
    }

    function testBaseMainnetDeployerUsesLiveSharedGlobalDefaults() external view {
        assertEq(baseMainnetDeployer.exposedDefaultRegistry(), LIVE_REGISTRY);
        assertEq(baseMainnetDeployer.exposedDefaultVaultActivationBatcher(), LIVE_VAULT_ACT_BATCHER);
        assertEq(baseMainnetDeployer.exposedDefaultLotteryManager(), LIVE_LOTTERY_MANAGER);
    }
}
