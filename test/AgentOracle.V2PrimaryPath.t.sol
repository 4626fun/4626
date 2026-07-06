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

        MockChainlinkFeedForAgentOracleV2 ethFeed = new MockChainlinkFeedForAgentOracleV2();
        MockChainlinkFeedForAgentOracleV2 quoteFeed = new MockChainlinkFeedForAgentOracleV2();
        oracle.setChainlinkFeed(address(ethFeed));
        oracle.setV2QuoteUsdFeed(address(quoteFeed));

        address agentToken = address(new MockERC20Decimals(18));
        address quoteToken = address(new MockERC20Decimals(18));
        MockUniswapV2PairForAgentOracle pair = new MockUniswapV2PairForAgentOracle(quoteToken, agentToken);

        // Set reserves so Agent/Quote = 2.0 (reserveAgent/reserveQuote).
        // token0 = quote, token1 = agent, so price0 (agent/quote) = reserve1/reserve0 = 2.
        uint32 t0 = uint32(block.timestamp);
        pair.setState(100e18, 200e18, t0, 0, 0);

        oracle.setV2Pair(address(pair), agentToken, quoteToken, 1800);
        oracle.initializeAgentPrice(int256(5e18));

        vm.warp(block.timestamp + 1800);
        // Intentionally set ETH feed to a different value to ensure the V2 quote feed is used.
        ethFeed.setLatestAnswer(99e8, block.timestamp);
        quoteFeed.setLatestAnswer(10e8, block.timestamp); // quote/USD = 10

        oracle.updateAgentPriceFromTWAP(1800);
        (int256 price,) = oracle.getAgentPrice();

        // USD/Agent = (USD/Quote) / (Agent/Quote) = 10 / 2 = 5
        assertEq(price, int256(5e18));
    }

    function _deployOracle() internal returns (AgentOracle oracle) {
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(address(this)));
        MockRegistryForAgentOracleV2 registry = new MockRegistryForAgentOracleV2(LZ_ENDPOINT, HUB_EID);
        oracle = new AgentOracle(address(registry), address(0), "AGENT", address(this));
    }
}
