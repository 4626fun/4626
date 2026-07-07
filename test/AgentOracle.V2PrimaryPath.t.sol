// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {AgentOracle} from "@4626/agent/oracles/AgentOracle.sol";

contract MockRegistryForAgentOracleV2 {
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

contract MockChainlinkFeedForAgentOracleV2 {
    int256 public answer;
    uint256 public updatedAt;
    uint80 public roundId = 1;
    uint80 public answeredInRound = 1;
    uint8 public immutable decimals;

    constructor(uint8 _decimals) {
        decimals = _decimals;
    }

    function setLatestAnswer(int256 _answer, uint256 _updatedAt) external {
        answer = _answer;
        updatedAt = _updatedAt;
    }

    function latestRoundData()
        external
        view
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (roundId, answer, 0, updatedAt, answeredInRound);
    }
}

contract MockChainlinkFeedNoDecimalsForAgentOracleV2 {
    int256 public answer;
    uint256 public updatedAt;
    uint80 public roundId = 1;
    uint80 public answeredInRound = 1;

    function setLatestAnswer(int256 _answer, uint256 _updatedAt) external {
        answer = _answer;
        updatedAt = _updatedAt;
    }

    function latestRoundData()
        external
        view
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (roundId, answer, 0, updatedAt, answeredInRound);
    }
}

contract MockERC20Decimals {
    uint8 private immutable d;

    constructor(uint8 _d) {
        d = _d;
    }

    function decimals() external view returns (uint8) {
        return d;
    }
}

contract MockUniswapV2PairForAgentOracle {
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

contract AgentOracleV2PrimaryPathTest is Test {
    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    uint32 internal constant HUB_EID = 30184;

    function test_setV2Pair_rejectsMismatchedPairTokens() external {
        AgentOracle oracle = _deployOracle();

        address agentToken = address(new MockERC20Decimals(18));
        address quoteToken = address(new MockERC20Decimals(18));
        address wrongToken = address(new MockERC20Decimals(18));
        MockUniswapV2PairForAgentOracle pair = new MockUniswapV2PairForAgentOracle(agentToken, wrongToken);

        vm.expectRevert(AgentOracle.InvalidV2Pair.selector);
        oracle.setV2Pair(address(pair), agentToken, quoteToken, 1800);
    }

    function test_updateAgentPriceFromTWAP_prefersV2Path_whenConfigured() external {
        AgentOracle oracle = _deployOracle();

        MockChainlinkFeedForAgentOracleV2 ethFeed = new MockChainlinkFeedForAgentOracleV2(8);
        MockChainlinkFeedForAgentOracleV2 quoteFeed = new MockChainlinkFeedForAgentOracleV2(8);
        oracle.setChainlinkFeed(address(ethFeed));
        oracle.setQuoteUsdFeed(address(quoteFeed));

        address agentToken = address(new MockERC20Decimals(18));
        address quoteToken = address(new MockERC20Decimals(18));
        MockUniswapV2PairForAgentOracle pair = new MockUniswapV2PairForAgentOracle(quoteToken, agentToken);

        // Set reserves so Agent/Quote = 2.0 (reserveAgent/reserveQuote).
        // token0 = quote, token1 = agent, so price0 (agent/quote) = reserve1/reserve0 = 2.
        uint32 t0 = uint32(block.timestamp);
        pair.setState(100e18, 200e18, t0, 0, 0);

        oracle.setV2Pair(address(pair), agentToken, quoteToken, 1800);
        oracle.initializeAssetPrice(int256(5e18));

        vm.warp(block.timestamp + 1800);
        // Intentionally set ETH feed to a different value to ensure the V2 quote feed is used.
        ethFeed.setLatestAnswer(99e8, block.timestamp);
        quoteFeed.setLatestAnswer(10e8, block.timestamp); // quote/USD = 10

        oracle.updateAssetPriceFromTWAP(1800);
        (int256 price,) = oracle.getAssetPrice();

        // USD/Agent = (USD/Quote) / (Agent/Quote) = 10 / 2 = 5
        assertEq(price, int256(5e18));
    }

    function test_updateAgentPriceFromTWAP_revertsWithoutV2QuoteFeed_forNonWethQuote() external {
        AgentOracle oracle = _deployOracle();
        MockChainlinkFeedForAgentOracleV2 ethFeed = new MockChainlinkFeedForAgentOracleV2(8);
        oracle.setChainlinkFeed(address(ethFeed));

        address agentToken = address(new MockERC20Decimals(18));
        address virtualToken = address(new MockERC20Decimals(18));
        MockUniswapV2PairForAgentOracle pair = new MockUniswapV2PairForAgentOracle(virtualToken, agentToken);

        uint32 t0 = uint32(block.timestamp);
        pair.setState(100e18, 200e18, t0, 0, 0);
        oracle.setV2Pair(address(pair), agentToken, virtualToken, 1800);
        oracle.initializeAssetPrice(int256(5e18));

        vm.warp(block.timestamp + 1800);
        vm.expectRevert(abi.encodeWithSelector(AgentOracle.MissingQuoteUsdFeed.selector, virtualToken));
        oracle.updateAssetPriceFromTWAP(1800);
    }

    function test_updateAgentPriceFromTWAP_fallsBackToEthFeed_whenQuoteIsBaseWeth() external {
        AgentOracle oracle = _deployOracle();
        MockChainlinkFeedForAgentOracleV2 ethFeed = new MockChainlinkFeedForAgentOracleV2(8);
        oracle.setChainlinkFeed(address(ethFeed));

        address agentToken = address(new MockERC20Decimals(18));
        address weth = oracle.BASE_WETH();
        address wethDecimalsImpl = address(new MockERC20Decimals(18));
        vm.etch(weth, wethDecimalsImpl.code);
        MockUniswapV2PairForAgentOracle pair = new MockUniswapV2PairForAgentOracle(weth, agentToken);

        // Agent/quote = reserveAgent/reserveWeth = 2
        uint32 t0 = uint32(block.timestamp);
        pair.setState(100e18, 200e18, t0, 0, 0);
        oracle.setV2Pair(address(pair), agentToken, weth, 1800);
        oracle.initializeAssetPrice(int256(5e18));

        vm.warp(block.timestamp + 1800);
        ethFeed.setLatestAnswer(10e8, block.timestamp);
        oracle.updateAssetPriceFromTWAP(1800);
        (int256 price,) = oracle.getAssetPrice();
        assertEq(price, int256(5e18));
    }

    function test_updateAgentPriceFromTWAP_handlesNon8DecimalQuoteFeeds() external {
        AgentOracle oracle = _deployOracle();

        MockChainlinkFeedForAgentOracleV2 ethFeed = new MockChainlinkFeedForAgentOracleV2(8);
        MockChainlinkFeedForAgentOracleV2 quoteFeed18 = new MockChainlinkFeedForAgentOracleV2(18);
        oracle.setChainlinkFeed(address(ethFeed));
        oracle.setQuoteUsdFeed(address(quoteFeed18));

        address agentToken = address(new MockERC20Decimals(18));
        address quoteToken = address(new MockERC20Decimals(18));
        MockUniswapV2PairForAgentOracle pair = new MockUniswapV2PairForAgentOracle(quoteToken, agentToken);

        // Agent/Quote = 2
        uint32 t0 = uint32(block.timestamp);
        pair.setState(100e18, 200e18, t0, 0, 0);
        oracle.setV2Pair(address(pair), agentToken, quoteToken, 1800);
        oracle.initializeAssetPrice(int256(5e18));

        vm.warp(block.timestamp + 1800);
        quoteFeed18.setLatestAnswer(10e18, block.timestamp); // quote/USD with 18-dec feed

        oracle.updateAssetPriceFromTWAP(1800);
        (int256 price,) = oracle.getAssetPrice();
        assertEq(price, int256(5e18));
    }

    function test_updateAgentPriceFromTWAP_normalizesMixedDecimalV2Pairs() external {
        AgentOracle oracle = _deployOracle();

        MockChainlinkFeedForAgentOracleV2 quoteFeed = new MockChainlinkFeedForAgentOracleV2(8);
        oracle.setQuoteUsdFeed(address(quoteFeed));

        address agentToken = address(new MockERC20Decimals(18));
        address quoteToken6 = address(new MockERC20Decimals(6));
        MockUniswapV2PairForAgentOracle pair = new MockUniswapV2PairForAgentOracle(quoteToken6, agentToken);

        // Human-unit ratio: 200 agent / 100 quote = 2 agent per quote.
        // Raw reserves: quote has 6 decimals, agent has 18.
        uint32 t0 = uint32(block.timestamp);
        pair.setState(100e6, 200e18, t0, 0, 0);
        oracle.setV2Pair(address(pair), agentToken, quoteToken6, 1800);
        oracle.initializeAssetPrice(int256(5e18));

        vm.warp(block.timestamp + 1800);
        quoteFeed.setLatestAnswer(10e8, block.timestamp); // quote/USD = 10

        oracle.updateAssetPriceFromTWAP(1800);
        (int256 price,) = oracle.getAssetPrice();

        // USD/Agent = 10 / 2 = 5 — without decimal normalization this would be off by 1e12.
        assertEq(price, int256(5e18));
    }

    function test_autoTwapPath_doesNotBootstrapUninitializedOracle() external {
        AgentOracle oracle = _deployOracle();

        MockChainlinkFeedForAgentOracleV2 quoteFeed = new MockChainlinkFeedForAgentOracleV2(8);
        oracle.setQuoteUsdFeed(address(quoteFeed));

        address agentToken = address(new MockERC20Decimals(18));
        address quoteToken = address(new MockERC20Decimals(18));
        MockUniswapV2PairForAgentOracle pair = new MockUniswapV2PairForAgentOracle(quoteToken, agentToken);

        uint32 t0 = uint32(block.timestamp);
        pair.setState(100e18, 200e18, t0, 0, 0);
        oracle.setV2Pair(address(pair), agentToken, quoteToken, 1800);
        // Deliberately NOT calling initializeAssetPrice.

        vm.warp(block.timestamp + 1800);
        quoteFeed.setLatestAnswer(10e8, block.timestamp);

        // Manual TWAP path must refuse to bootstrap.
        vm.expectRevert(AgentOracle.OracleNotInitialized.selector);
        oracle.updateAssetPriceFromTWAP(1800);
        assertEq(oracle.assetPriceUSD(), int256(0));
    }

    function test_updateAgentPriceFromTWAP_revertsInvalidPrice_whenQuoteFeedMissingDecimals() external {
        AgentOracle oracle = _deployOracle();
        MockChainlinkFeedForAgentOracleV2 ethFeed = new MockChainlinkFeedForAgentOracleV2(8);
        MockChainlinkFeedNoDecimalsForAgentOracleV2 badQuoteFeed = new MockChainlinkFeedNoDecimalsForAgentOracleV2();
        oracle.setChainlinkFeed(address(ethFeed));
        oracle.setQuoteUsdFeed(address(badQuoteFeed));

        address agentToken = address(new MockERC20Decimals(18));
        address quoteToken = address(new MockERC20Decimals(18));
        MockUniswapV2PairForAgentOracle pair = new MockUniswapV2PairForAgentOracle(quoteToken, agentToken);

        uint32 t0 = uint32(block.timestamp);
        pair.setState(100e18, 200e18, t0, 0, 0);
        oracle.setV2Pair(address(pair), agentToken, quoteToken, 1800);
        oracle.initializeAssetPrice(int256(5e18));

        vm.warp(block.timestamp + 1800);
        badQuoteFeed.setLatestAnswer(10e8, block.timestamp);

        vm.expectRevert(AgentOracle.InvalidPrice.selector);
        oracle.updateAssetPriceFromTWAP(1800);
    }

    function _deployOracle() internal returns (AgentOracle oracle) {
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(address(this)));
        MockRegistryForAgentOracleV2 registry = new MockRegistryForAgentOracleV2(LZ_ENDPOINT, HUB_EID);
        oracle = new AgentOracle(address(registry), address(0), "AGENT", address(this));
    }
}
