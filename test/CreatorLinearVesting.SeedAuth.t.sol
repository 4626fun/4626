// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {CreatorLinearVesting} from "../contracts/utilities/vesting/CreatorLinearVesting.sol";

contract MockShareTokenForVesting is ERC20 {
    constructor() ERC20("Share", "SHR") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract CreatorLinearVestingSeedAuthTest is Test {
    MockShareTokenForVesting internal token;
    CreatorLinearVesting internal vesting;

    address internal beneficiary = makeAddr("beneficiary");
    address internal seeder = makeAddr("seeder");
    address internal attacker = makeAddr("attacker");

    uint256 internal constant ALLOCATION = 1_000_000e18;

    function setUp() public {
        token = new MockShareTokenForVesting();
        vesting = new CreatorLinearVesting(
            address(token),
            beneficiary,
            uint64(block.timestamp),
            uint64(365 days),
            seeder
        );
        token.mint(address(vesting), ALLOCATION);
    }

    function test_seed_revertsForNonSeeder() public {
        vm.prank(attacker);
        vm.expectRevert(CreatorLinearVesting.NotSeeder.selector);
        vesting.seed();
    }

    function test_seed_recordsAllocationForSeeder() public {
        vm.prank(seeder);
        vesting.seed();

        assertTrue(vesting.seeded());
        assertEq(vesting.totalAllocation(), ALLOCATION);
        assertEq(vesting.vestedAmount(uint64(block.timestamp + 365 days)), ALLOCATION);
    }

    function test_seed_revertsWhenCalledTwice() public {
        vm.startPrank(seeder);
        vesting.seed();
        vm.expectRevert(CreatorLinearVesting.AlreadySeeded.selector);
        vesting.seed();
        vm.stopPrank();
    }
}
