// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {Registry4626} from "@4626/shared/core/Registry4626.sol";

contract Registry4626CanonicalWalletTest is Test {
    Registry4626 internal registry;

    address internal owner;

    address internal tokenVictim;
    address internal tokenAttacker;

    address internal victimCreator;
    address internal attackerCreator;

    address internal victimWallet;
    address internal victimWallet2;

    function setUp() public {
        owner = makeAddr("owner");

        tokenVictim = address(0x1001);
        tokenAttacker = address(0x1002);

        victimCreator = makeAddr("victimCreator");
        attackerCreator = makeAddr("attackerCreator");

        victimWallet = makeAddr("victimWallet");
        victimWallet2 = makeAddr("victimWallet2");

        registry = new Registry4626(owner);

        vm.startPrank(owner);
        registry.registerToken(tokenVictim, "Victim", "VIC", victimCreator, address(0), 0);
        registry.registerToken(tokenAttacker, "Attacker", "ATK", attackerCreator, address(0), 0);
        vm.stopPrank();
    }

    function test_SetCanonicalWallet_RevertsOnCollision() public {
        // ODA-465-3: wallet itself (or owner) must set; creator alone cannot bind arbitrary wallets.
        vm.prank(victimWallet);
        registry.setCanonicalWallet(tokenVictim, victimWallet);

        // Same wallet cannot be claimed for another token (owner override still uniqueness-checked).
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(Registry4626.CanonicalWalletAlreadyInUse.selector, victimWallet, tokenVictim)
        );
        registry.setCanonicalWallet(tokenAttacker, victimWallet);

        // Reverse mapping stays correct.
        assertEq(registry.canonicalWalletToToken(victimWallet), tokenVictim);
    }

    function test_SetCanonicalWallet_CreatorAloneCannotSetArbitraryWallet() public {
        vm.prank(victimCreator);
        vm.expectRevert(Registry4626.NotAuthorized.selector);
        registry.setCanonicalWallet(tokenVictim, victimWallet);
    }

    function test_SetCanonicalWallet_OwnerCanOverride() public {
        vm.prank(owner);
        registry.setCanonicalWallet(tokenVictim, victimWallet);
        assertEq(registry.getTokenInfo(tokenVictim).canonicalWallet, victimWallet);
        assertEq(registry.canonicalWalletToToken(victimWallet), tokenVictim);
    }

    function test_SetCanonicalWallet_UpdatesReverseMapping() public {
        vm.prank(victimWallet);
        registry.setCanonicalWallet(tokenVictim, victimWallet);
        assertEq(registry.canonicalWalletToToken(victimWallet), tokenVictim);

        vm.prank(victimWallet2);
        registry.setCanonicalWallet(tokenVictim, victimWallet2);

        assertEq(registry.canonicalWalletToToken(victimWallet), address(0));
        assertEq(registry.canonicalWalletToToken(victimWallet2), tokenVictim);
        assertEq(registry.getTokenForCanonicalWallet(victimWallet2), tokenVictim);
    }
}
