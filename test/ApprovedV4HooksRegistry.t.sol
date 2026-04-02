// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ApprovedV4HooksRegistry} from "../contracts/vault/strategies/univ4/ApprovedV4HooksRegistry.sol";

contract MockApprovedHook {}

contract ApprovedV4HooksRegistryTest is Test {
    ApprovedV4HooksRegistry internal registry;
    address internal owner = address(this);
    address internal alice = address(0xA11CE);

    function setUp() public {
        registry = new ApprovedV4HooksRegistry(owner);
    }

    function test_SetHookApproval_TracksApprovedHooks() external {
        MockApprovedHook hookA = new MockApprovedHook();
        MockApprovedHook hookB = new MockApprovedHook();

        registry.setHookApproval(address(hookA), true);
        registry.setHookApproval(address(hookB), true);

        address[] memory approved = registry.getApprovedHooks();
        assertEq(approved.length, 2);
        assertEq(approved[0], address(hookA));
        assertEq(approved[1], address(hookB));
        assertTrue(registry.isHookApproved(address(hookA)));
        assertTrue(registry.isHookApproved(address(hookB)));
    }

    function test_SetHookApproval_RevokedHookNotReturned() external {
        MockApprovedHook hookA = new MockApprovedHook();
        MockApprovedHook hookB = new MockApprovedHook();

        registry.setHookApproval(address(hookA), true);
        registry.setHookApproval(address(hookB), true);
        registry.setHookApproval(address(hookA), false);

        address[] memory approved = registry.getApprovedHooks();
        assertEq(approved.length, 1);
        assertEq(approved[0], address(hookB));
        assertFalse(registry.isHookApproved(address(hookA)));
    }

    function test_SetHookApproval_RevertsForNonContract() external {
        vm.expectRevert(
            abi.encodeWithSelector(ApprovedV4HooksRegistry.HookNotContract.selector, address(0xBEEF))
        );
        registry.setHookApproval(address(0xBEEF), true);
    }

    function test_SetHookApproval_RevertsForZeroAddress() external {
        vm.expectRevert(ApprovedV4HooksRegistry.ZeroAddress.selector);
        registry.setHookApproval(address(0), true);
    }

    function test_SetHookApproval_RevertsForNonOwner() external {
        MockApprovedHook hook = new MockApprovedHook();

        vm.prank(alice);
        vm.expectRevert();
        registry.setHookApproval(address(hook), true);
    }
}
