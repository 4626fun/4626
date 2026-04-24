// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {CreatorOracle} from "../contracts/utilities/oracles/CreatorOracle.sol";

import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

/**
 * @title CreatorOracle — dedicated ring-buffer regression suite [M-02][4626-436]
 * @notice Covers the three ring-buffer scenarios listed in
 *         `docs/audits/4626/acceptances/M-02-custom-twap-ring-buffer.md`
 *         mitigation item (1) that were not previously exercised:
 *           1. same-block write (time delta 0) is idempotent
 *           2. full wrap-around (cardinality + 1 writes) does not corrupt the
 *              ring index or cumulative-tick accumulator
 *           3. cumulative-tick monotonicity across the wrap boundary
 *
 *         These tests land alongside the existing `CreatorOracle.TwapSafety.t.sol`
 *         coverage (first-write index advance, buffer-not-yet-full read path,
 *         tick-cap, and deviation guards).
 */
contract MockRegistryForRingBuffer {
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

/// @dev Minimal V4 PoolManager mock mirroring the one in CreatorOracle.TwapSafety.t.sol.
contract MockPoolManagerExtsloadForRingBuffer {
    mapping(bytes32 => bytes32) internal slots;

    bytes32 internal constant POOLS_SLOT = bytes32(uint256(6));
    uint256 internal constant LIQUIDITY_OFFSET = 3;

    function extsload(bytes32 slot) external view returns (bytes32 value) {
        return slots[slot];
    }

    function setSlot0Tick(PoolId poolId, int24 tick) external {
        bytes32 stateSlot = keccak256(abi.encodePacked(PoolId.unwrap(poolId), POOLS_SLOT));
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

contract CreatorOracleRingBufferTest is Test {
    using PoolIdLibrary for PoolKey;

    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    uint32 internal constant HUB_EID = 30184;

    // Must track MAX_CARDINALITY in CreatorOracle.sol. If the constant changes,
    // this test needs to be updated in lockstep.
    uint16 internal constant MAX_CARDINALITY = 1024;

    CreatorOracle internal oracle;
    MockPoolManagerExtsloadForRingBuffer internal poolManager;
    PoolKey internal key;
    PoolId internal poolId;

    function setUp() public {
        vm.warp(1_700_000_000);

        // OAppCore constructor calls endpoint.setDelegate(delegate); mock it.
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(address(this)));

        MockRegistryForRingBuffer registry = new MockRegistryForRingBuffer(LZ_ENDPOINT, HUB_EID);
        oracle = new CreatorOracle(address(registry), address(0), "TEST", address(this));

        poolManager = new MockPoolManagerExtsloadForRingBuffer();
        address creatorToken = address(0xC0FFEE);
        key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(creatorToken),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
        poolId = key.toId();

        poolManager.setSlot0Tick(poolId, 0);
        poolManager.setLiquidity(poolId, 1e18);

        oracle.setV4Pool(address(poolManager), key, false);
        oracle.setSwapRecorder(address(this), true);

        // Tick-cap is irrelevant for these tests — disable by setting a generous value so
        // observations record the raw tick unchanged.
        oracle.setMaxTicksPerObservation(int24(50_000));
    }

    // --------------------------------------------------------------------- //
    //  (1) Same-block write (time delta 0) is idempotent                     //
    // --------------------------------------------------------------------- //
    function test_ringBuffer_sameBlockWriteIsIdempotent() public {
        // Seed the ring with two observations at distinct timestamps so cardinality >= 2
        // and getTWAPTick is legal.
        vm.warp(block.timestamp + 10);
        poolManager.setSlot0Tick(poolId, 100);
        oracle.recordSwapObservation();

        vm.warp(block.timestamp + 60);
        poolManager.setSlot0Tick(poolId, 200);
        oracle.recordSwapObservation();

        (uint16 idxBefore, uint16 cardBefore, uint16 cardNextBefore, uint32 lastTsBefore) =
            oracle.getObservationState();

        // Pull the full slot at the current index so we can detect *any* field mutation.
        (
            uint32 tsBefore,
            int56 tcBefore,
            int56 tctBefore,
            uint160 splBefore,
            int24 prevTickBefore,
            bool initBefore
        ) = oracle.observations(idxBefore);
        assertTrue(initBefore, "precondition: newest slot initialized");

        // Second call in the same block must be a no-op for the ring structure.
        // (The internal `delta == 0` branch at CreatorOracle.sol:620-621 short-circuits
        //  before any index advance or cumulative update.)
        oracle.recordSwapObservation();

        (uint16 idxAfter, uint16 cardAfter, uint16 cardNextAfter, uint32 lastTsAfter) =
            oracle.getObservationState();

        assertEq(idxAfter, idxBefore, "same-block write must not advance index");
        assertEq(cardAfter, cardBefore, "same-block write must not grow cardinality");
        assertEq(cardNextAfter, cardNextBefore, "same-block write must not grow cardinalityNext");
        assertEq(lastTsAfter, lastTsBefore, "same-block write must not update lastObservationTimestamp");

        (uint32 tsAfter, int56 tcAfter, int56 tctAfter, uint160 splAfter, int24 prevTickAfter, bool initAfter) =
            oracle.observations(idxAfter);

        assertEq(tsAfter, tsBefore, "slot timestamp unchanged");
        assertEq(tcAfter, tcBefore, "tickCumulative unchanged");
        assertEq(tctAfter, tctBefore, "tickCumulativeTruncated unchanged");
        assertEq(splAfter, splBefore, "secondsPerLiquidityCumulativeX128 unchanged");
        assertEq(prevTickAfter, prevTickBefore, "prevTruncatedTick unchanged");
        assertEq(initAfter, initBefore, "initialized flag unchanged");

        // Third attempt in the same block — still idempotent.
        oracle.recordSwapObservation();
        (uint16 idxAfter2, uint16 cardAfter2,,) = oracle.getObservationState();
        assertEq(idxAfter2, idxBefore, "subsequent same-block writes remain idempotent");
        assertEq(cardAfter2, cardBefore, "subsequent same-block writes remain idempotent");

        // TWAP over the last 60s must still be computable and finite.
        // Step to a new block first so block.timestamp != newest obs timestamp.
        vm.warp(block.timestamp + 1);
        int24 twap = oracle.getTWAPTick(60);
        // With ticks (100 -> 200) held over 60s, twap should be near 200 (integrating 200 over the window).
        assertEq(twap, int24(200), "twap across idempotent window unchanged");
    }

    // --------------------------------------------------------------------- //
    //  (2) Full wrap-around (N+1 writes into a size-N buffer)                //
    // --------------------------------------------------------------------- //
    function test_ringBuffer_wrapAroundAtMaxCardinality() public {
        // Hold a constant non-zero tick so cumulatives are predictable.
        int24 heldTick = 100;
        poolManager.setSlot0Tick(poolId, heldTick);

        // Advance one second per write so every call passes the `delta > 0` gate.
        // First call initializes the second slot (cardinality 1 -> 2).
        // We need MAX_CARDINALITY total writes to fully initialize the ring, then
        // one more to verify wrap semantics.
        //
        // Observation: cardinalityNext grows by 1 each write until it hits MAX_CARDINALITY.
        // Starting state is (index=0, cardinality=1, cardinalityNext=1) from setV4Pool's
        // seed write at slot 0. The first recordSwapObservation() brings it to
        // (index=1, cardinality=2, cardinalityNext=2). So after k recordSwapObservation()
        // calls we have cardinalityNext = min(k + 1, MAX_CARDINALITY).
        //
        // That means MAX_CARDINALITY - 1 calls fill the ring (cardinalityNext == MAX_CARDINALITY,
        // index == MAX_CARDINALITY - 1). The MAX_CARDINALITY'th call is where wrap happens:
        // newIndex = (MAX_CARDINALITY - 1 + 1) % MAX_CARDINALITY = 0.

        uint256 fills = uint256(MAX_CARDINALITY) - 1;
        for (uint256 i = 0; i < fills; i++) {
            vm.warp(block.timestamp + 1);
            oracle.recordSwapObservation();
        }

        (uint16 idxBeforeWrap, uint16 cardBeforeWrap, uint16 cardNextBeforeWrap,) = oracle.getObservationState();
        assertEq(cardNextBeforeWrap, MAX_CARDINALITY, "cardinalityNext should have reached max");
        assertEq(cardBeforeWrap, MAX_CARDINALITY, "cardinality should equal cardinalityNext when ring is fully initialized");
        assertEq(idxBeforeWrap, MAX_CARDINALITY - 1, "index should be at final slot before wrap");

        // Capture slot 0's state (oldest at the moment) — it will be overwritten by the wrap.
        (uint32 oldestTsPreWrap,,,,,) = oracle.observations(0);

        // Snapshot cumulative value at slot MAX_CARDINALITY - 1 (newest pre-wrap).
        (, int56 tcNewestPre,,,,) = oracle.observations(MAX_CARDINALITY - 1);

        // The N+1'th write — wrap.
        vm.warp(block.timestamp + 1);
        oracle.recordSwapObservation();

        (uint16 idxAfter, uint16 cardAfter, uint16 cardNextAfter,) = oracle.getObservationState();
        assertEq(idxAfter, 0, "index wraps to 0");
        assertEq(cardAfter, MAX_CARDINALITY, "cardinality stays at max after wrap");
        assertEq(cardNextAfter, MAX_CARDINALITY, "cardinalityNext stays at max after wrap");

        // Slot 0 now contains the newest observation, not the original oldest.
        (uint32 slot0TsAfter,, , , , bool slot0Init) = oracle.observations(0);
        assertTrue(slot0Init, "wrapped slot is still initialized");
        assertGt(slot0TsAfter, oldestTsPreWrap, "slot 0 now holds the newest observation");
        assertEq(slot0TsAfter, uint32(block.timestamp), "slot 0 timestamp equals wrap-write timestamp");

        // Cumulative tick must be strictly monotonic across the wrap.
        (, int56 tcNewestPost,,,,) = oracle.observations(0);
        assertGt(tcNewestPost, tcNewestPre, "tickCumulative strictly increases across wrap");

        // TWAP is still computable after the wrap and matches the held tick.
        int24 twap = oracle.getTWAPTick(10);
        assertEq(twap, heldTick, "TWAP across wrap recovers the held tick");
    }

    // --------------------------------------------------------------------- //
    //  (3) Cumulative-tick monotonicity across wrap boundary                 //
    // --------------------------------------------------------------------- //
    function test_ringBuffer_cumulativeTickMonotonicityAcrossWrap() public {
        int24 heldTick = 50;
        poolManager.setSlot0Tick(poolId, heldTick);

        // Same fill strategy as test (2), but then do a few post-wrap writes so we can
        // query TWAPs across windows that do and do not straddle the wrap boundary.
        uint256 fills = uint256(MAX_CARDINALITY) - 1;
        for (uint256 i = 0; i < fills; i++) {
            vm.warp(block.timestamp + 1);
            oracle.recordSwapObservation();
        }
        (, , uint16 cardNext,) = oracle.getObservationState();
        assertEq(cardNext, MAX_CARDINALITY, "ring initialized");

        // 5 post-wrap writes.
        for (uint256 j = 0; j < 5; j++) {
            vm.warp(block.timestamp + 1);
            oracle.recordSwapObservation();
        }

        // For a buffer that has wrapped, iterate getTWAPTick at several window sizes and
        // assert the returned TWAP equals `heldTick`. A non-monotonic or sign-flipped
        // cumulative-tick accumulator across the wrap would produce a different TWAP
        // (often 0 or negative) for windows that span the boundary.
        vm.warp(block.timestamp + 1);

        uint32[7] memory windows = [uint32(2), 5, 10, 30, 60, 120, 300];
        for (uint256 k = 0; k < windows.length; k++) {
            int24 twap = oracle.getTWAPTick(windows[k]);
            assertEq(twap, heldTick, "TWAP monotonically recovers held tick across wrap");
        }

        // Additional sanity: walk backwards through all initialized slots and assert
        // tickCumulative is monotonically non-decreasing with timestamp. Because the
        // ring is now un-ordered in storage (slot 0..4 hold the newest writes; slot 5..
        // MAX_CARDINALITY-1 hold the older ones), sort by timestamp on the fly.
        int56 prevCumulative = type(int56).min;
        uint32 prevTs = 0;

        // Find the oldest by timestamp, then walk forward through ring order.
        (uint16 curIdx, uint16 curCard,,) = oracle.getObservationState();
        // Oldest is the slot immediately *after* curIdx in ring order.
        uint16 oldest = uint16((uint256(curIdx) + 1) % uint256(curCard));

        for (uint16 step = 0; step < curCard; step++) {
            uint16 probe = uint16((uint256(oldest) + step) % uint256(curCard));
            (uint32 ts, int56 tc,,,, bool init) = oracle.observations(probe);
            if (!init) continue;
            assertGe(ts, prevTs, "timestamps monotonic in ring order from oldest");
            assertGe(tc, prevCumulative, "tickCumulative monotonic in ring order from oldest");
            prevTs = ts;
            prevCumulative = tc;
        }
    }
}
