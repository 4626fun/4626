// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";

import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {ConcentratedStrategy} from "../contracts/vault/strategies/univ4/ConcentratedStrategy.sol";
import {ICreatorOracle} from "../contracts/interfaces/ICreatorOracle.sol";
import {V4LiquidityAmounts} from "../contracts/libraries/V4LiquidityAmounts.sol";
import {IApprovedV4HooksRegistry} from "../contracts/vault/strategies/univ4/ApprovedV4HooksRegistry.sol";

import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

// -----------------------------------------------------------------------------
// Minimal ERC20 mock: ConcentratedStrategy only inspects balances via IERC20 in
// flows that are *not* exercised here (deposit / rebalance / withdrawAll). For
// `_computeBurnMinAmounts` no token calls happen so a zero-code mock suffices.
// -----------------------------------------------------------------------------
contract ERC20MockForBurnSlippage {
    string public constant name = "MOCK";
    string public constant symbol = "MOCK";
    uint8 public constant decimals = 18;
}

// -----------------------------------------------------------------------------
// Hook registry mock — constructor requires nonzero but `_computeBurnMinAmounts`
// never touches it.
// -----------------------------------------------------------------------------
contract HookRegistryStub is IApprovedV4HooksRegistry {
    function isHookApproved(address) external pure returns (bool) { return true; }
}

// -----------------------------------------------------------------------------
// Oracle mock — returns a test-controlled TWAP tick. Unused methods revert so
// accidental call paths are caught loudly.
// -----------------------------------------------------------------------------
contract OracleStub is ICreatorOracle {
    int24 public twapTick;

    function setTwapTick(int24 t) external { twapTick = t; }

    function getTWAPTick(uint32) external view returns (int24) { return twapTick; }

    // ---- unused interface surface ----
    function setV4Pool(address, PoolKey calldata, bool) external {}
    function setV3Pool(address, address, address, uint32) external {}
    function getEthPrice() external pure returns (int256, uint256) { revert("ns"); }
    function getCreatorPrice() external pure returns (int256, uint256) { revert("ns"); }
    function getCreatorEthTWAP(uint32) external pure returns (uint256) { revert("ns"); }
    function tickToPrice(int24) external pure returns (uint256) { revert("ns"); }
    function getCurrentTick() external pure returns (int24) { revert("ns"); }
    function isPriceFresh() external pure returns (bool) { return true; }
    function tickToAjnaBucket(int24) external pure returns (uint256) { revert("ns"); }
    function getAjnaBucketFromV3TWAP(uint32) external pure returns (uint256) { revert("ns"); }
    function updateCreatorPrice(int256) external {}
    function updateCreatorPriceFromTWAP(uint32) external {}
    function updateCreatorPriceFromV3TWAP(uint32) external {}
    function recordSwapObservation() external {}
    function getObservationState() external pure returns (uint16, uint16, uint16, uint32) { return (0,0,0,0); }
    function getTickCapState() external pure returns (int24, uint64, bool) { return (0, 0, false); }
    function creatorSymbol() external pure returns (string memory) { return "MOCK"; }
    function creatorPriceUSD() external pure returns (int256) { return 0; }
    function creatorPriceTimestamp() external pure returns (uint256) { return 0; }
    function v4PoolConfigured() external pure returns (bool) { return false; }
    function maxTicksPerObservation() external pure returns (int24) { return 0; }
}

// -----------------------------------------------------------------------------
// Harness — exposes `_computeBurnMinAmounts` for direct testing. This is
// deliberate: the shipped `_posmBurn` path requires a live V4 PositionManager +
// PoolManager + Permit2, which this sandbox cannot stand up (the M-07
// acceptance doc explicitly notes `forge test` for the live burn path is out
// of scope). We therefore pin the *math* that gates `_posmBurn`'s min-out
// arguments, which is the value the fix actually delivers.
// -----------------------------------------------------------------------------
contract ConcentratedStrategyHarness is ConcentratedStrategy {
    constructor(address creator, address paired, address owner_, address hookRegistry_)
        ConcentratedStrategy(creator, paired, address(this), owner_, hookRegistry_)
    {}

    function exposed_computeBurnMinAmounts(
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint256 slippageBps
    ) external view returns (uint128, uint128) {
        return _computeBurnMinAmounts(tickLower, tickUpper, liquidity, slippageBps);
    }

    // Expose setters for test-only configuration that is otherwise owner-gated
    // but which we need to exercise without running a full configurePool flow.
    function test_setTwapOracle(address oracle) external { twapOracle = ICreatorOracle(oracle); }
    function test_setMaxTwapDeviation(int24 d) external { maxTwapDeviation = d; }
    function test_setTwapDuration(uint32 dur) external { twapDuration = dur; }
}

contract ConcentratedStrategyBurnSlippageTest is Test {
    ConcentratedStrategyHarness internal strategy;
    OracleStub internal oracle;

    // Mirror contract constants so test reads don't depend on solidity inlining.
    uint256 internal constant BPS = 10_000;
    uint256 internal constant REBALANCE_SLIPPAGE_BPS = 100; // 1%
    uint256 internal constant WITHDRAW_SLIPPAGE_BPS = 200;  // 2%

    int24 internal constant TICK_LOWER = -600;
    int24 internal constant TICK_UPPER =  600;
    uint128 internal constant LIQUIDITY = 1e18;

    function setUp() public {
        ERC20MockForBurnSlippage creator = new ERC20MockForBurnSlippage();
        ERC20MockForBurnSlippage paired = new ERC20MockForBurnSlippage();
        HookRegistryStub hookRegistry = new HookRegistryStub();
        strategy = new ConcentratedStrategyHarness(
            address(creator), address(paired), address(this), address(hookRegistry)
        );
        oracle = new OracleStub();
        strategy.test_setTwapOracle(address(oracle));
        // Default TWAP tick = 0 (pool at 1:1) — individual tests override.
        oracle.setTwapTick(0);
    }

    // -------------------------------------------------------------------------
    // Guard: zero-liquidity early return.
    // Rationale: withdrawAll is a no-op when totalLiquidity == 0, but defense
    // in depth — make sure the helper itself never attempts TWAP lookups in
    // that regime since the oracle might not yet be configured.
    // -------------------------------------------------------------------------
    function test_zeroLiquidity_returnsZeroMins() public {
        strategy.test_setTwapOracle(address(0)); // force revert-on-access
        (uint128 min0, uint128 min1) = strategy.exposed_computeBurnMinAmounts(
            TICK_LOWER, TICK_UPPER, 0, REBALANCE_SLIPPAGE_BPS
        );
        assertEq(min0, 0, "min0 must be 0 when liquidity==0");
        assertEq(min1, 0, "min1 must be 0 when liquidity==0");
    }

    // -------------------------------------------------------------------------
    // Guard: maxTwapDeviation == 0 is the explicit governance opt-out.
    // Matches acceptance doc (M-07) design: operators who disable TWAP checks
    // have opted out of the protection entirely. Falling back to spot here
    // would let spot-manipulators set the floor themselves — worse than zero.
    // -------------------------------------------------------------------------
    function test_maxTwapDeviationZero_returnsZeroMins() public {
        strategy.test_setMaxTwapDeviation(0);
        // Non-zero liquidity — only the maxTwapDeviation flag should matter.
        (uint128 min0, uint128 min1) = strategy.exposed_computeBurnMinAmounts(
            TICK_LOWER, TICK_UPPER, LIQUIDITY, REBALANCE_SLIPPAGE_BPS
        );
        assertEq(min0, 0, "min0 must be 0 when maxTwapDeviation disabled");
        assertEq(min1, 0, "min1 must be 0 when maxTwapDeviation disabled");
    }

    // -------------------------------------------------------------------------
    // Guard: mis-config state (twapOracle unset but maxTwapDeviation > 0) must
    // revert with the named `TwapOracleNotSet()` error rather than a raw
    // call-to-zero revert. This mirrors `getTwap()`'s presence check and
    // prevents `withdrawAll` from silently DOSing through a low-level revert
    // at the oracle dereference. Regression for Codex review on PR #366
    // (_computeBurnMinAmounts previously called twapOracle.getTWAPTick() with
    // no presence guard).
    //
    // Deliberately NOT a zero-min fallback: that would silently disable the
    // S-H05 slippage floor exactly when operators believe it is on.
    // -------------------------------------------------------------------------
    function test_twapOracleUnset_revertsTwapOracleNotSet() public {
        // Wipe the oracle while keeping maxTwapDeviation > 0 (mis-config).
        strategy.test_setTwapOracle(address(0));
        // Sanity: maxTwapDeviation was initialised non-zero in setUp().
        // Non-zero liquidity so we don't early-return.
        vm.expectRevert(abi.encodeWithSignature("TwapOracleNotSet()"));
        strategy.exposed_computeBurnMinAmounts(
            TICK_LOWER, TICK_UPPER, LIQUIDITY, WITHDRAW_SLIPPAGE_BPS
        );
    }

    // Complement: even with oracle unset, zero-liquidity short-circuit still
    // returns (0,0) without touching the oracle. Prevents a redundant revert
    // on a no-op burn.
    function test_twapOracleUnset_zeroLiquidity_stillReturnsZero() public {
        strategy.test_setTwapOracle(address(0));
        (uint128 min0, uint128 min1) = strategy.exposed_computeBurnMinAmounts(
            TICK_LOWER, TICK_UPPER, 0, WITHDRAW_SLIPPAGE_BPS
        );
        assertEq(min0, 0, "zero-liquidity must short-circuit before oracle read");
        assertEq(min1, 0, "zero-liquidity must short-circuit before oracle read");
    }

    // Complement: opt-out (maxTwapDeviation == 0) path must not read the
    // oracle either. Combined with the previous two tests this pins the full
    // guard order: liquidity == 0, then maxTwapDeviation == 0, then oracle
    // presence, then TWAP read.
    function test_maxTwapDeviationZero_oracleUnset_returnsZeroMins() public {
        strategy.test_setTwapOracle(address(0));
        strategy.test_setMaxTwapDeviation(0);
        (uint128 min0, uint128 min1) = strategy.exposed_computeBurnMinAmounts(
            TICK_LOWER, TICK_UPPER, LIQUIDITY, WITHDRAW_SLIPPAGE_BPS
        );
        assertEq(min0, 0, "opt-out must short-circuit before oracle read");
        assertEq(min1, 0, "opt-out must short-circuit before oracle read");
    }

    // -------------------------------------------------------------------------
    // Happy path: TWAP at pool mid (tick 0) — amount0 and amount1 should each
    // equal the V4LiquidityAmounts library output shaved by REBALANCE_SLIPPAGE_BPS.
    // -------------------------------------------------------------------------
    function test_rebalanceSlippage_shavesOnePercent() public {
        oracle.setTwapTick(0);

        (uint128 min0, uint128 min1) = strategy.exposed_computeBurnMinAmounts(
            TICK_LOWER, TICK_UPPER, LIQUIDITY, REBALANCE_SLIPPAGE_BPS
        );

        uint160 twapSqrt = TickMath.getSqrtPriceAtTick(0);
        (uint256 expected0, uint256 expected1) = V4LiquidityAmounts.getAmountsForLiquidity(
            twapSqrt,
            TickMath.getSqrtPriceAtTick(TICK_LOWER),
            TickMath.getSqrtPriceAtTick(TICK_UPPER),
            LIQUIDITY
        );

        uint256 expectedMin0 = (expected0 * (BPS - REBALANCE_SLIPPAGE_BPS)) / BPS;
        uint256 expectedMin1 = (expected1 * (BPS - REBALANCE_SLIPPAGE_BPS)) / BPS;

        assertEq(uint256(min0), expectedMin0, "min0 should be shaved by 1% rebalance slippage");
        assertEq(uint256(min1), expectedMin1, "min1 should be shaved by 1% rebalance slippage");

        // Sanity: mins are strictly below the TWAP-implied amounts and above zero
        // for a symmetric range with non-trivial liquidity.
        assertLt(uint256(min0), expected0, "min0 must sit below expected");
        assertLt(uint256(min1), expected1, "min1 must sit below expected");
        assertGt(uint256(min0), 0, "min0 must be strictly positive");
        assertGt(uint256(min1), 0, "min1 must be strictly positive");
    }

    // -------------------------------------------------------------------------
    // Withdraw path uses a looser 2% slippage. Verify the mins land below
    // the rebalance path for the same inputs.
    // -------------------------------------------------------------------------
    function test_withdrawSlippage_looserThanRebalance() public {
        oracle.setTwapTick(0);

        (uint128 rebMin0, uint128 rebMin1) = strategy.exposed_computeBurnMinAmounts(
            TICK_LOWER, TICK_UPPER, LIQUIDITY, REBALANCE_SLIPPAGE_BPS
        );
        (uint128 wdMin0, uint128 wdMin1) = strategy.exposed_computeBurnMinAmounts(
            TICK_LOWER, TICK_UPPER, LIQUIDITY, WITHDRAW_SLIPPAGE_BPS
        );

        assertLt(uint256(wdMin0), uint256(rebMin0), "withdraw min0 must be looser than rebalance");
        assertLt(uint256(wdMin1), uint256(rebMin1), "withdraw min1 must be looser than rebalance");

        // Verify the 2% shave is exact.
        uint160 twapSqrt = TickMath.getSqrtPriceAtTick(0);
        (uint256 expected0, uint256 expected1) = V4LiquidityAmounts.getAmountsForLiquidity(
            twapSqrt,
            TickMath.getSqrtPriceAtTick(TICK_LOWER),
            TickMath.getSqrtPriceAtTick(TICK_UPPER),
            LIQUIDITY
        );
        assertEq(uint256(wdMin0), (expected0 * (BPS - WITHDRAW_SLIPPAGE_BPS)) / BPS, "wd min0 exact");
        assertEq(uint256(wdMin1), (expected1 * (BPS - WITHDRAW_SLIPPAGE_BPS)) / BPS, "wd min1 exact");
    }

    // -------------------------------------------------------------------------
    // Sandwich-resistance property: if an attacker inflates spot relative to
    // the 900s TWAP, the min amounts derived from TWAP remain anchored to the
    // honest price. We simulate this by moving the TWAP vs keeping position
    // range fixed — the test asserts that min amounts *track the TWAP*, which
    // is what makes a malicious spot move unable to undercut the floor.
    //
    // Concretely: at TWAP tick = +500 (price up), amount0 expectation drops
    // and amount1 expectation rises vs TWAP = 0. A sandwich that pushes spot
    // further up and crashes it back would cause the PositionManager to
    // return amounts closer to the *manipulated* spot, which would fall below
    // the TWAP-anchored min and revert the burn. Here we pin the math shift.
    // -------------------------------------------------------------------------
    function test_twapMove_shiftsMinAmounts_anchoringAgainstSandwich() public {
        oracle.setTwapTick(0);
        (uint128 base0, uint128 base1) = strategy.exposed_computeBurnMinAmounts(
            TICK_LOWER, TICK_UPPER, LIQUIDITY, REBALANCE_SLIPPAGE_BPS
        );

        oracle.setTwapTick(500); // TWAP moved up ~5%
        (uint128 hi0, uint128 hi1) = strategy.exposed_computeBurnMinAmounts(
            TICK_LOWER, TICK_UPPER, LIQUIDITY, REBALANCE_SLIPPAGE_BPS
        );

        // When TWAP tick rises inside the range, token0 reserves drop and token1 reserves rise.
        assertLt(uint256(hi0), uint256(base0), "higher TWAP should reduce amount0 floor");
        assertGt(uint256(hi1), uint256(base1), "higher TWAP should increase amount1 floor");

        // Symmetric: TWAP moves down.
        oracle.setTwapTick(-500);
        (uint128 lo0, uint128 lo1) = strategy.exposed_computeBurnMinAmounts(
            TICK_LOWER, TICK_UPPER, LIQUIDITY, REBALANCE_SLIPPAGE_BPS
        );
        assertGt(uint256(lo0), uint256(base0), "lower TWAP should increase amount0 floor");
        assertLt(uint256(lo1), uint256(base1), "lower TWAP should reduce amount1 floor");
    }

    // -------------------------------------------------------------------------
    // Out-of-range TWAP: when TWAP tick sits above the position range, the
    // position is entirely in token1 (quote). Expect amount0 floor == 0,
    // amount1 floor >> 0.
    // -------------------------------------------------------------------------
    function test_twapAboveRange_allQuoteToken() public {
        oracle.setTwapTick(TICK_UPPER + 100);
        (uint128 min0, uint128 min1) = strategy.exposed_computeBurnMinAmounts(
            TICK_LOWER, TICK_UPPER, LIQUIDITY, REBALANCE_SLIPPAGE_BPS
        );
        assertEq(uint256(min0), 0, "amount0 floor must be 0 when TWAP above range");
        assertGt(uint256(min1), 0, "amount1 floor must be positive when TWAP above range");
    }

    // -------------------------------------------------------------------------
    // Out-of-range TWAP (below): position entirely in token0 (base).
    // -------------------------------------------------------------------------
    function test_twapBelowRange_allBaseToken() public {
        oracle.setTwapTick(TICK_LOWER - 100);
        (uint128 min0, uint128 min1) = strategy.exposed_computeBurnMinAmounts(
            TICK_LOWER, TICK_UPPER, LIQUIDITY, REBALANCE_SLIPPAGE_BPS
        );
        assertGt(uint256(min0), 0, "amount0 floor must be positive when TWAP below range");
        assertEq(uint256(min1), 0, "amount1 floor must be 0 when TWAP below range");
    }
}
