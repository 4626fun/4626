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
}

contract SeedCreatorRegistryConfigTest is Test {
    address internal constant LIVE_REGISTRY = 0x9D86e8FAfA39527c4FE13AAa8FBD2B424f9f65Fb;
    address internal constant LIVE_CREATOR_FACTORY = 0xC7E919899Fd4C0C4f6f4269a63046107f85848bB;
    address internal constant LIVE_VAULT_BATCHER = 0x004684670d284EF607E1B2424fcf8ccBda8ef828;
    address internal constant LIVE_VAULT_ACT_BATCHER = 0x7Cc0050842433968cc7A0884d192b61FD0b46F63;
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
}
