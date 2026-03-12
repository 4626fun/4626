// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {CreatorRegistry} from "../contracts/core/CreatorRegistry.sol";
import {ICreatorRegistry} from "../contracts/interfaces/core/ICreatorRegistry.sol";

contract CreatorRegistryRemoteOFTBytes32Test is Test {
    CreatorRegistry internal registry;

    address internal owner;
    address internal token;
    address internal creator;

    uint32 internal constant SOLANA_EID = 40168;
    uint32 internal constant ARB_EID = 30110;
    bytes32 internal constant SOLANA_ASSET_MINT = bytes32(uint256(0xBEEF));
    address internal constant HUB_COMPOSER = address(0x2001);
    address internal constant ASSET_MESH_TOKEN = address(0x2002);
    address internal constant SHARE_MESH_TOKEN = address(0x2003);
    address internal constant VAULT = address(0x2004);
    address internal constant WRAPPER = address(0x2005);
    address internal constant SHARE_OFT = address(0x2006);

    function setUp() public {
        owner = makeAddr("owner");
        creator = makeAddr("creator");
        token = address(0x1001);

        registry = new CreatorRegistry(owner);
        vm.prank(owner);
        registry.registerCreatorCoin(token, "Creator", "CRT", creator, address(0), 0);
        vm.startPrank(owner);
        registry.setVault(token, VAULT);
        registry.setCreatorWrapper(token, WRAPPER);
        registry.setCreatorShareOFT(token, SHARE_OFT);
        vm.stopPrank();
    }

    function test_SetRemoteOFTPeerBytes32_SetsForwardAndReverseMappings() public {
        bytes32 remotePeer = bytes32(uint256(0xabc123));

        vm.prank(owner);
        registry.setRemoteOFTPeerBytes32(token, SOLANA_EID, remotePeer);

        assertEq(registry.getRemoteOFTPeerBytes32(token, SOLANA_EID), remotePeer, "forward mapping mismatch");
        assertEq(registry.getTokenForRemoteOFTBytes32(remotePeer), token, "reverse mapping mismatch");

        uint32[] memory chains = registry.getRemoteOFTChainsBytes32(token);
        assertEq(chains.length, 1, "expected one bytes32 remote chain");
        assertEq(chains[0], SOLANA_EID, "unexpected remote chain eid");
    }

    function test_SetRemoteOFTPeerBytes32_OverwriteClearsOldReverseMapping() public {
        bytes32 oldPeer = bytes32(uint256(0x1111));
        bytes32 newPeer = bytes32(uint256(0x2222));

        vm.startPrank(owner);
        registry.setRemoteOFTPeerBytes32(token, SOLANA_EID, oldPeer);
        registry.setRemoteOFTPeerBytes32(token, SOLANA_EID, newPeer);
        vm.stopPrank();

        assertEq(registry.getRemoteOFTPeerBytes32(token, SOLANA_EID), newPeer, "peer should be updated");
        assertEq(registry.getTokenForRemoteOFTBytes32(oldPeer), address(0), "old reverse mapping should be cleared");
        assertEq(registry.getTokenForRemoteOFTBytes32(newPeer), token, "new reverse mapping missing");

        uint32[] memory chains = registry.getRemoteOFTChainsBytes32(token);
        assertEq(chains.length, 1, "overwriting must not duplicate chain entries");
    }

    function test_RemoveRemoteOFTPeerBytes32_RemovesChainAndReverseLookup() public {
        bytes32 peerOne = bytes32(uint256(0x1234));
        bytes32 peerTwo = bytes32(uint256(0x5678));

        vm.startPrank(owner);
        registry.setRemoteOFTPeerBytes32(token, SOLANA_EID, peerOne);
        registry.setRemoteOFTPeerBytes32(token, ARB_EID, peerTwo);
        registry.removeRemoteOFTPeerBytes32(token, SOLANA_EID);
        vm.stopPrank();

        assertEq(registry.getRemoteOFTPeerBytes32(token, SOLANA_EID), bytes32(0), "removed peer should be zero");
        assertEq(registry.getTokenForRemoteOFTBytes32(peerOne), address(0), "reverse mapping should be cleared");
        assertEq(registry.getTokenForRemoteOFTBytes32(peerTwo), token, "other mapping must remain");

        uint32[] memory chains = registry.getRemoteOFTChainsBytes32(token);
        assertEq(chains.length, 1, "expected one chain remaining");
        assertEq(chains[0], ARB_EID, "remaining chain should be unchanged");
    }

    function test_SetRemoteOFTPeerBytes32_RevertsOnZeroPeer() public {
        vm.prank(owner);
        vm.expectRevert(CreatorRegistry.ZeroBytes32.selector);
        registry.setRemoteOFTPeerBytes32(token, SOLANA_EID, bytes32(0));
    }

    function test_SetAndGetOmnichainVaultMesh() public {
        ICreatorRegistry.OmnichainVaultMeshConfig memory cfg = ICreatorRegistry.OmnichainVaultMeshConfig({
            solanaEid: SOLANA_EID,
            hubComposer: HUB_COMPOSER,
            assetMeshToken: ASSET_MESH_TOKEN,
            shareMeshToken: SHARE_MESH_TOKEN,
            solanaAssetMint: SOLANA_ASSET_MINT,
            enabled: true
        });

        vm.prank(owner);
        registry.setOmnichainVaultMesh(token, cfg);

        ICreatorRegistry.OmnichainVaultMeshConfig memory out = registry.getOmnichainVaultMesh(token);
        assertEq(out.solanaEid, SOLANA_EID);
        assertEq(out.hubComposer, HUB_COMPOSER);
        assertEq(out.assetMeshToken, ASSET_MESH_TOKEN);
        assertEq(out.shareMeshToken, SHARE_MESH_TOKEN);
        assertEq(out.solanaAssetMint, SOLANA_ASSET_MINT);
        assertTrue(out.enabled);
        assertEq(registry.getSolanaAssetMint(token), SOLANA_ASSET_MINT);
    }

    function test_IsSolanaDepositEligible_TrueWhenFullyConfigured() public {
        vm.prank(owner);
        registry.setOmnichainVaultMesh(
            token,
            ICreatorRegistry.OmnichainVaultMeshConfig({
                solanaEid: SOLANA_EID,
                hubComposer: HUB_COMPOSER,
                assetMeshToken: ASSET_MESH_TOKEN,
                shareMeshToken: SHARE_MESH_TOKEN,
                solanaAssetMint: SOLANA_ASSET_MINT,
                enabled: true
            })
        );

        assertTrue(registry.isSolanaDepositEligible(token));
    }

    function test_IsSolanaDepositEligible_FalseWhenDisabled() public {
        vm.prank(owner);
        registry.setOmnichainVaultMesh(
            token,
            ICreatorRegistry.OmnichainVaultMeshConfig({
                solanaEid: SOLANA_EID,
                hubComposer: HUB_COMPOSER,
                assetMeshToken: ASSET_MESH_TOKEN,
                shareMeshToken: SHARE_MESH_TOKEN,
                solanaAssetMint: SOLANA_ASSET_MINT,
                enabled: false
            })
        );

        assertFalse(registry.isSolanaDepositEligible(token));
    }
}
