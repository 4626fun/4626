// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {LinearVesting4626} from "@4626/shared/distribution/LinearVesting4626.sol";

contract MockShareTokenForVesting is ERC20 {
    constructor() ERC20("Share", "SHR") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract LinearVesting4626SeedAuthTest is Test {
    MockShareTokenForVesting internal token;
    LinearVesting4626 internal vesting;

    address internal beneficiary = makeAddr("beneficiary");
    address internal seeder = makeAddr("seeder");
    address internal attacker = makeAddr("attacker");

    uint256 internal constant ALLOCATION = 1_000_000e18;

    function setUp() public {
        token = new MockShareTokenForVesting();
        vesting = new LinearVesting4626(
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
        vm.expectRevert(LinearVesting4626.NotSeeder.selector);
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
        vm.expectRevert(LinearVesting4626.AlreadySeeded.selector);
        vesting.seed();
        vm.stopPrank();
    }
}
