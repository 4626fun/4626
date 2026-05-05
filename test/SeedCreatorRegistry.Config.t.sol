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
    address internal constant LIVE_REGISTRY = 0xa6216Ea21f4a4d190EdD453A51e4e015A44e60C4;
    address internal constant LIVE_CREATOR_FACTORY = 0x183b8825Bbe7d92be8F54F811EfF9C0dFe854F6E;
    address internal constant LIVE_VAULT_BATCHER = 0x271Ab2C53D79d52ddB14506a44133Fe3FA395332;
    address internal constant LIVE_VAULT_ACT_BATCHER = 0x681DC69607f6E8848a56819ce8C6d591E764187a;
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
