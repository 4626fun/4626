// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";

interface IRegistry4626AuthView is IRegistry4626 {
    function authorizedFactories(address factory) external view returns (bool);
}

/**
 * @title VaultKind meta live-registry smoke
 * @notice Proves the v1.19.1 registry accepts authorized-factory `setAgentIntegrationMeta`
 *         writes and that `getVaultKind` / `nativeAgentVault` round-trip. Full agent
 *         Phase1+2 on the live shell still requires `agentVaultCoreModule` on the batcher
 *         (see vaultkind wiring checklist).
 *
 * Run:
 *   RUN_FORK_TESTS=1 BASE_RPC_URL=$BASE_RPC_URL \
 *     forge test --match-path "test/fork/VaultKindMetaLive.fork.t.sol" -vv
 */
contract VaultKindMetaLiveForkTest is Test {
    address constant LIVE_REGISTRY = 0x1365e9CEfc516f8A287c51FBaeF96FB4581c6CA2;
    address constant LIVE_BATCHER = 0xa18169caf37fa0347285B16aAFC2B09eCB43F145;

    IRegistry4626AuthView internal registry;

    function setUp() public {
        if (!_forkEnabled()) return;
        vm.createSelectFork(vm.envString("BASE_RPC_URL"));
        registry = IRegistry4626AuthView(LIVE_REGISTRY);
    }

    function test_fork_batcherCanSetAgentVaultKindMeta() public {
        if (!_forkEnabled()) {
            vm.skip(true);
            return;
        }

        assertTrue(registry.authorizedFactories(LIVE_BATCHER), "batcher not authorized");

        address token = makeAddr("agentSmokeToken");
        address vault = makeAddr("agentSmokeVault");

        IRegistry4626.AgentIntegrationMeta memory meta;
        meta.vaultKind = IRegistry4626.VaultKind.Agent;
        meta.nativeAgentVault = vault;

        // Forward-compatible with ODA-430-F5 (register before meta). Live registry still
        // accepts meta without registration; registerToken is authorized for the batcher.
        vm.prank(LIVE_BATCHER);
        registry.registerToken(token, "Smoke", "SMK", LIVE_BATCHER, address(0), 0);
        vm.prank(LIVE_BATCHER);
        registry.setAgentIntegrationMeta(token, meta);

        assertEq(uint256(registry.getVaultKind(token)), uint256(IRegistry4626.VaultKind.Agent), "getVaultKind Agent");
        assertEq(registry.getAgentIntegrationMeta(token).nativeAgentVault, vault, "nativeAgentVault");
    }

    function test_fork_batcherCanSetCreatorVaultKindMeta() public {
        if (!_forkEnabled()) {
            vm.skip(true);
            return;
        }

        address token = makeAddr("creatorSmokeToken");

        IRegistry4626.AgentIntegrationMeta memory meta;
        meta.vaultKind = IRegistry4626.VaultKind.Creator;

        vm.prank(LIVE_BATCHER);
        registry.registerToken(token, "Smoke", "SMK", LIVE_BATCHER, address(0), 0);
        vm.prank(LIVE_BATCHER);
        registry.setAgentIntegrationMeta(token, meta);

        assertEq(
            uint256(registry.getVaultKind(token)), uint256(IRegistry4626.VaultKind.Creator), "getVaultKind Creator"
        );
    }

    function test_fork_unauthorizedCannotSetMeta() public {
        if (!_forkEnabled()) {
            vm.skip(true);
            return;
        }

        address token = makeAddr("unauthorizedSmokeToken");
        IRegistry4626.AgentIntegrationMeta memory meta;
        meta.vaultKind = IRegistry4626.VaultKind.Agent;

        vm.prank(makeAddr("randomEOA"));
        vm.expectRevert();
        registry.setAgentIntegrationMeta(token, meta);
    }

    function _forkEnabled() internal view returns (bool) {
        return vm.envOr("RUN_FORK_TESTS", uint256(0)) == 1 && bytes(vm.envOr("BASE_RPC_URL", string(""))).length > 0;
    }
}
