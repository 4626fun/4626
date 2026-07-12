// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {Registry4626} from "@4626/shared/core/Registry4626.sol";
import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";
import {RegistryBootstrap4626} from "@4626/shared/deploy/factories/RegistryBootstrap4626.sol";

/// @dev Minimal stand-in for the (not-yet-deployed) BribesFactory4626, matching
///      IBribesFactory4626 / IBribesFactory4626View used by RegistryBootstrap4626.
contract MockBribesFactory4626 {
    mapping(address => address) public bribeDepotOf;
    address public nextDepot;

    function setNextDepot(address depot) external {
        nextDepot = depot;
    }

    function getOrCreateBribeDepot(address vault) external returns (address depot) {
        depot = bribeDepotOf[vault];
        if (depot != address(0)) return depot;
        depot = nextDepot;
        bribeDepotOf[vault] = depot;
        return depot;
    }
}

contract RegistryBootstrap4626Test is Test {
    Registry4626 internal registry;
    RegistryBootstrap4626 internal bootstrap;

    address internal registryOwner;
    address internal bootstrapOwner;
    address internal nonOwner;

    address internal token;
    address internal creator;
    address internal vault;
    address internal wrapper;
    address internal shareOFT;
    address internal oracle;
    address internal gaugeController;

    function setUp() public {
        registryOwner = makeAddr("registryOwner");
        bootstrapOwner = makeAddr("bootstrapOwner");
        nonOwner = makeAddr("nonOwner");

        token = makeAddr("token");
        creator = makeAddr("creator");
        vault = makeAddr("vault");
        wrapper = makeAddr("wrapper");
        shareOFT = makeAddr("shareOFT");
        oracle = makeAddr("oracle");
        gaugeController = makeAddr("gaugeController");

        registry = new Registry4626(registryOwner);
        bootstrap = new RegistryBootstrap4626(address(registry), bootstrapOwner);

        vm.prank(registryOwner);
        registry.setAuthorizedFactory(address(bootstrap), true);
    }

    function _baseParams() internal view returns (RegistryBootstrap4626.BootstrapParams memory p) {
        p.token = token;
        p.name = "Test Token";
        p.symbol = "TEST";
        p.creator = creator;
        p.pool = address(0);
        p.poolFee = 0;
        p.vault = vault;
        p.wrapper = wrapper;
        p.shareOFT = shareOFT;
        p.oracle = oracle;
        p.gaugeController = gaugeController;
    }

    // ==============================
    // Fresh registration
    // ==============================

    function test_BootstrapToken_FreshRegistration_WiresEverythingInOneCall() public {
        vm.prank(bootstrapOwner);
        bootstrap.bootstrapToken(_baseParams());

        assertTrue(registry.isTokenRegistered(token));
        assertEq(registry.getVaultForToken(token), vault);
        assertEq(registry.getWrapperForToken(token), wrapper);
        assertEq(registry.getShareOFTForToken(token), shareOFT);
        assertEq(registry.getOracleForToken(token), oracle);
        assertEq(registry.getGaugeControllerForToken(token), gaugeController);
    }

    function test_BootstrapToken_IdempotentReRun_IsANoOp() public {
        vm.prank(bootstrapOwner);
        bootstrap.bootstrapToken(_baseParams());

        // Re-running with identical params must not revert.
        vm.prank(bootstrapOwner);
        bootstrap.bootstrapToken(_baseParams());

        assertEq(registry.getVaultForToken(token), vault);
        assertEq(registry.getOracleForToken(token), oracle);
    }

    // ==============================
    // Fill-in-missing-fields (not "patch")
    // ==============================

    function test_BootstrapToken_FillsOnlyMissingFields() public {
        // Registry owner pre-registers the token directly with vault/wrapper/shareOFT set,
        // leaving oracle/gaugeController unset (zero) — simulates a partially-wired token.
        vm.startPrank(registryOwner);
        registry.registerToken(token, "Test Token", "TEST", creator, address(0), 0);
        registry.setVault(token, vault);
        registry.setWrapperForToken(token, wrapper);
        registry.setShareOFTForToken(token, shareOFT);
        vm.stopPrank();

        RegistryBootstrap4626.BootstrapParams memory p = _baseParams();
        // Pass the same already-set values plus the two missing ones (oracle, gaugeController).
        vm.prank(bootstrapOwner);
        bootstrap.bootstrapToken(p);

        assertEq(registry.getVaultForToken(token), vault);
        assertEq(registry.getOracleForToken(token), oracle);
        assertEq(registry.getGaugeControllerForToken(token), gaugeController);
    }

    // ==============================
    // Rebind blocked (security review finding)
    // ==============================

    function test_BootstrapToken_CannotOverwriteExistingBinding() public {
        vm.prank(bootstrapOwner);
        bootstrap.bootstrapToken(_baseParams());

        address differentOracle = makeAddr("differentOracle");
        RegistryBootstrap4626.BootstrapParams memory p = _baseParams();
        p.oracle = differentOracle;

        vm.prank(bootstrapOwner);
        vm.expectRevert(abi.encodeWithSelector(Registry4626.BindingAlreadySet.selector, token, oracle));
        bootstrap.bootstrapToken(p);

        // Original binding is untouched after the revert.
        assertEq(registry.getOracleForToken(token), oracle);
    }

    // ==============================
    // Access control
    // ==============================

    function test_BootstrapToken_RevertsForNonOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert();
        bootstrap.bootstrapToken(_baseParams());
    }

    function test_BootstrapToken_RevertsUntilAuthorized() public {
        RegistryBootstrap4626 unauthorizedBootstrap = new RegistryBootstrap4626(address(registry), bootstrapOwner);

        vm.prank(bootstrapOwner);
        vm.expectRevert(Registry4626.NotAuthorized.selector);
        unauthorizedBootstrap.bootstrapToken(_baseParams());
    }

    function test_SetRegistry_RevertsForNonOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert();
        bootstrap.setRegistry(address(0x1234));
    }

    function test_SetBribesFactory_RevertsForNonOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert();
        bootstrap.setBribesFactory(address(0x1234));
    }

    // ==============================
    // Bribe depot hook
    // ==============================

    function test_CreateBribeDepot_RevertsWhenNotConfigured() public {
        RegistryBootstrap4626.BootstrapParams memory p = _baseParams();
        p.createBribeDepot = true;

        vm.prank(bootstrapOwner);
        vm.expectRevert(RegistryBootstrap4626.BribesFactoryNotConfigured.selector);
        bootstrap.bootstrapToken(p);
    }

    function test_CreateBribeDepot_RevertsWhenFactoryReturnsZero() public {
        MockBribesFactory4626 mockFactory = new MockBribesFactory4626();
        // nextDepot left unset (address(0)) — simulates a misconfigured factory.

        vm.prank(bootstrapOwner);
        bootstrap.setBribesFactory(address(mockFactory));

        RegistryBootstrap4626.BootstrapParams memory p = _baseParams();
        p.createBribeDepot = true;

        vm.prank(bootstrapOwner);
        vm.expectRevert(RegistryBootstrap4626.ZeroAddress.selector);
        bootstrap.bootstrapToken(p);
    }

    function test_CreateBribeDepot_WiresDepotInSameTransaction() public {
        MockBribesFactory4626 mockFactory = new MockBribesFactory4626();
        address depot = makeAddr("bribeDepot");
        mockFactory.setNextDepot(depot);

        vm.prank(bootstrapOwner);
        bootstrap.setBribesFactory(address(mockFactory));

        RegistryBootstrap4626.BootstrapParams memory p = _baseParams();
        p.createBribeDepot = true;

        vm.prank(bootstrapOwner);
        address returnedDepot = bootstrap.bootstrapToken(p);

        assertEq(returnedDepot, depot);
        assertEq(bootstrap.getBribeDepot(vault), depot);
        assertEq(mockFactory.bribeDepotOf(vault), depot);
    }

    function test_GetBribeDepot_ReturnsZeroWhenFactoryUnconfigured() public view {
        assertEq(bootstrap.getBribeDepot(vault), address(0));
    }

    // ==============================
    // Solana omnichain mesh wiring
    // ==============================

    function test_BootstrapToken_SetsOmnichainMesh() public {
        RegistryBootstrap4626.BootstrapParams memory p = _baseParams();
        p.setOmnichainMesh = true;
        p.omnichainMesh = IRegistry4626.OmnichainVaultMeshConfig({
            solanaEid: 30168,
            hubComposer: makeAddr("hubComposer"),
            assetMeshToken: makeAddr("assetMeshToken"),
            shareMeshToken: makeAddr("shareMeshToken"),
            solanaAssetMint: bytes32(uint256(0xABCD)),
            enabled: true
        });

        vm.prank(bootstrapOwner);
        bootstrap.bootstrapToken(p);

        IRegistry4626.OmnichainVaultMeshConfig memory stored = registry.getOmnichainVaultMesh(token);
        assertEq(stored.solanaEid, 30168);
        assertEq(stored.solanaAssetMint, bytes32(uint256(0xABCD)));
        assertTrue(stored.enabled);
    }

    function test_BootstrapToken_OmnichainMesh_IdempotentReRun() public {
        RegistryBootstrap4626.BootstrapParams memory p = _baseParams();
        p.setOmnichainMesh = true;
        p.omnichainMesh = IRegistry4626.OmnichainVaultMeshConfig({
            solanaEid: 30168,
            hubComposer: makeAddr("hubComposer"),
            assetMeshToken: makeAddr("assetMeshToken"),
            shareMeshToken: makeAddr("shareMeshToken"),
            solanaAssetMint: bytes32(uint256(0xABCD)),
            enabled: true
        });

        vm.prank(bootstrapOwner);
        bootstrap.bootstrapToken(p);

        // Re-running with an identical config must not revert.
        vm.prank(bootstrapOwner);
        bootstrap.bootstrapToken(p);
    }

    function test_BootstrapToken_SetsSolanaShareOFTPeer() public {
        RegistryBootstrap4626.BootstrapParams memory p = _baseParams();
        p.setSolanaShareOFTPeer = true;
        p.solanaEid = 30168;
        p.solanaShareOFTPeer = bytes32(uint256(0xBEEF));

        vm.prank(bootstrapOwner);
        bootstrap.bootstrapToken(p);

        assertEq(registry.getRemoteOFTPeerBytes32(token, 30168), bytes32(uint256(0xBEEF)));
    }
}
