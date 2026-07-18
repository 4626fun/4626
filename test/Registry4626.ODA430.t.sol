// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Registry4626} from "@4626/shared/core/Registry4626.sol";
import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";

/// @notice ODA-430 / ODA-422 registry hardening coverage.
contract Registry4626ODA430Test is Test {
    Registry4626 internal registry;

    address internal constant TOKEN_A = address(0xA11CE);
    address internal constant TOKEN_B = address(0xB0B);
    address internal constant VAULT = address(0x1001);
    address internal constant WRAPPER = address(0x1002);
    address internal constant ORACLE = address(0x1003);
    address internal constant GAUGE = address(0x1004);
    address internal constant REMOTE_OFT = address(0x2001);
    uint32 internal constant EID_1 = 30110;
    uint32 internal constant EID_2 = 30111;

    function setUp() public {
        registry = new Registry4626(address(this));
        registry.registerToken(TOKEN_A, "A", "A", address(this), address(0), 0);
        registry.registerToken(TOKEN_B, "B", "B", address(0xC2EA), address(0), 0);
    }

    function test_setVault_rejectsReverseMapHijack() public {
        registry.setVault(TOKEN_A, VAULT);

        vm.expectRevert(
            abi.encodeWithSelector(Registry4626.ReverseMappingConflict.selector, VAULT, TOKEN_A, TOKEN_B)
        );
        registry.setVault(TOKEN_B, VAULT);

        assertEq(registry.vaultToToken(VAULT), TOKEN_A);
        assertEq(registry.getTokenInfo(TOKEN_A).vault, VAULT);
        assertEq(registry.getTokenInfo(TOKEN_B).vault, address(0));
    }

    function test_setWrapperOracleGauge_rejectReverseMapHijack() public {
        registry.setWrapperForToken(TOKEN_A, WRAPPER);
        registry.setOracleForToken(TOKEN_A, ORACLE);
        registry.setGaugeControllerForToken(TOKEN_A, GAUGE);

        vm.expectRevert(
            abi.encodeWithSelector(Registry4626.ReverseMappingConflict.selector, WRAPPER, TOKEN_A, TOKEN_B)
        );
        registry.setWrapperForToken(TOKEN_B, WRAPPER);

        vm.expectRevert(
            abi.encodeWithSelector(Registry4626.ReverseMappingConflict.selector, ORACLE, TOKEN_A, TOKEN_B)
        );
        registry.setOracleForToken(TOKEN_B, ORACLE);

        vm.expectRevert(abi.encodeWithSelector(Registry4626.ReverseMappingConflict.selector, GAUGE, TOKEN_A, TOKEN_B));
        registry.setGaugeControllerForToken(TOKEN_B, GAUGE);
    }

    function test_removeRemoteOFTPeer_keepsReverseWhenSharedAcrossEids() public {
        registry.setRemoteOFTPeer(TOKEN_A, EID_1, REMOTE_OFT);
        registry.setRemoteOFTPeer(TOKEN_A, EID_2, REMOTE_OFT);

        registry.removeRemoteOFTPeer(TOKEN_A, EID_1);

        assertEq(registry.getRemoteOFTPeer(TOKEN_A, EID_1), address(0));
        assertEq(registry.getRemoteOFTPeer(TOKEN_A, EID_2), REMOTE_OFT);
        assertEq(registry.getTokenForRemoteOFT(REMOTE_OFT), TOKEN_A);
    }

    function test_setRemoteOFTPeer_oneShotRequiresLiveRebind() public {
        registry.setRemoteOFTPeer(TOKEN_A, EID_1, REMOTE_OFT);
        address other = address(0x0F7);

        vm.expectRevert(abi.encodeWithSelector(Registry4626.BindingAlreadySet.selector, TOKEN_A, REMOTE_OFT));
        registry.setRemoteOFTPeer(TOKEN_A, EID_1, other);

        registry.setLiveRebindEnabled(true);
        registry.setRemoteOFTPeer(TOKEN_A, EID_1, other);
        assertEq(registry.getRemoteOFTPeer(TOKEN_A, EID_1), other);
        assertEq(registry.getTokenForRemoteOFT(REMOTE_OFT), address(0));
        assertEq(registry.getTokenForRemoteOFT(other), TOKEN_A);
    }

    function test_registerToken_rejectsZeroCreator_andOwnerCanCorrect() public {
        address tokenC = address(0xC0DE);
        vm.expectRevert(Registry4626.ZeroAddress.selector);
        registry.registerToken(tokenC, "C", "C", address(0), address(0), 0);

        registry.registerToken(tokenC, "C", "C", address(0xBAD), address(0), 0);
        registry.setCreator(tokenC, address(0x600D));
        assertEq(registry.getTokenInfo(tokenC).creator, address(0x600D));
    }

    function test_setAgentIntegrationMeta_requiresRegistration() public {
        address unregistered = address(0x11);
        IRegistry4626.AgentIntegrationMeta memory meta;
        meta.vaultKind = IRegistry4626.VaultKind.Agent;

        vm.expectRevert(abi.encodeWithSelector(Registry4626.TokenNotRegistered.selector, unregistered));
        registry.setAgentIntegrationMeta(unregistered, meta);

        registry.setAgentIntegrationMeta(TOKEN_A, meta);
        assertEq(uint256(registry.getVaultKind(TOKEN_A)), uint256(IRegistry4626.VaultKind.Agent));
    }

    function test_setChainIdToEid_clearsStaleReverse_andRejectsConflicts() public {
        registry.setChainIdToEid(1, 101);
        registry.setChainIdToEid(1, 102);
        assertEq(registry.getEidForChainId(1), 102);
        assertEq(registry.getChainIdForEid(101), 0);
        assertEq(registry.getChainIdForEid(102), 1);

        registry.setChainIdToEid(2, 201);
        vm.expectRevert(abi.encodeWithSelector(Registry4626.EidAlreadyMapped.selector, 201, 2, 3));
        registry.setChainIdToEid(3, 201);
    }

    function test_renounceOwnership_disabled() public {
        vm.expectRevert(Registry4626.OwnershipRenounceDisabled.selector);
        registry.renounceOwnership();
    }

    function test_getEffectiveLzConfig_unmappedNotConfigured() public view {
        IRegistry4626.LzConfig memory cfg = registry.getEffectiveLzConfig(999_999);
        assertEq(cfg.eid, 0);
        assertFalse(cfg.isConfigured);
    }
}
