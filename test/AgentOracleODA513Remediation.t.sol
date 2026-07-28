// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {AgentOracle} from "@4626/agent/oracles/AgentOracle.sol";
import {Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";

contract MockRegistryForAgentOracleODA513 {
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

contract MockERC20DecimalsForAgentOracleODA513 {
    uint8 internal immutable decimalsValue;

    constructor(uint8 _decimals) {
        decimalsValue = _decimals;
    }

    function decimals() external view returns (uint8) {
        return decimalsValue;
    }
}

contract MockChainlinkBoundsForAgentOracleODA513 {
    int192 internal immutable minAnswerValue;
    int192 internal immutable maxAnswerValue;

    constructor(int192 _minAnswer, int192 _maxAnswer) {
        minAnswerValue = _minAnswer;
        maxAnswerValue = _maxAnswer;
    }

    function minAnswer() external view returns (int192) {
        return minAnswerValue;
    }

    function maxAnswer() external view returns (int192) {
        return maxAnswerValue;
    }
}

contract MockChainlinkFeedForAgentOracleODA513 {
    int256 public answer;
    uint256 public updatedAt;
    uint256 public startedAt;
    uint80 public roundId = 1;
    uint80 public answeredInRound = 1;
    uint8 public immutable decimals;
    address public aggregator;

    constructor(uint8 _decimals) {
        decimals = _decimals;
    }

    function setLatestRoundData(int256 _answer, uint256 _updatedAt, uint256 _startedAt) external {
        answer = _answer;
        updatedAt = _updatedAt;
        startedAt = _startedAt;
    }

    function setAggregator(address _aggregator) external {
        aggregator = _aggregator;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (roundId, answer, startedAt, updatedAt, answeredInRound);
    }
}

contract MockSequencerFeedForAgentOracleODA513 {
    int256 public answer;
    uint256 public updatedAt;
    uint256 public startedAt;
    bool public shouldRevert;

    constructor() {
        updatedAt = block.timestamp;
        startedAt = block.timestamp > 2 hours ? block.timestamp - 2 hours : 1;
    }

    function setAnswer(int256 _answer) external {
        answer = _answer;
        updatedAt = block.timestamp;
        startedAt = block.timestamp;
    }

    function setHealthyUp() external {
        answer = 0;
        updatedAt = block.timestamp;
        startedAt = block.timestamp > 2 hours ? block.timestamp - 2 hours : 1;
    }

    function setShouldRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        if (shouldRevert) revert("sequencer read failed");
        return (1, answer, startedAt, updatedAt, 1);
    }
}

contract MockUniswapV2PairForAgentOracleODA513 {
    address public immutable token0;
    address public immutable token1;

    uint112 internal reserve0;
    uint112 internal reserve1;
    uint32 internal tsLast;
    uint256 internal price0Cumulative;
    uint256 internal price1Cumulative;

    constructor(address _token0, address _token1) {
        token0 = _token0;
        token1 = _token1;
    }

    function setState(
        uint112 _reserve0,
        uint112 _reserve1,
        uint32 _tsLast,
        uint256 _price0Cumulative,
        uint256 _price1Cumulative
    ) external {
        reserve0 = _reserve0;
        reserve1 = _reserve1;
        tsLast = _tsLast;
        price0Cumulative = _price0Cumulative;
        price1Cumulative = _price1Cumulative;
    }

    function getReserves() external view returns (uint112, uint112, uint32) {
        return (reserve0, reserve1, tsLast);
    }

    function price0CumulativeLast() external view returns (uint256) {
        return price0Cumulative;
    }

    function price1CumulativeLast() external view returns (uint256) {
        return price1Cumulative;
    }
}

contract MockUniswapV3PoolForAgentOracleODA513 {
    address public immutable token0;
    address public immutable token1;
    uint128 internal liquidityValue = 1e18;
    int24 internal twapTick;

    constructor(address _token0, address _token1) {
        token0 = _token0;
        token1 = _token1;
    }

    function setTwapTick(int24 _tick) external {
        twapTick = _tick;
    }

    function liquidity() external view returns (uint128) {
        return liquidityValue;
    }

    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s)
    {
        tickCumulatives = new int56[](secondsAgos.length);
        secondsPerLiquidityCumulativeX128s = new uint160[](secondsAgos.length);
        tickCumulatives[0] = 0;
        tickCumulatives[1] = int56(twapTick) * int56(uint56(secondsAgos[0]));
    }
}

contract AgentOracleODA513RemediationTest is Test {
    uint32 internal constant HUB_EID = 30184;
    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    bytes32 internal constant HUB_PEER = bytes32(uint256(uint160(address(0xBEEF))));

    function setUp() public {
        vm.warp(1_700_000_000);
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(address(this)));
    }

    function test_getAssetEthTWAP_usesV2LaneForNonWethQuote() external {
        vm.chainId(8453);
        AgentOracle oracle = _deployOracle();
        MockChainlinkFeedForAgentOracleODA513 ethFeed = new MockChainlinkFeedForAgentOracleODA513(8);
        MockChainlinkFeedForAgentOracleODA513 quoteFeed = new MockChainlinkFeedForAgentOracleODA513(8);
        oracle.setChainlinkFeed(address(ethFeed));
        oracle.setQuoteUsdFeed(address(quoteFeed));

        address agentToken = address(new MockERC20DecimalsForAgentOracleODA513(18));
        address quoteToken = address(new MockERC20DecimalsForAgentOracleODA513(18));
        MockUniswapV2PairForAgentOracleODA513 pair = new MockUniswapV2PairForAgentOracleODA513(quoteToken, agentToken);
        pair.setState(100e18, 200e18, uint32(block.timestamp), 0, 0);
        oracle.setV2Pair(address(pair), agentToken, quoteToken, 1800);

        vm.warp(block.timestamp + 1800);
        ethFeed.setLatestRoundData(4000e8, block.timestamp, block.timestamp - 1 days);
        quoteFeed.setLatestRoundData(2e8, block.timestamp, block.timestamp - 1 days);

        assertEq(oracle.getAssetEthTWAP(1800), 4000e18);
    }

    function test_getAssetEthTWAP_legacyUsdStableQuoteWithoutQuoteUsdFeed() external {
        vm.chainId(8453);
        AgentOracle oracle = _deployOracle();
        MockChainlinkFeedForAgentOracleODA513 ethFeed = new MockChainlinkFeedForAgentOracleODA513(8);
        oracle.setChainlinkFeed(address(ethFeed));
        // Intentionally no quoteUsdFeed and no referenceQuoteToken — legacy USDC-style 1:1.

        address agentToken = address(new MockERC20DecimalsForAgentOracleODA513(18));
        address quoteToken = address(new MockERC20DecimalsForAgentOracleODA513(18));
        MockUniswapV2PairForAgentOracleODA513 pair = new MockUniswapV2PairForAgentOracleODA513(quoteToken, agentToken);
        pair.setState(100e18, 200e18, uint32(block.timestamp), 0, 0);
        oracle.setV2Pair(address(pair), agentToken, quoteToken, 1800);

        vm.warp(block.timestamp + 1800);
        ethFeed.setLatestRoundData(4000e8, block.timestamp, block.timestamp - 1 days);

        // agentPerQuote=2, quotePerEth=ethUsd=4000 → assetPerEth=8000
        assertEq(oracle.getAssetEthTWAP(1800), 8000e18);
    }

    function test_lzReceive_clampsStaleRemoteUpdate_and_ignoresLongSymbol() external {
        vm.chainId(10);
        AgentOracle oracle = _deployOracle();
        oracle.setPeer(HUB_EID, HUB_PEER);

        Origin memory origin = Origin({srcEid: HUB_EID, sender: HUB_PEER, nonce: 1});
        vm.prank(LZ_ENDPOINT);
        oracle.lzReceive(origin, bytes32(0), abi.encode(int256(1e18), block.timestamp, string("AGENT")), address(0), "");

        vm.warp(block.timestamp + oracle.MAX_STALENESS() + 1);
        string memory longSymbol = "THIS-SYMBOL-IS-DELIBERATELY-LONGER-THAN-THIRTY-TWO-BYTES";
        vm.prank(LZ_ENDPOINT);
        oracle.lzReceive(origin, bytes32(0), abi.encode(int256(100e18), block.timestamp, longSymbol), address(0), "");

        assertEq(oracle.assetPriceUSD(), int256(1.2e18));
        assertEq(oracle.assetSymbol(), "AGENT");
    }

    function test_getAssetPrice_andFreshness_failClosed_whenSequencerUnhealthy() external {
        vm.chainId(8453);
        AgentOracle oracle = _deployOracle();
        MockSequencerFeedForAgentOracleODA513 sequencerFeed = new MockSequencerFeedForAgentOracleODA513();
        oracle.setSequencerUptimeFeed(address(sequencerFeed));
        oracle.initializeAssetPrice(int256(1e18));

        sequencerFeed.setAnswer(1);
        (int256 priceDown, uint256 tsDown) = oracle.getAssetPrice();
        assertEq(priceDown, 0);
        assertEq(tsDown, 0);
        assertFalse(oracle.isPriceFresh());

        sequencerFeed.setHealthyUp();
        vm.warp(block.timestamp + oracle.SEQUENCER_GRACE_PERIOD() + 1);
        sequencerFeed.setShouldRevert(true);
        (int256 priceRevert, uint256 tsRevert) = oracle.getAssetPrice();
        assertEq(priceRevert, 0);
        assertEq(tsRevert, 0);
        assertFalse(oracle.isPriceFresh());
    }

    function test_getAssetUsdTWAP_preservesSubWeiQuotePrecision() external {
        vm.chainId(8453);
        AgentOracle oracle = _deployOracle();
        address quoteToken = address(new MockERC20DecimalsForAgentOracleODA513(6));
        address agentToken = address(new MockERC20DecimalsForAgentOracleODA513(18));
        MockUniswapV3PoolForAgentOracleODA513 pool = new MockUniswapV3PoolForAgentOracleODA513(quoteToken, agentToken);
        pool.setTwapTick(-414486); // far enough negative to keep the 1e18-scaled quote tiny but nonzero
        oracle.setV3Pool(address(pool), agentToken, quoteToken, 1800);

        uint256 price = oracle.getAssetUsdTWAP(1800);
        assertGt(price, 0);
        assertLt(price, 2e12);
    }

    function test_setFeedMaxStaleness_allowsSlowerQuoteFeed() external {
        vm.chainId(8453);
        AgentOracle oracle = _deployOracle();
        MockChainlinkFeedForAgentOracleODA513 ethFeed = new MockChainlinkFeedForAgentOracleODA513(8);
        MockChainlinkFeedForAgentOracleODA513 quoteFeed = new MockChainlinkFeedForAgentOracleODA513(8);
        oracle.setChainlinkFeed(address(ethFeed));
        oracle.setQuoteUsdFeed(address(quoteFeed));

        address agentToken = address(new MockERC20DecimalsForAgentOracleODA513(18));
        address quoteToken = address(new MockERC20DecimalsForAgentOracleODA513(18));
        MockUniswapV2PairForAgentOracleODA513 pair = new MockUniswapV2PairForAgentOracleODA513(quoteToken, agentToken);
        pair.setState(100e18, 200e18, uint32(block.timestamp), 0, 0);
        oracle.setV2Pair(address(pair), agentToken, quoteToken, 1800);
        oracle.initializeAssetPrice(int256(5e18));

        vm.warp(block.timestamp + 1800);
        ethFeed.setLatestRoundData(10e8, block.timestamp, block.timestamp - 1 days);
        quoteFeed.setLatestRoundData(10e8, block.timestamp - 3 hours, block.timestamp - 1 days);

        vm.expectRevert(AgentOracle.StalePrice.selector);
        oracle.updateAssetPriceFromTWAP(1800);

        oracle.setFeedMaxStaleness(address(quoteFeed), 4 hours);
        oracle.updateAssetPriceFromTWAP(1800);
        assertEq(oracle.assetPriceUSD(), int256(5e18));
    }

    function test_publicGetters_enforceDurationFloor() external {
        vm.chainId(8453);
        AgentOracle oracle = _deployOracle();
        address agentToken = address(new MockERC20DecimalsForAgentOracleODA513(18));
        address quoteToken = address(new MockERC20DecimalsForAgentOracleODA513(18));

        MockUniswapV2PairForAgentOracleODA513 pair = new MockUniswapV2PairForAgentOracleODA513(quoteToken, agentToken);
        pair.setState(100e18, 200e18, uint32(block.timestamp), 0, 0);
        oracle.setV2Pair(address(pair), agentToken, quoteToken, 1800);
        vm.expectRevert(AgentOracle.InvalidDuration.selector);
        oracle.getV2AssetQuoteTWAP(1);
        vm.expectRevert(AgentOracle.InvalidDuration.selector);
        oracle.getAssetEthTWAP(1);

        MockUniswapV3PoolForAgentOracleODA513 pool = new MockUniswapV3PoolForAgentOracleODA513(quoteToken, agentToken);
        oracle.setV3Pool(address(pool), agentToken, quoteToken, 1800);
        vm.expectRevert(AgentOracle.InvalidDuration.selector);
        oracle.getV3TWAPTick(1);
        vm.expectRevert(AgentOracle.InvalidDuration.selector);
        oracle.getAssetUsdTWAP(1);
        vm.expectRevert(AgentOracle.InvalidDuration.selector);
        oracle.getAjnaBucketFromV3TWAP(1);
    }

    function test_lowLevelHardening_paths() external {
        vm.chainId(8453);
        AgentOracle oracle = _deployOracle();

        vm.expectRevert(AgentOracle.InvalidDuration.selector);
        oracle.setPriceUpdateCooldown(29);

        vm.expectRevert(AgentOracle.RenounceOwnershipDisabled.selector);
        oracle.renounceOwnership();

        vm.chainId(10);
        uint32[] memory dstEids = new uint32[](1);
        dstEids[0] = 40231;
        uint256[] memory fees = new uint256[](1);
        fees[0] = 1;
        vm.expectRevert(AgentOracle.HubOnly.selector);
        oracle.broadcastAssetPriceWithFees(dstEids, hex"", fees);
    }

    function test_getEthPrice_rejectsCircuitBreakerBoundAnswer() external {
        vm.chainId(8453);
        AgentOracle oracle = _deployOracle();
        MockChainlinkFeedForAgentOracleODA513 ethFeed = new MockChainlinkFeedForAgentOracleODA513(8);
        MockChainlinkBoundsForAgentOracleODA513 bounds = new MockChainlinkBoundsForAgentOracleODA513(1, 3000e8);
        ethFeed.setAggregator(address(bounds));
        ethFeed.setLatestRoundData(3000e8, block.timestamp, block.timestamp - 1 days);
        oracle.setChainlinkFeed(address(ethFeed));

        (int256 price, uint256 timestamp) = oracle.getEthPrice();
        assertEq(price, 0);
        assertEq(timestamp, 0);
    }

    function _deployOracle() internal returns (AgentOracle oracle) {
        MockRegistryForAgentOracleODA513 registry = new MockRegistryForAgentOracleODA513(LZ_ENDPOINT, HUB_EID);
        oracle = new AgentOracle(address(registry), address(0), "AGENT", address(this));
    }
}
