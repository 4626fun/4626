// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {MockAgentTokenV4} from "test/mocks/MockAgentTokenV4.sol";
import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";
import {Registry4626} from "@4626/shared/core/Registry4626.sol";

contract AgentRegistryVaultKindTest is Test {
    Registry4626 internal registry;
    MockAgentTokenV4 internal token;
    address internal factory = address(0xFACA);

    function setUp() public {
        registry = new Registry4626(address(this));
        token = new MockAgentTokenV4("ATIKA", "ATIKA", 500, 500);
        registry.registerToken(address(token), "ATIKA", "ATIKA", address(this), address(0), 0);
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

    function test_setAgentIntegrationMeta_authorizedFactory() public {
        registry.setAuthorizedFactory(factory, true);

        IRegistry4626.AgentIntegrationMeta memory meta = IRegistry4626.AgentIntegrationMeta({
            vaultKind: IRegistry4626.VaultKind.Agent,
            nativeAgentVault: address(0xBEEF),
            taxRecipient: address(0),
            taxAccountingAdapter: address(0),
            pairToken: address(0),
            uniswapV2Pair: address(0),
            implementationFingerprint: bytes32(0)
        });

        vm.prank(factory);
        registry.setAgentIntegrationMeta(address(token), meta);

        assertEq(uint256(registry.getVaultKind(address(token))), uint256(IRegistry4626.VaultKind.Agent));
    }

    function test_setAgentIntegrationMeta_unauthorizedReverts() public {
        IRegistry4626.AgentIntegrationMeta memory meta = IRegistry4626.AgentIntegrationMeta({
            vaultKind: IRegistry4626.VaultKind.Agent,
            nativeAgentVault: address(0),
            taxRecipient: address(0),
            taxAccountingAdapter: address(0),
            pairToken: address(0),
            uniswapV2Pair: address(0),
            implementationFingerprint: bytes32(0)
        });

        vm.prank(address(0xBAD));
        vm.expectRevert(Registry4626.NotAuthorized.selector);
        registry.setAgentIntegrationMeta(address(token), meta);
    }

    function test_getVaultKind_defaultsToCreator() public view {
        assertEq(uint256(registry.getVaultKind(address(token))), uint256(IRegistry4626.VaultKind.Creator));
    }

    function test_setAgentIntegrationMeta_creatorExplicit() public {
        IRegistry4626.AgentIntegrationMeta memory meta = IRegistry4626.AgentIntegrationMeta({
            vaultKind: IRegistry4626.VaultKind.Creator,
            nativeAgentVault: address(0),
            taxRecipient: address(0),
            taxAccountingAdapter: address(0),
            pairToken: address(0),
            uniswapV2Pair: address(0),
            implementationFingerprint: bytes32(0)
        });
        registry.setAgentIntegrationMeta(address(token), meta);
        assertEq(uint256(registry.getVaultKind(address(token))), uint256(IRegistry4626.VaultKind.Creator));
    }

    function test_setAgentIntegrationMeta_oneShot_blocksOverwrite() public {
        IRegistry4626.AgentIntegrationMeta memory meta = IRegistry4626.AgentIntegrationMeta({
            vaultKind: IRegistry4626.VaultKind.Agent,
            nativeAgentVault: address(0xBEEF),
            taxRecipient: address(0),
            taxAccountingAdapter: address(0),
            pairToken: address(0),
            uniswapV2Pair: address(0),
            implementationFingerprint: bytes32(0)
        });
        registry.setAgentIntegrationMeta(address(token), meta);

        IRegistry4626.AgentIntegrationMeta memory overwrite = meta;
        overwrite.nativeAgentVault = address(0xCAFE);
        vm.expectRevert(
            abi.encodeWithSelector(Registry4626.BindingAlreadySet.selector, address(token), address(0xBEEF))
        );
        registry.setAgentIntegrationMeta(address(token), overwrite);
    }

    function test_setAgentIntegrationMeta_liveRebind_ownerOnly() public {
        IRegistry4626.AgentIntegrationMeta memory meta = IRegistry4626.AgentIntegrationMeta({
            vaultKind: IRegistry4626.VaultKind.Agent,
            nativeAgentVault: address(0xBEEF),
            taxRecipient: address(0),
            taxAccountingAdapter: address(0),
            pairToken: address(0),
            uniswapV2Pair: address(0),
            implementationFingerprint: bytes32(0)
        });
        registry.setAgentIntegrationMeta(address(token), meta);
        registry.setLiveRebindEnabled(true);
        registry.setAuthorizedFactory(factory, true);

        IRegistry4626.AgentIntegrationMeta memory overwrite = meta;
        overwrite.nativeAgentVault = address(0xCAFE);

        vm.prank(factory);
        vm.expectRevert(Registry4626.LiveRebindOwnerOnly.selector);
        registry.setAgentIntegrationMeta(address(token), overwrite);

        registry.setAgentIntegrationMeta(address(token), overwrite);
        assertEq(registry.getAgentIntegrationMeta(address(token)).nativeAgentVault, address(0xCAFE));
    }
}
