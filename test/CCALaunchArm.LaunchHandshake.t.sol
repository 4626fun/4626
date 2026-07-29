// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {CCALaunchArm} from "@4626/shared/shareoft-mesh/cca/CCALaunchArm.sol";

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

    function getAssetPrice() external view returns (int256 price, uint256 timestamp) {
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

contract MockCcaFactoryV2 {
    address public lastToken;
    uint256 public lastAmount;
    bytes public lastConfigData;
    bytes32 public lastSalt;
    MockAuction public lastAuction;
    bool public nextGraduated = true;

    function setNextGraduated(bool value) external {
        nextGraduated = value;
    }

    function create(address token, uint256 amount, bytes calldata configData, bytes32 salt)
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

contract CCALaunchArmLaunchHandshakeTest is Test {
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
    CCALaunchArm internal launchArm;
    MockCcaFactory internal factory;
    MockLaunchOracle internal oracle;

    function setUp() external {
        token = new MockLaunchToken();
        launchArm = new CCALaunchArm(address(token), address(0), address(this), address(this), address(this));
        factory = new MockCcaFactory();
        oracle = new MockLaunchOracle();

        launchArm.setCcaFactory(address(factory));
        oracle.setPrices(int256(2e18), block.timestamp, int256(2000e18), block.timestamp);
        launchArm.setOracleConfig(address(oracle), address(0x1111), address(0x2222), address(this));

        token.mint(address(this), 1_000_000e18);
        token.approve(address(launchArm), type(uint256).max);
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

        address auction = launchArm.launchAuction(amount, floorPrice, requiredRaise, callerProvidedSteps);

        assertEq(auction, address(factory.lastAuction()), "auction address mismatch");
        assertEq(token.balanceOf(address(launchArm)), 0, "strategy should not retain auction tokens");
        assertEq(token.balanceOf(auction), amount, "auction must be funded with full auction amount");

        MockAuction launchedAuction = MockAuction(auction);
        assertTrue(launchedAuction.tokensReceived(), "onTokensReceived should be called");
        assertEq(launchedAuction.onTokensReceivedCalls(), 1, "onTokensReceived should be called exactly once");

        EncodedAuctionParams memory params = abi.decode(factory.lastConfigData(), (EncodedAuctionParams));
        bytes memory expectedSafeSteps = _createUniswapSafeDefaultSteps(launchArm.defaultDuration());
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
            params.endBlock, params.startBlock + launchArm.defaultDuration(), "end block should preserve 7-day duration"
        );

        CCALaunchArm.LifecycleStatus memory lifecycle = launchArm.getLifecycleStatus();
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
        lifecycle = launchArm.getLifecycleStatus();
        assertEq(lifecycle.phase, PHASE_AUCTION_LIVE, "auction should become live at the scheduled start block");
        assertTrue(lifecycle.auctionWindowOpen, "auction window should open at the scheduled start block");
    }

    function testFinalizeFailedAuctionClearsCurrentAuction() external {
        factory.setNextGraduated(false);

        uint256 amount = 50_000e18;
        launchArm.launchAuction(amount, 1e15, 1 ether, hex"");

        address launchedAuction = launchArm.currentAuction();
        assertTrue(launchedAuction != address(0), "expected active auction");

        CCALaunchArm.LifecycleStatus memory lifecycle = launchArm.getLifecycleStatus();
        vm.roll(lifecycle.endBlock + 1);
        launchArm.finalizeFailedAuction();

        assertEq(launchArm.currentAuction(), address(0), "failed auction should be cleared");
        address[] memory history = launchArm.getPastAuctions();
        assertEq(history.length, 1, "failed auction should be archived");
        assertEq(history[0], launchedAuction, "archived auction mismatch");
    }

    function testLaunchAuctionUsesV2FactoryCreateEntrypoint() external {
        MockCcaFactoryV2 factoryV2 = new MockCcaFactoryV2();
        factoryV2.setNextGraduated(false);
        launchArm.setCcaFactoryV2(address(factoryV2));

        assertTrue(launchArm.ccaFactoryV2(), "v2 flag should be set");
        assertEq(launchArm.ccaFactory(), address(factoryV2), "factory address mismatch");

        vm.roll(1_000_000);
        vm.warp(4 days + 13 hours);
        oracle.setPrices(int256(2e18), block.timestamp, int256(2000e18), block.timestamp);

        uint256 amount = 100_000e18;
        address auction = launchArm.launchAuction(amount, 1e15, 1e18, hex"1234");

        assertEq(auction, address(factoryV2.lastAuction()), "v2 auction address mismatch");
        assertEq(factoryV2.lastToken(), address(token), "v2 create token mismatch");
        assertEq(factoryV2.lastAmount(), amount, "v2 create amount mismatch");
        assertEq(token.balanceOf(auction), amount, "v2 auction must be funded with full auction amount");
        assertTrue(MockAuction(auction).tokensReceived(), "v2 auction should receive onTokensReceived");

        EncodedAuctionParams memory params = abi.decode(factoryV2.lastConfigData(), (EncodedAuctionParams));
        bytes memory expectedSafeSteps = _createUniswapSafeDefaultSteps(launchArm.defaultDuration());
        assertEq(
            keccak256(params.auctionStepsData), keccak256(expectedSafeSteps), "v2 config must reuse safe schedule"
        );
        assertEq(params.currency, address(0), "v2 config currency mismatch");
    }

    function testSetCcaFactoryResetsToV1Semantics() external {
        MockCcaFactoryV2 factoryV2 = new MockCcaFactoryV2();
        launchArm.setCcaFactoryV2(address(factoryV2));
        assertTrue(launchArm.ccaFactoryV2(), "v2 flag should be set");

        launchArm.setCcaFactory(address(factory));
        assertFalse(launchArm.ccaFactoryV2(), "setCcaFactory must reset to v1 semantics");
        assertEq(launchArm.ccaFactory(), address(factory), "factory address mismatch after reset");

        vm.roll(1_000_000);
        vm.warp(4 days + 13 hours);
        oracle.setPrices(int256(2e18), block.timestamp, int256(2000e18), block.timestamp);
        factory.setNextGraduated(false);

        address auction = launchArm.launchAuction(100_000e18, 1e15, 1e18, hex"");
        assertEq(auction, address(factory.lastAuction()), "launch should route through v1 initializeDistribution");
    }

    function testOrbitLaunchSchedulesInArbSysBlockDomain() external {
        address arbSys = address(100);
        vm.etch(arbSys, hex"6080604052");
        uint256 arbBlock = 500_000_000;
        vm.mockCall(arbSys, abi.encodeWithSelector(bytes4(0xa3b1b31d)), abi.encode(arbBlock));

        CCALaunchArm orbitArm = new CCALaunchArm(address(token), address(0), address(this), address(this), address(this));
        orbitArm.setCcaFactory(address(factory));
        orbitArm.setOracleConfig(address(oracle), address(0x1111), address(0x2222), address(this));
        orbitArm.setLaunchBlocksPerSecond(10);

        vm.warp(4 days + 13 hours);
        uint256 launchTimestamp = block.timestamp;
        oracle.setPrices(int256(2e18), block.timestamp, int256(2000e18), block.timestamp);
        factory.setNextGraduated(false);

        uint256 amount = 100_000e18;
        token.approve(address(orbitArm), type(uint256).max);
        address auction = orbitArm.launchAuction(amount, 1e15, 1e18, hex"");

        EncodedAuctionParams memory params = abi.decode(factory.lastConfigData(), (EncodedAuctionParams));
        uint256 expectedDelta = (_nextThursdayStartTimestamp(launchTimestamp) - launchTimestamp) * 10;
        assertEq(params.startBlock, uint64(arbBlock + expectedDelta), "start must be scheduled in arbBlockNumber domain");
        assertEq(params.endBlock, params.startBlock + orbitArm.defaultDuration(), "end block mismatch");

        CCALaunchArm.LifecycleStatus memory lifecycle = orbitArm.getLifecycleStatus();
        assertEq(lifecycle.phase, PHASE_AUCTION_SCHEDULED, "orbit launch should start scheduled");

        vm.mockCall(arbSys, abi.encodeWithSelector(bytes4(0xa3b1b31d)), abi.encode(uint256(params.startBlock)));
        lifecycle = orbitArm.getLifecycleStatus();
        assertEq(lifecycle.phase, PHASE_AUCTION_LIVE, "phase must follow arbBlockNumber, not block.number");
        assertTrue(MockAuction(auction).tokensReceived(), "orbit auction should receive tokens");
    }

    function testSetLaunchBlocksPerSecondRejectsZero() external {
        vm.expectRevert(CCALaunchArm.InvalidConfig.selector);
        launchArm.setLaunchBlocksPerSecond(0);
    }

    function testFastChainArbitrumScheduleUsesQuarterRamp() external {
        launchArm.setDefaultDuration(2_419_200); // 7 days at ~250ms blocks
        factory.setNextGraduated(false);
        oracle.setPrices(int256(2e18), block.timestamp, int256(2000e18), block.timestamp);

        launchArm.launchAuction(100_000e18, 1e15, 1e18, hex"");

        EncodedAuctionParams memory params = abi.decode(factory.lastConfigData(), (EncodedAuctionParams));
        assertEq(params.auctionStepsData.length, 40, "quarter-ramp schedule should contain exactly 5 steps");

        (uint24 mps0, uint40 delta0) = _parseStep(params.auctionStepsData, 0);
        (uint24 mps1, uint40 delta1) = _parseStep(params.auctionStepsData, 1);
        (uint24 mps2, uint40 delta2) = _parseStep(params.auctionStepsData, 2);
        (uint24 mps3, uint40 delta3) = _parseStep(params.auctionStepsData, 3);
        (uint24 mps4, uint40 delta4) = _parseStep(params.auctionStepsData, 4);

        assertEq(delta0, 604_800);
        assertEq(delta1, 604_800);
        assertEq(delta2, 604_800);
        assertEq(delta3, 604_799);
        assertEq(delta4, 1, "final step must be the single final block");
        assertEq(uint256(delta0) + delta1 + delta2 + delta3 + delta4, 2_419_200, "steps must span the duration");

        assertTrue(mps0 < mps1 && mps1 < mps2 && mps2 < mps3, "body rates should ramp monotonically");
        uint256 issued = uint256(mps0) * delta0 + uint256(mps1) * delta1 + uint256(mps2) * delta2
            + uint256(mps3) * delta3 + uint256(mps4) * delta4;
        assertEq(issued, 10_000_000, "steps must issue exactly 100% of supply");
        assertGt(mps4, 3_000_000, "final block should carry the standard remainder tranche");
        assertLt(mps4, 5_000_000, "final block tranche should stay near the classic ~35-40%");
    }

    function testFastChainRobinhoodScheduleUsesUniformBody() external {
        launchArm.setDefaultDuration(6_048_000); // 7 days at ~100ms blocks
        factory.setNextGraduated(false);
        oracle.setPrices(int256(2e18), block.timestamp, int256(2000e18), block.timestamp);

        launchArm.launchAuction(100_000e18, 1e15, 1e18, hex"");

        EncodedAuctionParams memory params = abi.decode(factory.lastConfigData(), (EncodedAuctionParams));
        assertEq(params.auctionStepsData.length, 16, "uniform fast-chain schedule should contain exactly 2 steps");

        (uint24 mps0, uint40 delta0) = _parseStep(params.auctionStepsData, 0);
        (uint24 mps1, uint40 delta1) = _parseStep(params.auctionStepsData, 1);

        assertEq(mps0, 1, "body should be perfectly uniform at mps 1");
        assertEq(delta0, 6_047_999);
        assertEq(delta1, 1);
        assertEq(uint256(mps0) * delta0 + uint256(mps1) * delta1, 10_000_000, "steps must issue exactly 100%");
        assertEq(mps1, 3_952_001, "final block should carry the ~39.5% remainder tranche");
    }

    function testLaunchRevertsWhenDurationExceedsExpressibleIssuance() external {
        launchArm.setDefaultDuration(10_000_000); // >= MPS: full issuance not expressible at mps >= 1
        oracle.setPrices(int256(2e18), block.timestamp, int256(2000e18), block.timestamp);

        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("DurationExceedsExpressibleIssuance(uint64)")), uint64(10_000_000)
            )
        );
        launchArm.launchAuction(100_000e18, 1e15, 1e18, hex"");
    }

    function testLaunchAuctionRevertsWhenOraclePriceUnavailable() external {
        oracle.setPrices(0, block.timestamp, int256(2000e18), block.timestamp);

        vm.expectRevert(
            abi.encodeWithSelector(CCALaunchArm.LaunchOracleInvalidPrice.selector, int256(0), int256(2000e18))
        );
        launchArm.launchAuction(10_000e18, 1e15, 1 ether, hex"");
    }

    function testLaunchAuctionRevertsWhenOraclePriceStale() external {
        vm.warp(20_000);
        uint256 staleTs = block.timestamp - 10_000;
        oracle.setPrices(int256(2e18), staleTs, int256(2000e18), staleTs);

        vm.expectRevert(
            abi.encodeWithSelector(
                CCALaunchArm.LaunchOracleStale.selector, staleTs, staleTs, uint64(7200), block.timestamp
            )
        );
        launchArm.launchAuction(10_000e18, 1e15, 1 ether, hex"");
    }

    function testPreviewLaunchPricingSucceedsAtMaxAgeBoundary() external {
        uint64 maxAge = launchArm.launchOracleMaxAge();
        vm.warp(50_000);
        uint256 boundaryTs = block.timestamp - maxAge;
        oracle.setPrices(int256(2e18), boundaryTs, int256(2000e18), boundaryTs);

        (uint256 floorPriceQ96, uint256 tickSpacingQ96, uint256 creatorUsdPrice, uint256 ethUsdPrice) =
            launchArm.previewLaunchPricing();

        uint256 rawFloorPriceQ96 =
            _deriveExpectedFloorPriceQ96(uint256(2e18), uint256(2000e18), launchArm.launchDiscountBps());
        uint256 expectedTickSpacingQ96 =
            _deriveExpectedTickSpacingQ96(rawFloorPriceQ96, launchArm.launchTickSpacingBps());
        uint256 expectedFloorPriceQ96 = (rawFloorPriceQ96 / expectedTickSpacingQ96) * expectedTickSpacingQ96;

        assertEq(floorPriceQ96, expectedFloorPriceQ96, "floor should be derived at max-age boundary");
        assertEq(tickSpacingQ96, expectedTickSpacingQ96, "tick spacing should be derived at max-age boundary");
        assertEq(creatorUsdPrice, uint256(2e18), "creator price mismatch");
        assertEq(ethUsdPrice, uint256(2000e18), "eth price mismatch");
    }

    function testPreviewLaunchPricingRevertsWhenOracleNotConfigured() external {
        CCALaunchArm noOracleStrategy =
            new CCALaunchArm(address(token), address(0), address(this), address(this), address(this));
        vm.expectRevert(CCALaunchArm.LaunchOracleNotConfigured.selector);
        noOracleStrategy.previewLaunchPricing();
    }

    function testPreviewLaunchPricingRevertsForUnsupportedCurrency() external {
        CCALaunchArm erc20CurrencyStrategy =
            new CCALaunchArm(address(token), address(0xBEEF), address(this), address(this), address(this));
        erc20CurrencyStrategy.setOracleConfig(address(oracle), address(0x1111), address(0x2222), address(this));

        vm.expectRevert(abi.encodeWithSelector(CCALaunchArm.UnsupportedLaunchCurrency.selector, address(0xBEEF)));
        erc20CurrencyStrategy.previewLaunchPricing();
    }

    function testPreviewLaunchPricingRevertsWhenDerivedFloorRoundsToZero() external {
        oracle.setPrices(int256(1), block.timestamp, int256(2000e18), block.timestamp);

        vm.expectRevert(abi.encodeWithSelector(CCALaunchArm.LaunchFloorTooLow.selector, uint256(0), uint256(2)));
        launchArm.previewLaunchPricing();
    }

    function testPreviewLaunchPricingRespectsUpdatedDiscountAndTickSpacing() external {
        launchArm.setLaunchDiscountBps(10_000);
        launchArm.setLaunchTickSpacingBps(250);

        (uint256 floorPriceQ96, uint256 tickSpacingQ96, uint256 creatorUsdPrice, uint256 ethUsdPrice) =
            launchArm.previewLaunchPricing();

        uint256 rawFloorPriceQ96 = _deriveExpectedFloorPriceQ96(uint256(2e18), uint256(2000e18), 10_000);
        uint256 expectedTickSpacingQ96 = _deriveExpectedTickSpacingQ96(rawFloorPriceQ96, 250);
        uint256 expectedFloorPriceQ96 = (rawFloorPriceQ96 / expectedTickSpacingQ96) * expectedTickSpacingQ96;

        assertEq(floorPriceQ96, expectedFloorPriceQ96, "floor should respect updated discount");
        assertEq(tickSpacingQ96, expectedTickSpacingQ96, "tick spacing should respect updated bps");
        assertEq(creatorUsdPrice, uint256(2e18), "creator price mismatch");
        assertEq(ethUsdPrice, uint256(2000e18), "eth price mismatch");
    }

    function testPreviewLaunchPricingClampsTickSpacingToMinimum() external {
        launchArm.setLaunchDiscountBps(10_000);
        launchArm.setLaunchTickSpacingBps(1);

        uint256 tinyCreatorUsdPrice = 1;
        uint256 ethUsdPriceForRawThree = launchArm.Q96() / 3;
        oracle.setPrices(int256(tinyCreatorUsdPrice), block.timestamp, int256(ethUsdPriceForRawThree), block.timestamp);

        (uint256 floorPriceQ96, uint256 tickSpacingQ96,,) = launchArm.previewLaunchPricing();

        assertEq(tickSpacingQ96, 2, "tick spacing should clamp to minimum 2");
        assertEq(floorPriceQ96, 2, "aligned floor should stay non-zero after min spacing clamp");
    }

    function testFuzzPreviewLaunchPricingAcceptsFreshOracleAges(uint64 creatorAge, uint64 ethAge) external {
        uint64 maxAge = launchArm.launchOracleMaxAge();
        creatorAge = uint64(bound(creatorAge, 0, maxAge));
        ethAge = uint64(bound(ethAge, 0, maxAge));

        vm.warp(1_000_000);
        oracle.setPrices(int256(2e18), block.timestamp - creatorAge, int256(2000e18), block.timestamp - ethAge);

        (uint256 floorPriceQ96, uint256 tickSpacingQ96, uint256 creatorUsdPrice, uint256 ethUsdPrice) =
            launchArm.previewLaunchPricing();

        uint256 rawFloorPriceQ96 =
            _deriveExpectedFloorPriceQ96(uint256(2e18), uint256(2000e18), launchArm.launchDiscountBps());
        uint256 expectedTickSpacingQ96 =
            _deriveExpectedTickSpacingQ96(rawFloorPriceQ96, launchArm.launchTickSpacingBps());
        uint256 expectedFloorPriceQ96 = (rawFloorPriceQ96 / expectedTickSpacingQ96) * expectedTickSpacingQ96;

        assertEq(floorPriceQ96, expectedFloorPriceQ96, "fresh quotes should derive floor");
        assertEq(tickSpacingQ96, expectedTickSpacingQ96, "fresh quotes should derive tick spacing");
        assertEq(creatorUsdPrice, uint256(2e18), "creator price mismatch");
        assertEq(ethUsdPrice, uint256(2000e18), "eth price mismatch");
    }

    function testFuzzPreviewLaunchPricingRejectsStaleOracleAge(uint64 ageOverMax, bool staleCreatorPrice) external {
        uint64 maxAge = launchArm.launchOracleMaxAge();
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
                CCALaunchArm.LaunchOracleStale.selector, creatorTimestamp, ethTimestamp, maxAge, block.timestamp
            )
        );
        launchArm.previewLaunchPricing();
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

        launchArm.setLaunchDiscountBps(discountBps);
        launchArm.setLaunchTickSpacingBps(tickSpacingBps);
        oracle.setPrices(int256(creatorUsdPrice), block.timestamp, int256(ethUsdPrice), block.timestamp);

        (uint256 floorPriceQ96, uint256 tickSpacingQ96, uint256 creatorUsdOut, uint256 ethUsdOut) =
            launchArm.previewLaunchPricing();

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
            abi.encodeWithSelector(CCALaunchArm.LaunchOracleInvalidPrice.selector, creatorUsdPrice, ethUsdPrice)
        );
        launchArm.previewLaunchPricing();
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
            deltaBlocks = (startTimestamp - launchTimestamp + launchArm.launchBlockTimeSeconds() - 1)
                / launchArm.launchBlockTimeSeconds();
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
