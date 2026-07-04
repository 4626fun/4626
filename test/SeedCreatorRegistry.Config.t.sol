// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {SeedCreatorRegistry} from "../script/SeedCreatorRegistry.s.sol";

contract SeedCreatorRegistryHarness is SeedCreatorRegistry {
    function exposedDefaultRegistry() external pure returns (address) {
        return DEFAULT_REGISTRY;
    }

    function exposedCreatorFactory() external pure returns (address) {
        return CREATOR_FACTORY;
    }

    function exposedVaultBatcher() external pure returns (address) {
        return VAULT_BATCHER;
    }

    function exposedVaultActivationBatcher() external pure returns (address) {
        return VAULT_ACT_BATCHER;
    }

    function exposedMonadChainId() external pure returns (uint256) {
        return MONAD_CHAIN_ID;
    }

    function exposedMonadEid() external pure returns (uint32) {
        return MONAD_EID;
    }

    function exposedRobinhoodChainId() external pure returns (uint256) {
        return ROBINHOOD_CHAIN_ID;
    }

    function exposedRobinhoodEid() external pure returns (uint32) {
        return ROBINHOOD_EID;
    }

    function exposedRobinhoodLzEndpoint() external pure returns (address) {
        return ROBINHOOD_LZ_ENDPOINT;
    }
}

contract SeedCreatorRegistryConfigTest is Test {
    // v1.15.0 greenfield cutover addresses (tmp/base-v1.15.0-handoff.env)
    address internal constant LIVE_REGISTRY = 0x1eb9A364a3E763dD9249ba3413Dc19E13c1F4461;
    address internal constant LIVE_CREATOR_FACTORY = 0x26b74b1d3AadD17e714068d259051409C9f942d1;
    address internal constant LIVE_VAULT_BATCHER = 0x17163e67dED6B45bd2A7E6a509A32fB7b0cB6D33;
    address internal constant LIVE_VAULT_ACT_BATCHER = 0xB06d99c81994F5829ba462c4afA78eCff75bC281;
    SeedCreatorRegistryHarness internal harness;

    function setUp() external {
        harness = new SeedCreatorRegistryHarness();
    }

    function testSeedScriptTargetsLiveCreatorRegistry() external view {
        assertEq(harness.exposedDefaultRegistry(), LIVE_REGISTRY);
    }

    function testSeedScriptAuthorizesLiveFactoryAndBatchers() external view {
        assertEq(harness.exposedCreatorFactory(), LIVE_CREATOR_FACTORY);
        assertEq(harness.exposedVaultBatcher(), LIVE_VAULT_BATCHER);
        assertEq(harness.exposedVaultActivationBatcher(), LIVE_VAULT_ACT_BATCHER);
    }

    function testMonadUsesCurrentMainnetMapping() external view {
        assertEq(harness.exposedMonadChainId(), 143);
        assertEq(harness.exposedMonadEid(), 30390);
    }

    function testRobinhoodUsesCurrentMainnetMapping() external view {
        assertEq(harness.exposedRobinhoodChainId(), 4663);
        assertEq(harness.exposedRobinhoodEid(), 30416);
        assertEq(harness.exposedRobinhoodLzEndpoint(), 0x6F475642a6e85809B1c36Fa62763669b1b48DD5B);
    }
}
