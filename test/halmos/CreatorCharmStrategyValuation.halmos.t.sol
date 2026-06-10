// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CreatorCharmStrategy} from "../../contracts/vault/strategies/univ3/CreatorCharmStrategy.sol";

/**
 * @title Minimal Halmos example for CreatorCharmStrategy valuation math
 * @notice This is an initial symbolic execution target for the most critical pure math
 *         in the Charm strategy (especially the Ajna backstop valuation logic).
 *
 * Run with:
 *   halmos --contract CreatorCharmStrategyValuation_Halmos --function test_*
 *
 * Or with foundry + halmos:
 *   halmos --forge
 */
contract CreatorCharmStrategyValuation_Halmos is Test {
    uint256 private constant MAX_USDC_AMOUNT_FOR_SCALE = type(uint256).max / 1e30;
    uint256 private constant MAX_COLLATERAL_FOR_BPS = type(uint256).max / 10_000;

    // We deploy a minimal instance so we can call internal pure functions via a wrapper
    // or test the public view functions that depend on them.
    //
    // For a first pass we focus on the pure helpers by making them testable.

    // --- Properties for _usdcToCreatorValueWithPrice ---

    function test_usdcToCreatorValueWithPrice_zeroAmount_returnsZero(uint256 price) public pure {
        vm.assume(price > 0);
        uint256 result = _usdcToCreatorValueWithPrice(0, price);
        assertEq(result, 0);
    }

    function test_usdcToCreatorValueWithPrice_zeroPrice_returnsZero(uint256 amount) public pure {
        vm.assume(amount > 0);
        uint256 result = _usdcToCreatorValueWithPrice(amount, 0);
        assertEq(result, 0);
    }

    function test_usdcToCreatorValueWithPrice_monotonic(uint256 amount1, uint256 amount2, uint256 price) public pure {
        vm.assume(price > 0);
        vm.assume(amount1 <= amount2);
        vm.assume(amount2 <= MAX_USDC_AMOUNT_FOR_SCALE);

        uint256 v1 = _usdcToCreatorValueWithPrice(amount1, price);
        uint256 v2 = _usdcToCreatorValueWithPrice(amount2, price);

        assertLe(v1, v2, "Value should be non-decreasing with amount");
    }

    // --- Properties for _computeCollateralRatioBps ---

    function test_computeCollateralRatioBps_zeroDebt_returnsMax(uint256 collateral) public pure {
        uint256 ratio = _computeCollateralRatioBps(collateral, 0);
        assertEq(ratio, type(uint256).max);
    }

    function test_computeCollateralRatioBps_monotonicCollateral(uint256 c1, uint256 c2, uint256 debt) public pure {
        vm.assume(debt > 0);
        vm.assume(c1 <= c2);
        vm.assume(c2 <= MAX_COLLATERAL_FOR_BPS);

        uint256 r1 = _computeCollateralRatioBps(c1, debt);
        uint256 r2 = _computeCollateralRatioBps(c2, debt);

        assertLe(r1, r2, "Higher collateral should never decrease ratio");
    }

    // --- Internal wrappers (we duplicate the small pure functions for Halmos to target them directly) ---
    // In a real setup you would either make them internal + use a harness, or test the public getTotalAssets paths.

    function _usdcToCreatorValueWithPrice(uint256 usdcAmount, uint256 creatorPriceUsd) internal pure returns (uint256) {
        if (usdcAmount == 0 || creatorPriceUsd == 0) return 0;
        // Matches the logic in CreatorCharmStrategy
        return (usdcAmount * 1e30) / creatorPriceUsd;
    }

    function _computeCollateralRatioBps(uint256 collateralValueCreator, uint256 debtCreator) internal pure returns (uint256) {
        if (debtCreator == 0) return type(uint256).max;
        return (collateralValueCreator * 10_000) / debtCreator;
    }
}
