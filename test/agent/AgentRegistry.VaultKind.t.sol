// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {MockAgentTokenV4} from "test/mocks/MockAgentTokenV4.sol";
import {AgentOVault} from "@4626/agent/vault/AgentOVault.sol";
import {AgentOVaultCoreModule} from "@4626/agent/vault/modules/AgentOVaultCoreModule.sol";
import {OVaultAdminModule} from "@4626/shared/vault/modules/OVaultAdminModule.sol";
import {OVaultStrategiesModule} from "@4626/shared/vault/modules/OVaultStrategiesModule.sol";
import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";
import {Registry4626} from "@4626/shared/core/Registry4626.sol";

contract AgentRegistryVaultKindTest is Test {
    Registry4626 internal registry;
    MockAgentTokenV4 internal token;

    function setUp() public {
        registry = new Registry4626(address(this));
        token = new MockAgentTokenV4("ATIKA", "ATIKA", 500, 500);
    }

    function test_setAgentIntegrationMeta() public {
        IRegistry4626.AgentIntegrationMeta memory meta = IRegistry4626.AgentIntegrationMeta({
            vaultKind: IRegistry4626.VaultKind.Agent,
            nativeAgentVault: address(0xBEEF),
            taxRecipient: address(0),
            taxAccountingAdapter: address(0),
            pairToken: address(0xCAFE),
            uniswapV2Pair: address(0xDEAD),
            implementationFingerprint: bytes32(uint256(1))
        });
        registry.setAgentIntegrationMeta(address(token), meta);
        IRegistry4626.AgentIntegrationMeta memory stored = registry.getAgentIntegrationMeta(address(token));
        assertEq(uint256(stored.vaultKind), uint256(IRegistry4626.VaultKind.Agent));
        assertEq(uint256(registry.getVaultKind(address(token))), uint256(IRegistry4626.VaultKind.Agent));
    }
}
