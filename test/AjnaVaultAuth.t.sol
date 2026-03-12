// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {AjnaVaultAuth} from "../contracts/vault/strategies/ajna4626/AjnaVaultAuth.sol";

contract AjnaVaultAuthTest is Test {
    AjnaVaultAuth internal auth;
    address internal nonAdmin = address(0xBEEF);

    function setUp() public {
        auth = new AjnaVaultAuth(address(this));
    }

    function testSetMinBucketIndex_AllowsZeroAndAjnaUpperBound() public {
        auth.setMinBucketIndex(0);
        assertEq(auth.minBucketIndex(), 0, "zero min bucket should be allowed");

        auth.setMinBucketIndex(1);
        assertEq(auth.minBucketIndex(), 1, "bucket floor 1 should be allowed");

        auth.setMinBucketIndex(7_388);
        assertEq(auth.minBucketIndex(), 7_388, "ajna upper bound should be allowed");
    }

    function testSetMinBucketIndex_RevertsAboveAjnaUpperBound() public {
        vm.expectRevert(AjnaVaultAuth.InvalidMinBucketIndex.selector);
        auth.setMinBucketIndex(7_389);
    }

    function testSetMinBucketIndex_OnlyAdmin() public {
        vm.prank(nonAdmin);
        vm.expectRevert(AjnaVaultAuth.NotAuthorized.selector);
        auth.setMinBucketIndex(4_156);
    }
}
