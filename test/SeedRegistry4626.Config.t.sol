// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {SeedRegistry4626} from "script/SeedRegistry4626.s.sol";

contract SeedRegistry4626Harness is SeedRegistry4626 {
    function exposedDefaultRegistry() external pure returns (address) {
        return DEFAULT_REGISTRY;
    }

    function exposedOvaultFactory() external pure returns (address) {
        return OVAULT_FACTORY;
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

contract SeedRegistry4626ConfigTest is Test {
    // Pins must match script/SeedRegistry4626.s.sol constants (v1.20.0 greenfield).
    address internal constant LIVE_REGISTRY = 0xF60a1490C4129f2b6ae540734D3C2C8C6111824e;
    address internal constant LIVE_OVAULT_FACTORY = 0x29AB55092F4009aa3F3603f32b11A6B02e6F0eb5;
    address internal constant LIVE_VAULT_BATCHER = 0x83A9b2481E3e6d3a8fA12F6eB072253AAc518032;
    address internal constant LIVE_VAULT_ACT_BATCHER = 0x37A9136dcD3e3245E4E992a1302dfEBD3d8673B3;
    SeedRegistry4626Harness internal harness;

    function setUp() external {
        harness = new SeedRegistry4626Harness();
    }

    function testSeedScriptTargetsLiveRegistry4626() external view {
        assertEq(harness.exposedDefaultRegistry(), LIVE_REGISTRY);
    }

    function testSeedScriptAuthorizesLiveFactoryAndBatchers() external view {
        assertEq(harness.exposedOvaultFactory(), LIVE_OVAULT_FACTORY);
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
