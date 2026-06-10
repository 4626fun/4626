// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "forge-std/Test.sol";

import {CreatorOImpairmentClaims} from "../../contracts/vault/CreatorOImpairmentClaims.sol";

contract CreatorOImpairmentClaimsTest is Test {
    CreatorOImpairmentClaims internal claims;
    address internal owner = address(this);
    address internal vault = address(0xBEEF);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    function setUp() public {
        claims = new CreatorOImpairmentClaims(owner);
        claims.setVault(vault);
    }

    function test_onlyVaultCanMint() public {
        vm.prank(vault);
        claims.mintFromVault(alice, 1, 10);
        assertEq(claims.balanceOf(alice, 1), 10);
        assertEq(claims.totalSupply(1), 10);
    }

    function test_revert_nonVaultMint() public {
        vm.expectRevert(CreatorOImpairmentClaims.Unauthorized.selector);
        claims.mintFromVault(alice, 1, 10);
    }

    function test_nonTransferable() public {
        vm.prank(vault);
        claims.mintFromVault(alice, 1, 10);

        vm.startPrank(alice);
        vm.expectRevert(CreatorOImpairmentClaims.ClaimTransferDisabled.selector);
        claims.safeTransferFrom(alice, bob, 1, 1, "");
        vm.stopPrank();
    }
}

