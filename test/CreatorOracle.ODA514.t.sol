// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {CreatorOracle} from "@4626/creator/oracles/CreatorOracle.sol";
import {CreatorOracleQuoteLib} from "@4626/creator/oracles/CreatorOracleQuoteLib.sol";
import {Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

contract MockRegistryODA514 {
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

contract MockFeedODA514 {
    int256 public answer;
    uint256 public startedAt;
    uint256 public updatedAt;
    uint80 public roundId = 1;
    uint80 public answeredInRound = 1;
    bool public revertLatest;

    function decimals() external pure returns (uint8) {
        return 8;
    }

    function setRound(int256 _answer, uint256 _startedAt, uint256 _updatedAt, uint80 _roundId, uint80 _answeredInRound)
        external
    {
        answer = _answer;
        startedAt = _startedAt;
        updatedAt = _updatedAt;
        roundId = _roundId;
        answeredInRound = _answeredInRound;
    }

    function setRevertLatest(bool shouldRevert) external {
        revertLatest = shouldRevert;
    }

    function latestRoundData()
        external
        view
        returns (uint80, int256, uint256, uint256, uint80)
    {
        if (revertLatest) revert("feed reverted");
        return (roundId, answer, startedAt, updatedAt, answeredInRound);
    }
}

contract MockPoolManagerODA514 {
    mapping(bytes32 => bytes32) internal slots;

    bytes32 internal constant POOLS_SLOT = bytes32(uint256(6));
    uint256 internal constant LIQUIDITY_OFFSET = 3;

    function extsload(bytes32 slot) external view returns (bytes32 value) {
        return slots[slot];
    }

    function setSlot0(PoolId poolId, uint160 sqrtPriceX96, int24 tick) external {
        bytes32 stateSlot = keccak256(abi.encodePacked(PoolId.unwrap(poolId), POOLS_SLOT));
        uint256 word = uint256(sqrtPriceX96) | (uint256(uint24(tick)) << 160);
        slots[stateSlot] = bytes32(word);
    }

    function setLiquidity(PoolId poolId, uint128 liquidity) external {
        bytes32 stateSlot = keccak256(abi.encodePacked(PoolId.unwrap(poolId), POOLS_SLOT));
        bytes32 liquiditySlot = bytes32(uint256(stateSlot) + LIQUIDITY_OFFSET);
        slots[liquiditySlot] = bytes32(uint256(liquidity));
    }
}

contract MockTokenDecimalsODA514 {
    uint8 internal immutable _decimals;

    constructor(uint8 decimals_) {
        _decimals = decimals_;
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }
}

contract MockV3PoolObserveRevertsODA514 {
    address public immutable token0;
    address public immutable token1;
    uint128 public immutable liquidity;

    constructor(address _token0, address _token1, uint128 _liquidity) {
        token0 = _token0;
        token1 = _token1;
        liquidity = _liquidity;
    }

    function observe(uint32[] calldata) external pure returns (int56[] memory, uint160[] memory) {
        revert("observe unavailable");
    }
}

contract CreatorOracleODA514Test is Test {
    using PoolIdLibrary for PoolKey;

    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    uint32 internal constant HUB_EID = 30184;
    bytes32 internal constant HUB_PEER = bytes32(uint256(uint160(address(0xBEEF))));

    function _deployOracle(address chainlinkFeed) internal returns (CreatorOracle oracle) {
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(address(this)));
        MockRegistryODA514 registry = new MockRegistryODA514(LZ_ENDPOINT, HUB_EID);
        oracle = new CreatorOracle(address(registry), chainlinkFeed, "TEST", address(this));
    }

    function _defaultPoolKey(address creatorToken, uint24 fee) internal pure returns (PoolKey memory key) {
        key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(creatorToken),
            fee: fee,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
    }

    function _configurePool(
        CreatorOracle oracle,
        MockPoolManagerODA514 poolManager,
        int24 tick,
        uint24 fee
    ) internal returns (PoolKey memory key, PoolId poolId) {
        address creatorToken = address(new MockTokenDecimalsODA514(18));
        key = _defaultPoolKey(creatorToken, fee);
        poolId = key.toId();
        poolManager.setSlot0(poolId, 1, tick);
        poolManager.setLiquidity(poolId, 1e18);
        oracle.setV4Pool(address(poolManager), key, false);
    }

    function test_updateAssetPrice_enforcesCooldownAndSequencerGuard() external {
        vm.chainId(8453);
        vm.warp(1_700_000_000);

        MockFeedODA514 ethFeed = new MockFeedODA514();
        ethFeed.setRound(3000e8, block.timestamp - 2 hours, block.timestamp, 1, 1);

        MockFeedODA514 sequencerFeed = new MockFeedODA514();
        sequencerFeed.setRound(0, block.timestamp - 2 hours, block.timestamp, 1, 1);

        CreatorOracle oracle = _deployOracle(address(ethFeed));
        oracle.setSequencerUptimeFeed(address(sequencerFeed));
        oracle.initializeAssetPrice(int256(1e18));

        vm.warp(block.timestamp + 31);
        oracle.updateAssetPrice(int256(1.1e18));

        vm.expectRevert(CreatorOracle.PriceUpdateCooldown.selector);
        oracle.updateAssetPrice(int256(1.2e18));

        vm.warp(block.timestamp + 31);
        sequencerFeed.setRound(1, block.timestamp, block.timestamp, 2, 2);
        vm.expectRevert(CreatorOracle.SequencerDown.selector);
        oracle.updateAssetPrice(int256(1.2e18));
    }

    function test_setV4Pool_resetsHistoryWhenPoolIdentityChangesOnSameManager() external {
        vm.warp(1_700_000_000);

        CreatorOracle oracle = _deployOracle(address(0));
        MockPoolManagerODA514 poolManager = new MockPoolManagerODA514();

        (PoolKey memory key1, PoolId poolId1) = _configurePool(oracle, poolManager, 100, 3000);
        oracle.setSwapRecorder(address(this), true);

        vm.warp(block.timestamp + 10);
        oracle.recordSwapObservation();
        vm.warp(block.timestamp + 1800);
        oracle.recordSwapObservation();

        address creatorToken = Currency.unwrap(key1.currency1);
        PoolKey memory key2 = _defaultPoolKey(creatorToken, 500);
        PoolId poolId2 = key2.toId();
        poolManager.setSlot0(poolId2, 1, 250);
        poolManager.setLiquidity(poolId2, 1e18);

        oracle.setV4Pool(address(poolManager), key2, false);

        (uint16 index, uint16 cardinality, uint16 cardinalityNext,) = oracle.getObservationState();
        assertEq(index, 0);
        assertEq(cardinality, 1);
        assertEq(cardinalityNext, 1);

        (uint32 ts,,,, int24 prevTruncatedTick, bool initialized) = oracle.observations(0);
        assertTrue(initialized);
        assertEq(ts, uint32(block.timestamp));
        assertEq(prevTruncatedTick, 250);

        assertTrue(PoolId.unwrap(poolId1) != PoolId.unwrap(poolId2), "sanity: pool identities differ");
    }

    function test_setV4Pool_resetAllowsCardinalityGrowthAfterPoolIdentityChange() external {
        uint256 t0 = 1_700_000_000;
        vm.warp(t0);

        CreatorOracle oracle = _deployOracle(address(0));
        MockPoolManagerODA514 poolManager = new MockPoolManagerODA514();

        (PoolKey memory key1,) = _configurePool(oracle, poolManager, 100, 3000);
        oracle.setSwapRecorder(address(this), true);

        // Grow the ring past the post-reset cardinalityNext=1 shape.
        vm.warp(t0 + 10);
        oracle.recordSwapObservation();
        vm.warp(t0 + 20);
        oracle.recordSwapObservation();
        vm.warp(t0 + 30);
        oracle.recordSwapObservation();
        (, uint16 cardinalityBefore,,) = oracle.getObservationState();
        assertGe(cardinalityBefore, 2);

        address creatorToken = Currency.unwrap(key1.currency1);
        PoolKey memory key2 = _defaultPoolKey(creatorToken, 500);
        PoolId poolId2 = key2.toId();
        poolManager.setSlot0(poolId2, 1, 250);
        poolManager.setLiquidity(poolId2, 1e18);

        // Leave a poisoned initialized flag at index 1, then reset pool identity.
        // The reset must clear it (or otherwise allow cardinality to grow again).
        (,,,,, bool slot1InitBeforeReset) = oracle.observations(1);
        assertTrue(slot1InitBeforeReset);

        oracle.setV4Pool(address(poolManager), key2, false);

        (uint16 indexAfterReset, uint16 cardinalityAfterReset, uint16 cardinalityNextAfterReset,) =
            oracle.getObservationState();
        assertEq(indexAfterReset, 0);
        assertEq(cardinalityAfterReset, 1);
        assertEq(cardinalityNextAfterReset, 1);
        (,,,,, bool slot1InitAfterReset) = oracle.observations(1);
        assertFalse(slot1InitAfterReset, "reset must clear stale initialized flags");

        vm.warp(t0 + 40);
        oracle.recordSwapObservation();
        (, uint16 cardinalityAfterFirstRecord, uint16 cardinalityNextAfterFirstRecord,) = oracle.getObservationState();
        assertEq(cardinalityNextAfterFirstRecord, 2);
        assertEq(cardinalityAfterFirstRecord, 2, "cardinality must grow after pool-identity reset");

        vm.warp(t0 + 50);
        oracle.recordSwapObservation();
        (, uint16 cardinalityAfterSecondRecord,,) = oracle.getObservationState();
        assertEq(cardinalityAfterSecondRecord, 3);
    }

    function test_setV4Pool_revertsOnWrongOrientation() external {
        vm.warp(1_700_000_000);

        CreatorOracle oracle = _deployOracle(address(0));
        MockPoolManagerODA514 poolManager = new MockPoolManagerODA514();
        address creatorToken = address(new MockTokenDecimalsODA514(18));
        PoolKey memory key = _defaultPoolKey(creatorToken, 3000);
        PoolId poolId = key.toId();

        poolManager.setSlot0(poolId, 1, 100);
        poolManager.setLiquidity(poolId, 1e18);

        vm.expectRevert(CreatorOracle.InvalidV4Pool.selector);
        oracle.setV4Pool(address(poolManager), key, true);
    }

    function test_updateAssetPriceFromTWAP_usesBlockTimestampAnchorForWindowValidation() external {
        vm.chainId(8453);
        vm.warp(1_700_008_100);

        MockFeedODA514 ethFeed = new MockFeedODA514();
        ethFeed.setRound(2000e8, block.timestamp - 2 hours, block.timestamp, 1, 1);

        CreatorOracle oracle = _deployOracle(address(ethFeed));
        oracle.setPriceUpdateCooldown(oracle.MIN_PRICE_UPDATE_COOLDOWN());
        vm.warp(block.timestamp + oracle.MIN_PRICE_UPDATE_COOLDOWN());

        MockPoolManagerODA514 poolManager = new MockPoolManagerODA514();
        _configurePool(oracle, poolManager, 0, 3000);
        oracle.setSwapRecorder(address(this), true);
        oracle.initializeAssetPrice(int256(2000e18));

        vm.warp(1_700_009_900);
        oracle.recordSwapObservation();
        vm.warp(1_700_010_000);
        oracle.recordSwapObservation();
        vm.warp(1_700_011_700);

        vm.expectRevert(CreatorOracle.StaleObservationWindow.selector);
        oracle.updateAssetPriceFromTWAP(1800);
    }

    function test_getTWAPTick_revertsBelowMinimumWindow() external {
        vm.warp(1_700_000_000);

        CreatorOracle oracle = _deployOracle(address(0));
        MockPoolManagerODA514 poolManager = new MockPoolManagerODA514();
        _configurePool(oracle, poolManager, 100, 3000);
        oracle.setSwapRecorder(address(this), true);

        vm.warp(block.timestamp + 10);
        oracle.recordSwapObservation();
        vm.warp(block.timestamp + 1800);
        oracle.recordSwapObservation();

        vm.expectRevert(CreatorOracle.InvalidDuration.selector);
        oracle.getTWAPTick(60);
    }

    function test_lzReceive_clampsEvenWhenRemoteStateIsStale() external {
        vm.warp(1_700_000_000);

        CreatorOracle oracle = _deployOracle(address(0));
        oracle.setPeer(HUB_EID, HUB_PEER);

        Origin memory origin = Origin({srcEid: HUB_EID, sender: HUB_PEER, nonce: 1});

        vm.prank(LZ_ENDPOINT);
        oracle.lzReceive(origin, bytes32(0), abi.encode(int256(1e18), block.timestamp, string("TEST")), address(0), "");
        assertEq(oracle.assetPriceUSD(), int256(1e18));

        vm.warp(block.timestamp + oracle.MAX_STALENESS() + 1);
        vm.prank(LZ_ENDPOINT);
        oracle.lzReceive(origin, bytes32(0), abi.encode(int256(10e18), block.timestamp, string("TEST")), address(0), "");

        assertEq(oracle.assetPriceUSD(), int256(1.2e18));
        assertEq(oracle.assetPriceTimestamp(), block.timestamp);
    }

    function test_renounceOwnership_isDisabled() external {
        CreatorOracle oracle = _deployOracle(address(0));
        vm.expectRevert(CreatorOracle.RenounceOwnershipDisabled.selector);
        oracle.renounceOwnership();
    }

    function test_setPriceUpdater_revokesImmediatelyAfterBootstrap() external {
        vm.chainId(8453);
        vm.warp(1_700_000_000);

        CreatorOracle oracle = _deployOracle(address(0));
        // Pre-bootstrap grant applies immediately.
        address updater = makeAddr("updater-revoke");
        oracle.setPriceUpdater(updater, true);
        assertTrue(oracle.isPriceUpdater(updater));

        // Bootstrap price so critical-config delay activates for subsequent grants.
        oracle.initializeAssetPrice(int256(1e18));

        address other = makeAddr("updater-other");
        oracle.setPriceUpdater(other, true);
        (address pendingUpdater,,, bool queuedGrant) = oracle.pendingPriceUpdater();
        assertTrue(queuedGrant, "post-bootstrap grants must queue");
        assertEq(pendingUpdater, other);
        assertFalse(oracle.isPriceUpdater(other));

        // Revocation of an already-authorized updater must apply immediately.
        oracle.setPriceUpdater(updater, false);
        assertFalse(oracle.isPriceUpdater(updater), "revocation must not wait for critical-config delay");

        // Pending grant for `other` must remain queued.
        (address stillPending,,, bool stillQueued) = oracle.pendingPriceUpdater();
        assertTrue(stillQueued);
        assertEq(stillPending, other);
    }

    function test_setPriceUpdater_requiresDelayAfterBootstrap() external {
        vm.chainId(8453);
        vm.warp(1_700_000_000);

        CreatorOracle oracle = _deployOracle(address(0));
        oracle.initializeAssetPrice(int256(1e18));

        address updater = address(0xA11CE);
        oracle.setPriceUpdater(updater, true);
        assertFalse(oracle.isPriceUpdater(updater));

        (,, uint48 executeAfter, bool queued) = oracle.pendingPriceUpdater();
        assertTrue(queued);
        vm.expectRevert(abi.encodeWithSelector(CreatorOracle.CriticalConfigNotReady.selector, uint256(executeAfter)));
        oracle.executePriceUpdaterUpdate();

        vm.warp(block.timestamp + oracle.CRITICAL_CONFIG_DELAY());
        oracle.executePriceUpdaterUpdate();
        assertTrue(oracle.isPriceUpdater(updater));
    }

    function test_getEthPrice_returnsZeroWhenSequencerFeedRevertsOrIsInvalid() external {
        vm.chainId(8453);
        vm.warp(1_700_000_000);

        MockFeedODA514 ethFeed = new MockFeedODA514();
        ethFeed.setRound(3000e8, block.timestamp - 2 hours, block.timestamp, 1, 1);

        MockFeedODA514 sequencerFeed = new MockFeedODA514();
        sequencerFeed.setRound(0, block.timestamp - 2 hours, block.timestamp, 1, 1);

        CreatorOracle oracle = _deployOracle(address(ethFeed));
        oracle.setSequencerUptimeFeed(address(sequencerFeed));

        sequencerFeed.setRevertLatest(true);
        (int256 priceOnRevert, uint256 tsOnRevert) = oracle.getEthPrice();
        assertEq(priceOnRevert, 0);
        assertEq(tsOnRevert, 0);

        sequencerFeed.setRevertLatest(false);
        sequencerFeed.setRound(0, 0, block.timestamp, 2, 2);
        (int256 priceOnInvalidRound, uint256 tsOnInvalidRound) = oracle.getEthPrice();
        assertEq(priceOnInvalidRound, 0);
        assertEq(tsOnInvalidRound, 0);
    }

    function test_getV3TWAPTick_revertsNeedMoreObservationsWhenObserveFails() external {
        vm.warp(1_700_000_000);

        CreatorOracle oracle = _deployOracle(address(0));
        address creatorToken = address(new MockTokenDecimalsODA514(18));
        address usdToken = address(new MockTokenDecimalsODA514(18));
        address pool = address(new MockV3PoolObserveRevertsODA514(creatorToken, usdToken, 1e12));

        oracle.setV3Pool(pool, creatorToken, usdToken, 1800);

        vm.expectRevert(CreatorOracleQuoteLib.NeedMoreObservations.selector);
        oracle.getV3TWAPTick(1800);
    }

    function test_setTickCapPolicy_revertsWhenMaxCapExceedsManualCeiling() external {
        CreatorOracle oracle = _deployOracle(address(0));
        vm.expectRevert(bytes("Invalid range"));
        oracle.setTickCapPolicy(10, 1001, 500, 10_000);
    }
}
