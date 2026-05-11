// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "../contracts/governance/VaultRolePolicyManager.sol";

contract VaultRolePolicyManagerTest is Test {
    VaultRolePolicyManager internal manager;

    function setUp() public {
        manager = new VaultRolePolicyManager(address(this));
    }

    function test_policyZero_isNoop() public view {
        manager.validateRoleAssignments(0, address(this), address(this), address(this), address(this));
    }

    function test_validateRoleAssignments_revertsWhenAllowlistMissing() public {
        manager.setRolePolicy(
            1,
            VaultRolePolicyManager.RolePolicy({
                active: true,
                requireOwnerEoa: false,
                managementRule: VaultRolePolicyManager.RoleRule.MustBeAllowlisted,
                keeperRule: VaultRolePolicyManager.RoleRule.Any,
                emergencyAdminRule: VaultRolePolicyManager.RoleRule.Any
            })
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                VaultRolePolicyManager.RoleAssignmentNotAllowed.selector,
                uint8(VaultRolePolicyManager.VaultRole.Management),
                address(this)
            )
        );
        manager.validateRoleAssignments(1, address(this), address(this), address(this), address(this));
    }

    function test_validateRoleAssignments_passesWhenAllowlisted() public {
        address owner = vm.addr(1);
        manager.setRolePolicy(
            2,
            VaultRolePolicyManager.RolePolicy({
                active: true,
                requireOwnerEoa: true,
                managementRule: VaultRolePolicyManager.RoleRule.MustBeAllowlisted,
                keeperRule: VaultRolePolicyManager.RoleRule.MustEqualOwner,
                emergencyAdminRule: VaultRolePolicyManager.RoleRule.MustEqualOwner
            })
        );
        manager.setRoleAllowlistedAccount(2, VaultRolePolicyManager.VaultRole.Management, owner, true);

        manager.validateRoleAssignments(2, owner, owner, owner, owner);
    }
}
