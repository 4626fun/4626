// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SolanaStrategy} from "../../../contracts/vault/strategies/SolanaStrategy.sol";

contract MockCreatorToken is ERC20 {
    constructor() ERC20("Creator", "CRT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract SolanaStrategyValuationTest is Test {
    SolanaStrategy strategy;
    MockCreatorToken creator;

    address vault;
    address owner;
    address keeper;

    uint64 constant MAX_NAV_AGE = 3600;
    uint16 constant MAX_NAV_DELTA_BPS = 500; // 5%
    uint16 constant MIN_BASE_LIQUIDITY_BPS = 1000; // 10%

    function setUp() public {
        creator = new MockCreatorToken();
        vault = makeAddr("vault");
        owner = address(this);
        keeper = makeAddr("keeper");

        strategy = new SolanaStrategy(
            vault,
            address(creator),
            owner,
            keeper,
            MAX_NAV_AGE,
            MAX_NAV_DELTA_BPS,
            MIN_BASE_LIQUIDITY_BPS,
            address(0xdEaD)
        );

        creator.mint(address(strategy), 100e18);
    }

    function test_valuationReady_true_forFreshNav() public {
        vm.prank(keeper);
        strategy.updateRemoteNav(50e18, bytes32(0));

        assertTrue(strategy.isValuationReady(), "valuation should be ready for fresh NAV");
    }

    function test_valuationReady_false_whenStale() public {
        vm.prank(keeper);
        strategy.updateRemoteNav(50e18, bytes32(0));

        vm.warp(block.timestamp + MAX_NAV_AGE + 1);

        assertFalse(strategy.isValuationReady(), "valuation should be false when stale");
    }

    function test_updateRemoteNav_reverts_whenDeltaExceedsCap() public {
        vm.prank(keeper);
        strategy.updateRemoteNav(100e18, bytes32(0));

        // 100 -> 160 = 60% delta, cap is 5%
        vm.prank(keeper);
        vm.expectRevert(SolanaStrategy.NavDeltaExceedsCap.selector);
        strategy.updateRemoteNav(160e18, bytes32(0));
    }

    function test_getTotalAssets_basePlusRemote_whenValuationReady() public {
        vm.prank(keeper);
        strategy.updateRemoteNav(50e18, bytes32(0));

        uint256 total = strategy.getTotalAssets();
        assertEq(total, 100e18 + 50e18, "should be base + remote when valuation ready");
    }

    function test_getTotalAssets_baseOnly_whenValuationStale() public {
        vm.prank(keeper);
        strategy.updateRemoteNav(50e18, bytes32(0));

        vm.warp(block.timestamp + MAX_NAV_AGE + 1);

        uint256 total = strategy.getTotalAssets();
        assertEq(total, 100e18, "should be base-only when valuation stale");
    }

    function test_getTotalAssets_baseOnly_whenNavDisabled() public {
        vm.prank(keeper);
        strategy.updateRemoteNav(50e18, bytes32(0));

        strategy.setRemoteNavEnabled(false);

        uint256 total = strategy.getTotalAssets();
        assertEq(total, 100e18, "should be base-only when remote nav disabled");
    }

    function test_valuationFalse_whenEmergencyPaused() public {
        vm.prank(keeper);
        strategy.updateRemoteNav(50e18, bytes32(0));

        strategy.setEmergencyPaused(true);

        assertFalse(strategy.isValuationReady(), "valuation should be false when emergency paused");
        assertEq(strategy.getTotalAssets(), 100e18, "getTotalAssets should be base-only when paused");
    }

    function test_setKeeper_reverts_whenAddressZeroAndStatusTrue() public {
        vm.expectRevert(SolanaStrategy.InvalidKeeper.selector);
        strategy.setKeeper(address(0), true);
    }

    function test_setKeeper_allows_addressZeroAndStatusFalse() public {
        strategy.setKeeper(address(0), false);
        assertFalse(strategy.keepers(address(0)));
    }
}
