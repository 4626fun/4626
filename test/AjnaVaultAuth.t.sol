// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {AjnaVaultAuth} from "@4626/shared/strategies/ajna/AjnaVaultAuth.sol";

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

    /// @notice ODA-423-M08: first toll/tax set is instant (deploy bootstrap).
    function testFeeUpdate_FirstSetIsInstant() public {
        auth.setToll(100);
        assertEq(auth.toll(), 100);
        assertTrue(auth.tollArmed());
        assertEq(auth.pendingTollAt(), 0);

        auth.setTax(50);
        assertEq(auth.tax(), 50);
        assertTrue(auth.taxArmed());
        assertEq(auth.pendingTaxAt(), 0);
    }

    /// @notice ODA-423-M08: subsequent toll changes are 24h-timelocked.
    function testFeeUpdate_TollTimelockThenExecute() public {
        auth.setToll(100);

        auth.setToll(200);
        assertEq(auth.toll(), 100, "live toll must not change until execute");
        assertEq(auth.pendingToll(), 200);
        uint256 executeAfter = auth.pendingTollAt();
        assertEq(executeAfter, block.timestamp + auth.FEE_UPDATE_TIMELOCK());

        vm.expectRevert(abi.encodeWithSelector(AjnaVaultAuth.FeeUpdateTimelockActive.selector, executeAfter));
        auth.executeTollUpdate();

        vm.warp(executeAfter);
        auth.executeTollUpdate();
        assertEq(auth.toll(), 200);
        assertEq(auth.pendingTollAt(), 0);
    }

    function testFeeUpdate_TaxTimelockThenExecute() public {
        auth.setTax(25);

        auth.setTax(75);
        assertEq(auth.tax(), 25);
        assertEq(auth.pendingTax(), 75);

        uint256 executeAfter = auth.pendingTaxAt();
        vm.expectRevert(abi.encodeWithSelector(AjnaVaultAuth.FeeUpdateTimelockActive.selector, executeAfter));
        auth.executeTaxUpdate();

        vm.warp(executeAfter + 1);
        auth.executeTaxUpdate();
        assertEq(auth.tax(), 75);
        assertEq(auth.pendingTaxAt(), 0);
    }

    function testFeeUpdate_ExecuteWithoutPendingReverts() public {
        vm.expectRevert(AjnaVaultAuth.NoPendingTollUpdate.selector);
        auth.executeTollUpdate();
        vm.expectRevert(AjnaVaultAuth.NoPendingTaxUpdate.selector);
        auth.executeTaxUpdate();
    }
}
