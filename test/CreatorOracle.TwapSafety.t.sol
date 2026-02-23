// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {CreatorOracle} from "../contracts/services/oracles/CreatorOracle.sol";

import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

contract MockRegistryForCreatorOracleTwapSafety {
    address public immutable endpoint;
    uint32 public immutable hubEid;

    constructor(address _endpoint, uint32 _hubEid) {
        endpoint = _endpoint;
        hubEid = _hubEid;
    }

    function getLayerZeroEndpoint(uint256) external view returns (address) {
        return endpoint;
    }

    function hubChainEid() external view returns (uint32) {
        return hubEid;
    }
}

contract MockChainlinkFeedForCreatorOracleTwapSafety {
    int256 public answer;
    uint256 public updatedAt;

    function setLatestAnswer(int256 _answer, uint256 _updatedAt) external {
        answer = _answer;
        updatedAt = _updatedAt;
    }

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 _answer, uint256 startedAt, uint256 _updatedAt, uint80 answeredInRound)
    {
        return (0, answer, 0, updatedAt, 0);
    }
}

/// @dev Minimal V4 PoolManager mock: only extsload is needed for StateLibrary.getSlot0/getLiquidity.
contract MockPoolManagerExtsloadForCreatorOracleTwapSafety {
    mapping(bytes32 => bytes32) internal slots;

    bytes32 internal constant POOLS_SLOT = bytes32(uint256(6));
    uint256 internal constant LIQUIDITY_OFFSET = 3;

    function extsload(bytes32 slot) external view returns (bytes32 value) {
        return slots[slot];
    }

    function setSlot0Tick(PoolId poolId, int24 tick) external {
        bytes32 stateSlot = keccak256(abi.encodePacked(PoolId.unwrap(poolId), POOLS_SLOT));

        // StateLibrary.getSlot0 expects:
        // - sqrtPriceX96 in the bottom 160 bits
        // - tick in the next 24 bits (bits 160..183), sign-extended as int24
        uint256 sqrtPriceX96 = 1;
        uint256 tickBits = uint256(uint24(tick));

        uint256 word = sqrtPriceX96 | (tickBits << 160);
        slots[stateSlot] = bytes32(word);
    }

    function setLiquidity(PoolId poolId, uint128 liquidity) external {
        bytes32 stateSlot = keccak256(abi.encodePacked(PoolId.unwrap(poolId), POOLS_SLOT));
        bytes32 liquiditySlot = bytes32(uint256(stateSlot) + LIQUIDITY_OFFSET);
        slots[liquiditySlot] = bytes32(uint256(liquidity));
    }
}

contract CreatorOracleTwapSafetyTest is Test {
    using PoolIdLibrary for PoolKey;

    // LayerZero Endpoint (address is irrelevant; we mock its calls)
    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    uint32 internal constant HUB_EID = 30184;

    function _deployOracle(address chainlinkFeed) internal returns (CreatorOracle oracle) {
        // OAppCore constructor calls endpoint.setDelegate(delegate); we must mock it.
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(address(this)));

        MockRegistryForCreatorOracleTwapSafety registry =
            new MockRegistryForCreatorOracleTwapSafety(LZ_ENDPOINT, HUB_EID);
        oracle = new CreatorOracle(address(registry), chainlinkFeed, "TEST", address(this));
    }

    function _defaultPoolKey(address creatorToken) internal pure returns (PoolKey memory key) {
        // For V4, native ETH is Currency.wrap(address(0)).
        // Ensure canonical ordering: address(0) < creatorToken.
        key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(creatorToken),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
    }

    function test_updateCreatorPriceFromTWAP_UsesDivisionForUsdPerCreator() public {
        // Set a realistic timestamp so any accidental epoch-0 observation produces a huge window.
        vm.warp(1_700_000_000);

        MockChainlinkFeedForCreatorOracleTwapSafety feed = new MockChainlinkFeedForCreatorOracleTwapSafety();
        feed.setLatestAnswer(2000e8, block.timestamp); // ETH/USD = 2000, 8 decimals

        CreatorOracle oracle = _deployOracle(address(feed));

        MockPoolManagerExtsloadForCreatorOracleTwapSafety poolManager =
            new MockPoolManagerExtsloadForCreatorOracleTwapSafety();
        address creatorToken = address(0xC0FFEE);
        PoolKey memory key = _defaultPoolKey(creatorToken);
        PoolId poolId = key.toId();

        // Pick a tick where creatorPerEth != 1e18 (so multiply vs divide diverges).
        // tick ~= 6931 => price ~= 2 (token1/token0), i.e. ~2 CREATOR per ETH (since currency0=ETH, currency1=CREATOR).
        int24 tick = 6931;
        poolManager.setSlot0Tick(poolId, tick);
        poolManager.setLiquidity(poolId, 1e18);

        oracle.setV4Pool(address(poolManager), key, false);
        oracle.setSwapRecorder(address(this), true);

        // Build enough TWAP history for 30 minutes so updateCreatorPriceFromTWAP(1800) succeeds.
        vm.warp(block.timestamp + 1);
        oracle.recordSwapObservation();
        vm.warp(block.timestamp + 1800);
        oracle.recordSwapObservation();

        uint32 duration = 1800;
        uint256 creatorPerEth = oracle.getCreatorEthTWAP(duration);

        // Expected: USD/CREATOR = (USD/ETH) / (CREATOR/ETH)
        uint256 ethUsd18 = 2000e18;
        uint256 expectedUsdPerCreator18 = Math.mulDiv(ethUsd18, 1e18, creatorPerEth);

        oracle.updateCreatorPriceFromTWAP(duration);

        assertEq(oracle.creatorPriceUSD(), int256(expectedUsdPerCreator18));
    }

    function test_recordObservation_FirstWriteAdvancesIndexAndInitializesNextSlot() public {
        vm.warp(1_700_000_000);

        CreatorOracle oracle = _deployOracle(address(0));

        MockPoolManagerExtsloadForCreatorOracleTwapSafety poolManager =
            new MockPoolManagerExtsloadForCreatorOracleTwapSafety();
        address creatorToken = address(0xC0FFEE);
        PoolKey memory key = _defaultPoolKey(creatorToken);
        PoolId poolId = key.toId();

        poolManager.setSlot0Tick(poolId, 12345);
        poolManager.setLiquidity(poolId, 1e18);

        oracle.setV4Pool(address(poolManager), key, false);
        oracle.setSwapRecorder(address(this), true);

        vm.warp(block.timestamp + 10);
        oracle.recordSwapObservation();

        (uint16 index, uint16 cardinality, uint16 cardinalityNext,) = oracle.getObservationState();
        assertEq(index, 1, "index should advance to 1 on first record");
        assertEq(cardinality, 2, "cardinality should be 2 after first record");
        assertEq(cardinalityNext, 2, "cardinalityNext should be 2 after first record");

        (uint32 ts,,,,, bool initialized) = oracle.observations(1);
        assertTrue(initialized, "observations[1] should be initialized");
        assertEq(ts, uint32(block.timestamp), "observations[1] timestamp should match block.timestamp");
    }

    function test_getTWAPTick_DoesNotUseUninitializedObservation() public {
        vm.warp(1_700_000_000);

        CreatorOracle oracle = _deployOracle(address(0));

        MockPoolManagerExtsloadForCreatorOracleTwapSafety poolManager =
            new MockPoolManagerExtsloadForCreatorOracleTwapSafety();
        address creatorToken = address(0xC0FFEE);
        PoolKey memory key = _defaultPoolKey(creatorToken);
        PoolId poolId = key.toId();

        // Non-zero tick so the correct TWAP is obviously not 0.
        int24 tick = 10000;
        poolManager.setSlot0Tick(poolId, tick);
        poolManager.setLiquidity(poolId, 1e18);

        oracle.setV4Pool(address(poolManager), key, false);
        oracle.setSwapRecorder(address(this), true);

        // Record exactly one post-init observation.
        vm.warp(block.timestamp + 10);
        oracle.recordSwapObservation();

        // Ask for a much longer duration than we actually have history for.
        // Correct behavior: use the oldest *initialized* observation (shorter window) rather than an uninitialized slot.
        int24 twapTick = oracle.getTWAPTick(1800);
        assertEq(twapTick, tick, "TWAP should match the constant tick, not collapse toward 0");
    }

    function test_recordSwapObservation_BaseAutoUpdate_RequiresMinWindow() public {
        vm.chainId(8453);
        vm.warp(1_700_000_000);

        MockChainlinkFeedForCreatorOracleTwapSafety feed = new MockChainlinkFeedForCreatorOracleTwapSafety();
        feed.setLatestAnswer(2000e8, block.timestamp);

        CreatorOracle oracle = _deployOracle(address(feed));
        oracle.setPriceUpdateCooldown(0);

        MockPoolManagerExtsloadForCreatorOracleTwapSafety poolManager =
            new MockPoolManagerExtsloadForCreatorOracleTwapSafety();
        address creatorToken = address(0xC0FFEE);
        PoolKey memory key = _defaultPoolKey(creatorToken);
        PoolId poolId = key.toId();

        poolManager.setSlot0Tick(poolId, 0);
        poolManager.setLiquidity(poolId, 1e18);

        oracle.setV4Pool(address(poolManager), key, false);
        oracle.setSwapRecorder(address(this), true);

        // 1) First record (creates 2nd observation state) - auto-update may run but should not write price yet.
        vm.warp(block.timestamp + 1);
        oracle.recordSwapObservation();

        // 2) Second record after only 60 seconds: vulnerable code can write price using a ~60s window.
        vm.warp(block.timestamp + 60);
        oracle.recordSwapObservation();

        assertEq(oracle.creatorPriceUSD(), int256(0), "auto-update should not write price with <30m history");

        // 3) Once we have >= 30 minutes of history, auto-update should be able to write a price.
        vm.warp(block.timestamp + 1800);
        oracle.recordSwapObservation();

        assertGt(oracle.creatorPriceUSD(), int256(0), "auto-update should write after >=30m history");
        assertEq(oracle.creatorPriceTimestamp(), block.timestamp);
    }

    function test_recordSwapObservation_BaseAutoUpdate_DoesNotBypassMaxDeviation() public {
        vm.chainId(8453);
        uint256 t0 = 1_700_000_000;
        vm.warp(t0);

        MockChainlinkFeedForCreatorOracleTwapSafety feed = new MockChainlinkFeedForCreatorOracleTwapSafety();
        feed.setLatestAnswer(2000e8, block.timestamp); // ETH/USD = 2000, 8 decimals

        CreatorOracle oracle = _deployOracle(address(feed));
        oracle.setPriceUpdateCooldown(0);

        MockPoolManagerExtsloadForCreatorOracleTwapSafety poolManager =
            new MockPoolManagerExtsloadForCreatorOracleTwapSafety();
        address creatorToken = address(0xC0FFEE);
        PoolKey memory key = _defaultPoolKey(creatorToken);
        PoolId poolId = key.toId();

        poolManager.setSlot0Tick(poolId, 0);
        poolManager.setLiquidity(poolId, 1e18);

        oracle.setV4Pool(address(poolManager), key, false);
        oracle.setSwapRecorder(address(this), true);
        oracle.setAutoTunePaused(true);

        // 1) Establish a baseline price via auto-update at tick = 0 (CREATOR/ETH ~= 1).
        vm.warp(t0 + 1);
        oracle.recordSwapObservation();
        vm.warp(t0 + 1801);
        oracle.recordSwapObservation();

        int256 oldPrice = oracle.creatorPriceUSD();
        assertGt(oldPrice, int256(0), "baseline price should be set");

        // 2) Make Chainlink stale so intermediate auto-updates do not write, while we manipulate observations.
        // MAX_STALENESS is 2 hours; 3 hours ensures staleness.
        uint256 windowStart = t0 + 1801;
        feed.setLatestAnswer(2000e8, windowStart - 3 hours);

        // 3) Gradually drift the pool tick within the per-observation cap, pushing the 30m TWAP far enough
        //    that the derived USD price would deviate > MAX_PRICE_DEVIATION from the stored value.
        for (uint256 i = 1; i <= 23; i++) {
            vm.warp(windowStart + i);
            int24 tick = int24(-int256(i * 100)); // -100 ticks per observation (within default cap=100)
            poolManager.setSlot0Tick(poolId, tick);
            oracle.recordSwapObservation();
            assertEq(oracle.creatorPriceUSD(), oldPrice, "stale Chainlink should prevent writes");
        }

        // 4) End the fixed 30m window at a much lower tick (hold at -2300), refresh Chainlink, and trigger
        //    one more observation that would cause a large one-step price jump if not deviation-guarded.
        vm.warp(windowStart + 1800);
        poolManager.setSlot0Tick(poolId, -2300);
        feed.setLatestAnswer(2000e8, windowStart + 1800); // fresh again

        oracle.recordSwapObservation();

        // Desired behavior: auto-update should NOT overwrite the stored price with a >MAX deviation jump.
        // (This assertion should fail on the vulnerable implementation.)
        assertEq(oracle.creatorPriceUSD(), oldPrice);
    }

    function test_tickToPrice_DoesNotOverflowAtValidTickBounds() public {
        CreatorOracle oracle = _deployOracle(address(0));

        // Uniswap tick bounds (v4 TickMath) are +/- 887272.
        oracle.tickToPrice(int24(887272));
        oracle.tickToPrice(int24(-887272));
    }
}

