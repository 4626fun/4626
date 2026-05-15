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
    address internal constant LIVE_REGISTRY = 0x3f64087dc361Ad52300409E5873b26941D6418B6;
    address internal constant LIVE_CREATOR_FACTORY = 0x09a2fd817F30D2599fb13520d06751259b6AdcFE;
    address internal constant LIVE_VAULT_BATCHER = 0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8;
    address internal constant LIVE_VAULT_ACT_BATCHER = 0x5036FB536f53b15307825eB2006B21E22f0F3193;
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
