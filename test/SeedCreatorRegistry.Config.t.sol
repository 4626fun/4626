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
    address internal constant LIVE_REGISTRY = 0x79d0d68904BbB50361C9721CbDD17276E046771D;
    address internal constant LIVE_CREATOR_FACTORY = 0xb66aA49d94569a8589f380D53e8a3f1F60165000;
    address internal constant LIVE_VAULT_BATCHER = 0x721420F190cc4525bb8Adc72D4c66eEB806AFC37;
    address internal constant LIVE_VAULT_ACT_BATCHER = 0x8b63912cD2490D1Ab0796c57Cc5909fF0059CECd;
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
