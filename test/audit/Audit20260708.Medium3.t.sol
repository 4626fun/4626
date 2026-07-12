// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {BribeDepot4626} from "@4626/shared/governance/bribes/BribeDepot4626.sol";
import {AjnaVaultAuth} from "@4626/shared/strategies/ajna/AjnaVaultAuth.sol";

// Minimal gauge voting mock for BribeDepot4626 constructor.
contract MockGaugeForBribe {
    function currentEpoch() external pure returns (uint256) {
        return 1;
    }

    function getVaultWeightAtEpoch(uint256, address) external pure returns (uint256) {
        return 0;
    }

    function getUserVoteWeightAtEpoch(uint256, address, address) external pure returns (uint256) {
        return 0;
    }

    function canReceiveBribes(address) external pure returns (bool) {
        return true;
    }
}

contract Audit20260708_M13_BribeOwnerRollover is Test {
    BribeDepot4626 internal depot;
    address internal stranger = address(0xBAD);
    address internal owner = address(this);

    function setUp() public {
        depot = new BribeDepot4626(address(0xBEEF01), address(new MockGaugeForBribe()), owner);
    }

    function test_rolloverExpiredEpoch_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        depot.rolloverExpiredEpoch(0, address(0xBEEF02));
    }

    function test_setRolloverGrace_enforcesMinimum() public {
        assertEq(depot.MIN_ROLLOVER_GRACE_EPOCHS(), 2);
        vm.expectRevert(abi.encodeWithSelector(BribeDepot4626.GraceBelowMinimum.selector, 1, 2));
        depot.setRolloverGraceEpochs(1);
        depot.setRolloverGraceEpochs(6);
        assertEq(depot.rolloverGraceEpochs(), 6);
    }
}

contract Audit20260708_M14_BufferRatioFloor is Test {
    AjnaVaultAuth internal auth;

    function setUp() public {
        auth = new AjnaVaultAuth(address(this));
    }

    function test_setBufferRatio_rejectsBelowMinimum() public {
        vm.expectRevert(
            abi.encodeWithSelector(AjnaVaultAuth.BufferRatioTooLow.selector, 0, auth.MIN_BUFFER_RATIO_BPS())
        );
        auth.setBufferRatio(0);

        vm.expectRevert(
            abi.encodeWithSelector(AjnaVaultAuth.BufferRatioTooLow.selector, 499, auth.MIN_BUFFER_RATIO_BPS())
        );
        auth.setBufferRatio(499);

        auth.setBufferRatio(500);
        assertEq(auth.bufferRatio(), 500);
        assertEq(auth.MIN_BUFFER_RATIO_BPS(), 500);
    }
}
