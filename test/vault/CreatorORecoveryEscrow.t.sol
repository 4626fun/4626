// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {CreatorORecoveryEscrow} from "../../contracts/vault/CreatorORecoveryEscrow.sol";

contract MockToken is ERC20 {
    constructor() ERC20("Mock", "MOCK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract CreatorORecoveryEscrowTest is Test {
    CreatorORecoveryEscrow internal escrow;
    MockToken internal token;
    address internal owner = address(this);
    address internal vault = address(0xBEEF);
    address internal alice = address(0xA11CE);

    function setUp() public {
        escrow = new CreatorORecoveryEscrow(owner);
        escrow.setVault(vault);
        token = new MockToken();
    }

    function test_notifyRecovery_onlyVault() public {
        vm.prank(vault);
        escrow.notifyRecovery(address(token), 1, 5);
        assertEq(escrow.recoveredByEpochAsset(1, address(token)), 5);
    }

    function test_claimRecovery_onlyVault() public {
        token.mint(address(escrow), 10);
        vm.prank(vault);
        escrow.claimRecovery(address(token), 1, alice, 7);
        assertEq(token.balanceOf(alice), 7);
        assertEq(escrow.claimedByEpochAsset(1, address(token)), 7);
    }

    function test_revert_nonVaultNotify() public {
        vm.expectRevert(CreatorORecoveryEscrow.Unauthorized.selector);
        escrow.notifyRecovery(address(token), 1, 1);
    }
}

