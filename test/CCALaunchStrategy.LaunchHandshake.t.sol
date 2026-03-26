// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {CCALaunchStrategy} from "../contracts/vault/strategies/CCALaunchStrategy.sol";

contract MockLaunchToken is ERC20 {
    constructor() ERC20("Launch Token", "LTKN") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockLaunchOracle {
    int256 public creatorPrice;
    int256 public ethPrice;
    uint256 public creatorTimestamp;
    uint256 public ethTimestamp;

    function setPrices(int256 _creatorPrice, uint256 _creatorTimestamp, int256 _ethPrice, uint256 _ethTimestamp)
        external
    {
        creatorPrice = _creatorPrice;
        creatorTimestamp = _creatorTimestamp;
        ethPrice = _ethPrice;
        ethTimestamp = _ethTimestamp;
    }

    function getCreatorPrice() external view returns (int256 price, uint256 timestamp) {
        return (creatorPrice, creatorTimestamp);
    }

    function getEthPrice() external view returns (int256 price, uint256 timestamp) {
        return (ethPrice, ethTimestamp);
    }
}

contract MockAuction {
    bool public tokensReceived;
    uint256 public onTokensReceivedCalls;
    uint128 public immutable auctionSupply;
    bool public graduated;

    constructor(uint128 supply, bool _graduated) {
        auctionSupply = supply;
        graduated = _graduated;
    }

    function submitBid(uint256, uint128, address, uint256, bytes calldata) external payable returns (uint256 bidId) {
        bidId = 0;
    }

    function checkpoint() external {}
    function exitBid(uint256) external {}
    function claimTokens(uint256) external {}

    function isGraduated() external view returns (bool) {
        return graduated;
    }
    function sweepCurrency() external {}
    function sweepUnsoldTokens() external {}

    function clearingPrice() external pure returns (uint256) {
        return 0;
    }

    function currencyRaised() external pure returns (uint256) {
        return 0;
    }

    function totalSupply() external view returns (uint128) {
        return auctionSupply;
    }

    function onTokensReceived() external {
        tokensReceived = true;
        onTokensReceivedCalls++;
    }

    function setGraduated(bool value) external {
        graduated = value;
    }
}

contract MockCcaFactory {
    address public lastToken;
    uint256 public lastAmount;
    bytes public lastConfigData;
    bytes32 public lastSalt;
    MockAuction public lastAuction;
    bool public nextGraduated = true;

    function setNextGraduated(bool value) external {
        nextGraduated = value;
    }

    function initializeDistribution(address token, uint256 amount, bytes calldata configData, bytes32 salt)
        external
        returns (address)
    {
        lastToken = token;
        lastAmount = amount;
        lastConfigData = configData;
        lastSalt = salt;

        lastAuction = new MockAuction(uint128(amount), nextGraduated);
        return address(lastAuction);
    }
}

contract CCALaunchStrategyLaunchHandshakeTest is Test {
    uint24 internal constant MPS = 10_000_000;
    uint8 internal constant PHASE_AUCTION_LIVE = 1;
    uint8 internal constant PHASE_AUCTION_SCHEDULED = 7;

    struct EncodedAuctionParams {
        address currency;
        address tokensRecipient;
        address fundsRecipient;
        uint64 startBlock;
        uint64 endBlock;
        uint64 claimBlock;
        uint256 tickSpacing;
        address validationHook;
        uint256 floorPrice;
        uint128 requiredCurrencyRaised;
        bytes auctionStepsData;
    }

    MockLaunchToken internal token;
    CCALaunchStrategy internal strategy;
    MockCcaFactory internal factory;
    MockLaunchOracle internal oracle;

    function setUp() external {
        token = new MockLaunchToken();
        strategy = new CCALaunchStrategy(address(token), address(0), address(this), address(this), address(this));
        factory = new MockCcaFactory();
        oracle = new MockLaunchOracle();

        strategy.setCcaFactory(address(factory));
        oracle.setPrices(int256(2e18), block.timestamp, int256(2000e18), block.timestamp);
        strategy.setOracleConfig(address(oracle), address(0x1111), address(0x2222), address(this));

        token.mint(address(this), 1_000_000e18);
        token.approve(address(strategy), type(uint256).max);
    }

    function testLaunchAuctionUsesSafeScheduleAndFundsAuction() external {
        vm.roll(1_000_000);
        vm.warp(4 days + 13 hours);
        oracle.setPrices(int256(2e18), block.timestamp, int256(2000e18), block.timestamp);
        factory.setNextGraduated(false);

        uint256 launchBlock = block.number;
        uint256 launchTimestamp = block.timestamp;
        uint256 amount = 100_000e18;
        uint256 floorPrice = 1e15;
        uint128 requiredRaise = 1e18;
        bytes memory callerProvidedSteps = hex"1234";

        address auction = strategy.launchAuction(amount, floorPrice, requiredRaise, callerProvidedSteps);

        assertEq(auction, address(factory.lastAuction()), "auction address mismatch");
        assertEq(token.balanceOf(address(strategy)), 0, "strategy should not retain auction tokens");
        assertEq(token.balanceOf(auction), amount, "auction must be funded with full auction amount");

        MockAuction launchedAuction = MockAuction(auction);
        assertTrue(launchedAuction.tokensReceived(), "onTokensReceived should be called");
        assertEq(launchedAuction.onTokensReceivedCalls(), 1, "onTokensReceived should be called exactly once");

        EncodedAuctionParams memory params = abi.decode(factory.lastConfigData(), (EncodedAuctionParams));
        bytes memory expectedSafeSteps = _createUniswapSafeDefaultSteps(strategy.defaultDuration());
        uint256 expectedStartTimestamp = _nextThursdayStartTimestamp(launchTimestamp);
        uint256 expectedDeltaBlocks = _deriveExpectedStartDeltaBlocks(launchTimestamp, expectedStartTimestamp);

        assertEq(
            keccak256(params.auctionStepsData), keccak256(expectedSafeSteps), "strategy should enforce safe schedule"
        );
        assertTrue(
            keccak256(params.auctionStepsData) != keccak256(callerProvidedSteps),
            "caller-provided auctionSteps must be ignored"
        );
        assertEq(params.auctionStepsData.length, 24, "safe schedule should contain exactly 3 steps");
        assertEq(
            params.startBlock, uint64(launchBlock + expectedDeltaBlocks), "launch should align to next Thursday epoch"
        );
        assertEq(
            params.endBlock, params.startBlock + strategy.defaultDuration(), "end block should preserve 7-day duration"
        );

        CCALaunchStrategy.LifecycleStatus memory lifecycle = strategy.getLifecycleStatus();
        assertEq(lifecycle.phase, PHASE_AUCTION_SCHEDULED, "launch should remain scheduled before Thursday start");
        assertFalse(lifecycle.auctionWindowOpen, "auction window must stay closed before start");

        (uint24 finalMps, uint40 finalBlockDelta) = _parseStep(params.auctionStepsData, 2);
        assertEq(finalBlockDelta, 1, "final step should reserve the final block");
        assertGt(finalMps, 1_000_000, "final step should sell a significant amount");

        uint256 rawFloorPriceQ96 = _deriveExpectedFloorPriceQ96(uint256(2e18), uint256(2000e18), 8000);
        uint256 expectedTickSpacingQ96 = _deriveExpectedTickSpacingQ96(rawFloorPriceQ96, 100);
        uint256 expectedFloorPriceQ96 = (rawFloorPriceQ96 / expectedTickSpacingQ96) * expectedTickSpacingQ96;

        assertEq(params.floorPrice, expectedFloorPriceQ96, "launch floor should be derived onchain");
        assertEq(params.tickSpacing, expectedTickSpacingQ96, "tick spacing should match derived launch floor");
        assertTrue(params.floorPrice != floorPrice, "caller floor input must be ignored");

        vm.roll(params.startBlock);
        lifecycle = strategy.getLifecycleStatus();
        assertEq(lifecycle.phase, PHASE_AUCTION_LIVE, "auction should become live at the scheduled start block");
        assertTrue(lifecycle.auctionWindowOpen, "auction window should open at the scheduled start block");
    }

    function testFinalizeFailedAuctionClearsCurrentAuction() external {
        factory.setNextGraduated(false);

        uint256 amount = 50_000e18;
        strategy.launchAuction(amount, 1e15, 1 ether, hex"");

        address launchedAuction = strategy.currentAuction();
        assertTrue(launchedAuction != address(0), "expected active auction");

        CCALaunchStrategy.LifecycleStatus memory lifecycle = strategy.getLifecycleStatus();
        vm.roll(lifecycle.endBlock + 1);
        strategy.finalizeFailedAuction();

        assertEq(strategy.currentAuction(), address(0), "failed auction should be cleared");
        address[] memory history = strategy.getPastAuctions();
        assertEq(history.length, 1, "failed auction should be archived");
        assertEq(history[0], launchedAuction, "archived auction mismatch");
    }

    function testLaunchAuctionRevertsWhenOraclePriceUnavailable() external {
        oracle.setPrices(0, block.timestamp, int256(2000e18), block.timestamp);

        vm.expectRevert(
            abi.encodeWithSelector(CCALaunchStrategy.LaunchOracleInvalidPrice.selector, int256(0), int256(2000e18))
        );
        strategy.launchAuction(10_000e18, 1e15, 1 ether, hex"");
    }

    function testLaunchAuctionRevertsWhenOraclePriceStale() external {
        vm.warp(20_000);
        uint256 staleTs = block.timestamp - 10_000;
        oracle.setPrices(int256(2e18), staleTs, int256(2000e18), staleTs);

        vm.expectRevert(
            abi.encodeWithSelector(
                CCALaunchStrategy.LaunchOracleStale.selector, staleTs, staleTs, uint64(7200), block.timestamp
            )
        );
        strategy.launchAuction(10_000e18, 1e15, 1 ether, hex"");
    }

    function testPreviewLaunchPricingSucceedsAtMaxAgeBoundary() external {
        uint64 maxAge = strategy.launchOracleMaxAge();
        vm.warp(50_000);
        uint256 boundaryTs = block.timestamp - maxAge;
        oracle.setPrices(int256(2e18), boundaryTs, int256(2000e18), boundaryTs);

        (uint256 floorPriceQ96, uint256 tickSpacingQ96, uint256 creatorUsdPrice, uint256 ethUsdPrice) =
            strategy.previewLaunchPricing();

        uint256 rawFloorPriceQ96 =
            _deriveExpectedFloorPriceQ96(uint256(2e18), uint256(2000e18), strategy.launchDiscountBps());
        uint256 expectedTickSpacingQ96 =
            _deriveExpectedTickSpacingQ96(rawFloorPriceQ96, strategy.launchTickSpacingBps());
        uint256 expectedFloorPriceQ96 = (rawFloorPriceQ96 / expectedTickSpacingQ96) * expectedTickSpacingQ96;

        assertEq(floorPriceQ96, expectedFloorPriceQ96, "floor should be derived at max-age boundary");
        assertEq(tickSpacingQ96, expectedTickSpacingQ96, "tick spacing should be derived at max-age boundary");
        assertEq(creatorUsdPrice, uint256(2e18), "creator price mismatch");
        assertEq(ethUsdPrice, uint256(2000e18), "eth price mismatch");
    }

    function testPreviewLaunchPricingRevertsWhenOracleNotConfigured() external {
        CCALaunchStrategy noOracleStrategy =
            new CCALaunchStrategy(address(token), address(0), address(this), address(this), address(this));
        vm.expectRevert(CCALaunchStrategy.LaunchOracleNotConfigured.selector);
        noOracleStrategy.previewLaunchPricing();
    }

    function testPreviewLaunchPricingRevertsForUnsupportedCurrency() external {
        CCALaunchStrategy erc20CurrencyStrategy =
            new CCALaunchStrategy(address(token), address(0xBEEF), address(this), address(this), address(this));
        erc20CurrencyStrategy.setOracleConfig(address(oracle), address(0x1111), address(0x2222), address(this));

        vm.expectRevert(abi.encodeWithSelector(CCALaunchStrategy.UnsupportedLaunchCurrency.selector, address(0xBEEF)));
        erc20CurrencyStrategy.previewLaunchPricing();
    }

    function testPreviewLaunchPricingRevertsWhenDerivedFloorRoundsToZero() external {
        oracle.setPrices(int256(1), block.timestamp, int256(2000e18), block.timestamp);

        vm.expectRevert(abi.encodeWithSelector(CCALaunchStrategy.LaunchFloorTooLow.selector, uint256(0), uint256(2)));
        strategy.previewLaunchPricing();
    }

    function testPreviewLaunchPricingRespectsUpdatedDiscountAndTickSpacing() external {
        strategy.setLaunchDiscountBps(10_000);
        strategy.setLaunchTickSpacingBps(250);

        (uint256 floorPriceQ96, uint256 tickSpacingQ96, uint256 creatorUsdPrice, uint256 ethUsdPrice) =
            strategy.previewLaunchPricing();

        uint256 rawFloorPriceQ96 = _deriveExpectedFloorPriceQ96(uint256(2e18), uint256(2000e18), 10_000);
        uint256 expectedTickSpacingQ96 = _deriveExpectedTickSpacingQ96(rawFloorPriceQ96, 250);
        uint256 expectedFloorPriceQ96 = (rawFloorPriceQ96 / expectedTickSpacingQ96) * expectedTickSpacingQ96;

        assertEq(floorPriceQ96, expectedFloorPriceQ96, "floor should respect updated discount");
        assertEq(tickSpacingQ96, expectedTickSpacingQ96, "tick spacing should respect updated bps");
        assertEq(creatorUsdPrice, uint256(2e18), "creator price mismatch");
        assertEq(ethUsdPrice, uint256(2000e18), "eth price mismatch");
    }

    function testPreviewLaunchPricingClampsTickSpacingToMinimum() external {
        strategy.setLaunchDiscountBps(10_000);
        strategy.setLaunchTickSpacingBps(1);

        uint256 tinyCreatorUsdPrice = 1;
        uint256 ethUsdPriceForRawThree = strategy.Q96() / 3;
        oracle.setPrices(int256(tinyCreatorUsdPrice), block.timestamp, int256(ethUsdPriceForRawThree), block.timestamp);

        (uint256 floorPriceQ96, uint256 tickSpacingQ96,,) = strategy.previewLaunchPricing();

        assertEq(tickSpacingQ96, 2, "tick spacing should clamp to minimum 2");
        assertEq(floorPriceQ96, 2, "aligned floor should stay non-zero after min spacing clamp");
    }

    function testFuzzPreviewLaunchPricingAcceptsFreshOracleAges(uint64 creatorAge, uint64 ethAge) external {
        uint64 maxAge = strategy.launchOracleMaxAge();
        creatorAge = uint64(bound(creatorAge, 0, maxAge));
        ethAge = uint64(bound(ethAge, 0, maxAge));

        vm.warp(1_000_000);
        oracle.setPrices(int256(2e18), block.timestamp - creatorAge, int256(2000e18), block.timestamp - ethAge);

        (uint256 floorPriceQ96, uint256 tickSpacingQ96, uint256 creatorUsdPrice, uint256 ethUsdPrice) =
            strategy.previewLaunchPricing();

        uint256 rawFloorPriceQ96 =
            _deriveExpectedFloorPriceQ96(uint256(2e18), uint256(2000e18), strategy.launchDiscountBps());
        uint256 expectedTickSpacingQ96 =
            _deriveExpectedTickSpacingQ96(rawFloorPriceQ96, strategy.launchTickSpacingBps());
        uint256 expectedFloorPriceQ96 = (rawFloorPriceQ96 / expectedTickSpacingQ96) * expectedTickSpacingQ96;

        assertEq(floorPriceQ96, expectedFloorPriceQ96, "fresh quotes should derive floor");
        assertEq(tickSpacingQ96, expectedTickSpacingQ96, "fresh quotes should derive tick spacing");
        assertEq(creatorUsdPrice, uint256(2e18), "creator price mismatch");
        assertEq(ethUsdPrice, uint256(2000e18), "eth price mismatch");
    }

    function testFuzzPreviewLaunchPricingRejectsStaleOracleAge(uint64 ageOverMax, bool staleCreatorPrice) external {
        uint64 maxAge = strategy.launchOracleMaxAge();
        ageOverMax = uint64(bound(ageOverMax, 1, 30 days));

        vm.warp(10_000_000);
        uint256 creatorTimestamp = block.timestamp - maxAge;
        uint256 ethTimestamp = block.timestamp - maxAge;
        if (staleCreatorPrice) {
            creatorTimestamp = block.timestamp - maxAge - ageOverMax;
        } else {
            ethTimestamp = block.timestamp - maxAge - ageOverMax;
        }

        oracle.setPrices(int256(2e18), creatorTimestamp, int256(2000e18), ethTimestamp);

        vm.expectRevert(
            abi.encodeWithSelector(
                CCALaunchStrategy.LaunchOracleStale.selector, creatorTimestamp, ethTimestamp, maxAge, block.timestamp
            )
        );
        strategy.previewLaunchPricing();
    }

    function testFuzzPreviewLaunchPricingRespectsDiscountAndTickSpacingConfig(
        uint16 discountBps,
        uint16 tickSpacingBps,
        uint128 creatorUsdPriceRaw,
        uint128 ethUsdPriceRaw
    ) external {
        discountBps = uint16(bound(discountBps, 1, 10_000));
        tickSpacingBps = uint16(bound(tickSpacingBps, 1, 10_000));
        uint256 creatorUsdPrice = bound(uint256(creatorUsdPriceRaw), 1e16, 1e24);
        uint256 ethUsdPrice = bound(uint256(ethUsdPriceRaw), 1e16, 1e24);

        strategy.setLaunchDiscountBps(discountBps);
        strategy.setLaunchTickSpacingBps(tickSpacingBps);
        oracle.setPrices(int256(creatorUsdPrice), block.timestamp, int256(ethUsdPrice), block.timestamp);

        (uint256 floorPriceQ96, uint256 tickSpacingQ96, uint256 creatorUsdOut, uint256 ethUsdOut) =
            strategy.previewLaunchPricing();

        uint256 rawFloorPriceQ96 = _deriveExpectedFloorPriceQ96(creatorUsdPrice, ethUsdPrice, discountBps);
        uint256 expectedTickSpacingQ96 = _deriveExpectedTickSpacingQ96(rawFloorPriceQ96, tickSpacingBps);
        uint256 expectedFloorPriceQ96 = (rawFloorPriceQ96 / expectedTickSpacingQ96) * expectedTickSpacingQ96;

        assertEq(floorPriceQ96, expectedFloorPriceQ96, "fuzzed config should derive floor");
        assertEq(tickSpacingQ96, expectedTickSpacingQ96, "fuzzed config should derive tick spacing");
        assertEq(creatorUsdOut, creatorUsdPrice, "creator usd out mismatch");
        assertEq(ethUsdOut, ethUsdPrice, "eth usd out mismatch");
    }

    function testFuzzPreviewLaunchPricingRevertsForNonPositiveOracleValues(int256 creatorUsdPrice, int256 ethUsdPrice)
        external
    {
        vm.assume(creatorUsdPrice <= 0 || ethUsdPrice <= 0);
        oracle.setPrices(creatorUsdPrice, block.timestamp, ethUsdPrice, block.timestamp);

        vm.expectRevert(
            abi.encodeWithSelector(CCALaunchStrategy.LaunchOracleInvalidPrice.selector, creatorUsdPrice, ethUsdPrice)
        );
        strategy.previewLaunchPricing();
    }

    function _parseStep(bytes memory packedSteps, uint256 stepIndex)
        internal
        pure
        returns (uint24 mps, uint40 blockDelta)
    {
        uint256 offset = stepIndex * 8;
        uint64 packed;
        for (uint256 i = 0; i < 8; i++) {
            packed = (packed << 8) | uint64(uint8(packedSteps[offset + i]));
        }
        mps = uint24(packed >> 40);
        blockDelta = uint40(packed);
    }

    function _createLinearSteps(uint64 duration) internal pure returns (bytes memory) {
        uint24 mpsPerBlock = uint24(uint256(MPS) / uint256(duration));
        bytes8 packed = bytes8((uint64(mpsPerBlock) << 40) | uint64(duration));
        return abi.encodePacked(packed);
    }

    function _createUniswapSafeDefaultSteps(uint64 duration) internal pure returns (bytes memory) {
        if (duration <= 2) return _createLinearSteps(duration);

        uint64 lastBlock = 1;
        uint64 phase1Blocks = duration / 2;
        uint64 phase2Blocks = duration - phase1Blocks - lastBlock;
        if (phase1Blocks == 0 || phase2Blocks == 0) return _createLinearSteps(duration);

        uint24 phase1Total = 2_000_000;
        uint24 phase2Total = 4_500_000;

        uint24 mps1 = uint24(uint256(phase1Total) / uint256(phase1Blocks));
        uint24 mps2 = uint24(uint256(phase2Total) / uint256(phase2Blocks));

        uint256 issued1 = uint256(mps1) * uint256(phase1Blocks);
        uint256 issued2 = uint256(mps2) * uint256(phase2Blocks);
        uint24 mps3 = uint24(uint256(MPS) - (issued1 + issued2));

        bytes8 packed1 = bytes8((uint64(mps1) << 40) | uint64(phase1Blocks));
        bytes8 packed2 = bytes8((uint64(mps2) << 40) | uint64(phase2Blocks));
        bytes8 packed3 = bytes8((uint64(mps3) << 40) | uint64(lastBlock));
        return abi.encodePacked(packed1, packed2, packed3);
    }

    function _deriveExpectedFloorPriceQ96(uint256 creatorUsdPrice, uint256 ethUsdPrice, uint256 discountBps)
        internal
        pure
        returns (uint256)
    {
        uint256 discounted = (creatorUsdPrice * discountBps) / 10_000;
        return (discounted * (2 ** 96)) / ethUsdPrice;
    }

    function _deriveExpectedTickSpacingQ96(uint256 floorPriceQ96, uint256 tickSpacingBps)
        internal
        pure
        returns (uint256)
    {
        uint256 spacing = (floorPriceQ96 * tickSpacingBps) / 10_000;
        return spacing > 1 ? spacing : 2;
    }

    function _deriveExpectedStartDeltaBlocks(uint256 launchTimestamp, uint256 startTimestamp)
        internal
        view
        returns (uint256 deltaBlocks)
    {
        if (startTimestamp > launchTimestamp) {
            deltaBlocks = (startTimestamp - launchTimestamp + strategy.launchBlockTimeSeconds() - 1)
                / strategy.launchBlockTimeSeconds();
        }
        if (deltaBlocks == 0) return 1;
        return deltaBlocks;
    }

    function _nextThursdayStartTimestamp(uint256 currentTimestamp) internal pure returns (uint256) {
        uint256 remainder = currentTimestamp % 7 days;
        if (remainder == 0) return currentTimestamp;
        return currentTimestamp + (7 days - remainder);
    }
}
