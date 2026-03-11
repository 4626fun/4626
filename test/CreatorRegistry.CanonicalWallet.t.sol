// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {CreatorRegistry} from "../contracts/core/CreatorRegistry.sol";

contract CreatorRegistryCanonicalWalletTest is Test {
    CreatorRegistry internal registry;

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

        registry = new CreatorRegistry(owner);

        vm.startPrank(owner);
        registry.registerCreatorCoin(tokenVictim, "Victim", "VIC", victimCreator, address(0), 0);
        registry.registerCreatorCoin(tokenAttacker, "Attacker", "ATK", attackerCreator, address(0), 0);
        vm.stopPrank();
    }

    function test_SetCanonicalWallet_RevertsOnCollision() public {
        // Victim claims their canonical wallet.
        vm.prank(victimCreator);
        registry.setCanonicalWallet(tokenVictim, victimWallet);

        // Attacker attempts to hijack the victim's wallet via reverse lookup.
        vm.prank(attackerCreator);
        vm.expectRevert(
            abi.encodeWithSelector(CreatorRegistry.CanonicalWalletAlreadyInUse.selector, victimWallet, tokenVictim)
        );
        registry.setCanonicalWallet(tokenAttacker, victimWallet);

        // Reverse mapping stays correct.
        assertEq(registry.canonicalWalletToToken(victimWallet), tokenVictim);
    }

    function test_SetCanonicalWallet_UpdatesReverseMapping() public {
        vm.prank(victimCreator);
        registry.setCanonicalWallet(tokenVictim, victimWallet);
        assertEq(registry.canonicalWalletToToken(victimWallet), tokenVictim);

        vm.prank(victimCreator);
        registry.setCanonicalWallet(tokenVictim, victimWallet2);

        assertEq(registry.canonicalWalletToToken(victimWallet), address(0));
        assertEq(registry.canonicalWalletToToken(victimWallet2), tokenVictim);
        assertEq(registry.getTokenForCanonicalWallet(victimWallet2), tokenVictim);
    }
}

