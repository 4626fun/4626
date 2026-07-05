// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {MockAgentTokenV4} from "test/mocks/MockAgentTokenV4.sol";
import {AgentOVault} from "@4626/vault/agent/AgentOVault.sol";
import {AgentOVaultCoreModule} from "@4626/vault/agent/modules/AgentOVaultCoreModule.sol";
import {CreatorOVaultAdminModule} from "@4626/vault/creator/modules/CreatorOVaultAdminModule.sol";
import {CreatorOVaultStrategiesModule} from "@4626/vault/creator/modules/CreatorOVaultStrategiesModule.sol";
import {I4626Registry} from "@4626/interfaces/core/I4626Registry.sol";
import {Registry4626} from "@4626/core/4626Registry.sol";

contract AgentRegistryVaultKindTest is Test {
    Registry4626 internal registry;
    MockAgentTokenV4 internal token;

    function setUp() public {
        registry = new Registry4626(address(this));
        token = new MockAgentTokenV4("ATIKA", "ATIKA", 500, 500);
    }

    function test_setAgentIntegrationMeta() public {
        I4626Registry.AgentIntegrationMeta memory meta = I4626Registry.AgentIntegrationMeta({
            vaultKind: I4626Registry.VaultKind.Agent,
            nativeAgentVault: address(0xBEEF),
            taxRecipient: address(0),
            taxAccountingAdapter: address(0),
            pairToken: address(0xCAFE),
            uniswapV2Pair: address(0xDEAD),
            implementationFingerprint: bytes32(uint256(1))
        });
        registry.setAgentIntegrationMeta(address(token), meta);
        I4626Registry.AgentIntegrationMeta memory stored = registry.getAgentIntegrationMeta(address(token));
        assertEq(uint256(stored.vaultKind), uint256(I4626Registry.VaultKind.Agent));
        assertEq(uint256(registry.getVaultKind(address(token))), uint256(I4626Registry.VaultKind.Agent));
    }
}
