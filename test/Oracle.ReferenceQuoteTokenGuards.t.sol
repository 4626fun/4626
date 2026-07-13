// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CreatorOracle} from "@4626/creator/oracles/CreatorOracle.sol";
import {AgentOracle} from "@4626/agent/oracles/AgentOracle.sol";

contract MockRegistryForOracleQuoteTokenGuard {
    address internal endpoint;
    uint32 internal eid;

    constructor(address _endpoint, uint32 _eid) {
        endpoint = _endpoint;
        eid = _eid;
    }

    function getLayerZeroEndpoint(uint256) external view returns (address) {
        return endpoint;
    }

    function hubChainEid() external view returns (uint32) {
        return eid;
    }
}

contract MockV3PoolForOracleQuoteTokenGuard {
    address public immutable token0;
    address public immutable token1;

    constructor(address _token0, address _token1) {
        token0 = _token0;
        token1 = _token1;
    }

    /// @dev Constant tick 0 (price 1:1 in raw units) for TWAP reads.
    function observe(uint32[] calldata secondsAgos)
        external
        pure
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s)
    {
        tickCumulatives = new int56[](secondsAgos.length);
        secondsPerLiquidityCumulativeX128s = new uint160[](secondsAgos.length);
    }
}

contract MockQuoteUsdFeedForOracleQuoteTokenGuard {
    int256 public answer;
    uint256 public updatedAt;

    function decimals() external pure returns (uint8) {
        return 8;
    }

    function setLatestAnswer(int256 _answer, uint256 _updatedAt) external {
        answer = _answer;
        updatedAt = _updatedAt;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, answer, 0, updatedAt, 1);
    }
}

contract MockErc20MetadataForOracleQuoteTokenGuard {
    uint8 internal immutable decimalsValue;

    constructor(uint8 _decimals) {
        decimalsValue = _decimals;
    }

    function decimals() external view returns (uint8) {
        return decimalsValue;
    }
}

contract MockV2PairForOracleQuoteTokenGuard {
    address public immutable token0;
    address public immutable token1;

    constructor(address _token0, address _token1) {
        token0 = _token0;
        token1 = _token1;
    }

    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast) {
        reserve0 = 1;
        reserve1 = 1;
        blockTimestampLast = uint32(block.timestamp % 2 ** 32);
    }

    function price0CumulativeLast() external pure returns (uint256) {
        return 0;
    }

    function price1CumulativeLast() external pure returns (uint256) {
        return 0;
    }
}

contract OracleReferenceQuoteTokenGuardsTest is Test {
    uint32 internal constant HUB_EID = 30184;
    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    uint256 internal constant BASE_CHAIN_ID = 8453;

    function test_creatorOracle_rejectsUnexpectedReferenceQuoteToken() external {
        CreatorOracle oracle = _deployCreatorOracle();

        address creatorToken = address(new MockErc20MetadataForOracleQuoteTokenGuard(18));
        address zoraToken = address(new MockErc20MetadataForOracleQuoteTokenGuard(18));
        address wrongQuote = address(new MockErc20MetadataForOracleQuoteTokenGuard(6));
        address pool = address(new MockV3PoolForOracleQuoteTokenGuard(creatorToken, wrongQuote));

        oracle.setReferenceQuoteToken(zoraToken);

        vm.expectRevert(abi.encodeWithSelector(CreatorOracle.InvalidReferenceQuoteToken.selector, zoraToken, wrongQuote));
        oracle.setV3Pool(pool, creatorToken, wrongQuote, 1800);
    }

    function test_creatorOracle_acceptsConfiguredReferenceQuoteToken() external {
        CreatorOracle oracle = _deployCreatorOracle();

        address creatorToken = address(new MockErc20MetadataForOracleQuoteTokenGuard(18));
        address zoraToken = address(new MockErc20MetadataForOracleQuoteTokenGuard(18));
        address pool = address(new MockV3PoolForOracleQuoteTokenGuard(creatorToken, zoraToken));

        oracle.setReferenceQuoteToken(zoraToken);
        oracle.setV3Pool(pool, creatorToken, zoraToken, 1800);

        assertEq(oracle.v3UsdToken(), zoraToken);
    }

    function test_creatorOracle_lockedReferenceQuoteTokenCannotChange() external {
        CreatorOracle oracle = _deployCreatorOracle();
        address zoraToken = address(new MockErc20MetadataForOracleQuoteTokenGuard(18));
        address otherToken = address(new MockErc20MetadataForOracleQuoteTokenGuard(18));

        oracle.setReferenceQuoteToken(zoraToken);
        oracle.lockReferenceQuoteToken();

        vm.expectRevert(CreatorOracle.ReferenceQuoteTokenIsLocked.selector);
        oracle.setReferenceQuoteToken(otherToken);
    }

    function test_creatorOracle_cannotLockWithoutReferenceQuoteToken() external {
        CreatorOracle oracle = _deployCreatorOracle();
        vm.expectRevert(CreatorOracle.ReferenceQuoteTokenUnset.selector);
        oracle.lockReferenceQuoteToken();
    }

    function test_agentOracle_rejectsUnexpectedReferenceQuoteToken() external {
        AgentOracle oracle = _deployAgentOracle();

        address agentToken = address(new MockErc20MetadataForOracleQuoteTokenGuard(18));
        address virtualToken = address(new MockErc20MetadataForOracleQuoteTokenGuard(18));
        address wrongQuote = address(new MockErc20MetadataForOracleQuoteTokenGuard(6));
        address pool = address(new MockV3PoolForOracleQuoteTokenGuard(agentToken, wrongQuote));

        oracle.setReferenceQuoteToken(virtualToken);

        vm.expectRevert(abi.encodeWithSelector(AgentOracle.InvalidReferenceQuoteToken.selector, virtualToken, wrongQuote));
        oracle.setV3Pool(pool, agentToken, wrongQuote, 1800);
    }

    function test_agentOracle_setV2Pair_rejectsUnexpectedReferenceQuoteToken() external {
        AgentOracle oracle = _deployAgentOracle();

        address agentToken = address(new MockErc20MetadataForOracleQuoteTokenGuard(18));
        address virtualToken = address(new MockErc20MetadataForOracleQuoteTokenGuard(18));
        address wrongQuote = address(new MockErc20MetadataForOracleQuoteTokenGuard(6));
        address pair = address(new MockV2PairForOracleQuoteTokenGuard(agentToken, wrongQuote));

        oracle.setReferenceQuoteToken(virtualToken);

        vm.expectRevert(abi.encodeWithSelector(AgentOracle.InvalidReferenceQuoteToken.selector, virtualToken, wrongQuote));
        oracle.setV2Pair(pair, agentToken, wrongQuote, 1800);
    }

    function test_agentOracle_acceptsConfiguredReferenceQuoteToken() external {
        AgentOracle oracle = _deployAgentOracle();

        address agentToken = address(new MockErc20MetadataForOracleQuoteTokenGuard(18));
        address virtualToken = address(new MockErc20MetadataForOracleQuoteTokenGuard(18));
        address pool = address(new MockV3PoolForOracleQuoteTokenGuard(agentToken, virtualToken));

        oracle.setReferenceQuoteToken(virtualToken);
        oracle.setV3Pool(pool, agentToken, virtualToken, 1800);

        assertEq(oracle.v3QuoteToken(), virtualToken);
    }

    function test_agentOracle_lockedReferenceQuoteTokenCannotChange() external {
        AgentOracle oracle = _deployAgentOracle();
        address virtualToken = address(new MockErc20MetadataForOracleQuoteTokenGuard(18));
        address otherToken = address(new MockErc20MetadataForOracleQuoteTokenGuard(18));

        oracle.setReferenceQuoteToken(virtualToken);
        oracle.lockReferenceQuoteToken();

        vm.expectRevert(AgentOracle.ReferenceQuoteTokenIsLocked.selector);
        oracle.setReferenceQuoteToken(otherToken);
    }

    function test_agentOracle_cannotLockWithoutReferenceQuoteToken() external {
        AgentOracle oracle = _deployAgentOracle();
        vm.expectRevert(AgentOracle.ReferenceQuoteTokenUnset.selector);
        oracle.lockReferenceQuoteToken();
    }

    function test_creatorOracle_v3Update_failsClosedWithoutQuoteUsdFeed_whenReferencePinned() external {
        vm.chainId(BASE_CHAIN_ID);
        vm.warp(1_700_000_000);
        CreatorOracle oracle = _deployCreatorOracle();

        address creatorToken = address(new MockErc20MetadataForOracleQuoteTokenGuard(18));
        address zoraToken = address(new MockErc20MetadataForOracleQuoteTokenGuard(18));
        address pool = address(new MockV3PoolForOracleQuoteTokenGuard(creatorToken, zoraToken));

        oracle.setReferenceQuoteToken(zoraToken);
        oracle.setV3Pool(pool, creatorToken, zoraToken, 1800);
        oracle.initializeAssetPrice(int256(1e18));
        oracle.setPriceUpdateCooldown(0);

        // Pinned non-stable quote without a quote/USD feed must not store a ZORA-denominated price as USD.
        vm.expectRevert(abi.encodeWithSelector(CreatorOracle.MissingQuoteUsdFeed.selector, zoraToken));
        oracle.updateAssetPriceFromV3TWAP(1800);
    }

    function test_creatorOracle_v3Update_convertsQuoteToUsd_viaQuoteUsdFeed() external {
        vm.chainId(BASE_CHAIN_ID);
        vm.warp(1_700_000_000);
        CreatorOracle oracle = _deployCreatorOracle();

        address creatorToken = address(new MockErc20MetadataForOracleQuoteTokenGuard(18));
        address zoraToken = address(new MockErc20MetadataForOracleQuoteTokenGuard(18));
        address pool = address(new MockV3PoolForOracleQuoteTokenGuard(creatorToken, zoraToken));
        MockQuoteUsdFeedForOracleQuoteTokenGuard quoteFeed = new MockQuoteUsdFeedForOracleQuoteTokenGuard();

        oracle.setReferenceQuoteToken(zoraToken);
        oracle.setV3Pool(pool, creatorToken, zoraToken, 1800);
        oracle.setQuoteUsdFeed(address(quoteFeed));
        oracle.initializeAssetPrice(int256(0.5e18));
        oracle.setPriceUpdateCooldown(0);

        // Tick 0 => 1 ZORA per CREATOR; ZORA/USD = 0.50 => USD/CREATOR = 0.50.
        quoteFeed.setLatestAnswer(0.5e8, block.timestamp);
        oracle.updateAssetPriceFromV3TWAP(1800);

        // Without the conversion the write would be 1e18 (100% deviation from 0.5e18) and revert.
        assertEq(oracle.assetPriceUSD(), int256(0.5e18));
    }

    function test_agentOracle_v3Update_failsClosedWithoutQuoteUsdFeed_whenReferencePinned() external {
        vm.chainId(BASE_CHAIN_ID);
        vm.warp(1_700_000_000);
        AgentOracle oracle = _deployAgentOracle();

        address agentToken = address(new MockErc20MetadataForOracleQuoteTokenGuard(18));
        address virtualToken = address(new MockErc20MetadataForOracleQuoteTokenGuard(18));
        address pool = address(new MockV3PoolForOracleQuoteTokenGuard(agentToken, virtualToken));

        oracle.setReferenceQuoteToken(virtualToken);
        oracle.setV3Pool(pool, agentToken, virtualToken, 1800);
        oracle.initializeAssetPrice(int256(1e18));
        oracle.setPriceUpdateCooldown(0);

        vm.expectRevert(abi.encodeWithSelector(AgentOracle.MissingQuoteUsdFeed.selector, virtualToken));
        oracle.updateAssetPriceFromV3TWAP(1800);
    }

    function test_agentOracle_v3Update_convertsQuoteToUsd_viaQuoteUsdFeed() external {
        vm.chainId(BASE_CHAIN_ID);
        vm.warp(1_700_000_000);
        AgentOracle oracle = _deployAgentOracle();

        address agentToken = address(new MockErc20MetadataForOracleQuoteTokenGuard(18));
        address virtualToken = address(new MockErc20MetadataForOracleQuoteTokenGuard(18));
        address pool = address(new MockV3PoolForOracleQuoteTokenGuard(agentToken, virtualToken));
        MockQuoteUsdFeedForOracleQuoteTokenGuard quoteFeed = new MockQuoteUsdFeedForOracleQuoteTokenGuard();

        oracle.setReferenceQuoteToken(virtualToken);
        oracle.setV3Pool(pool, agentToken, virtualToken, 1800);
        oracle.setQuoteUsdFeed(address(quoteFeed));
        oracle.initializeAssetPrice(int256(2e18));
        oracle.setPriceUpdateCooldown(0);

        // Tick 0 => 1 VIRTUAL per AGENT; VIRTUAL/USD = 2.00 => USD/AGENT = 2.00.
        quoteFeed.setLatestAnswer(2e8, block.timestamp);
        oracle.updateAssetPriceFromV3TWAP(1800);

        assertEq(oracle.assetPriceUSD(), int256(2e18));
    }

    function _deployCreatorOracle() internal returns (CreatorOracle oracle) {
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(address(this)));
        address registry = address(new MockRegistryForOracleQuoteTokenGuard(LZ_ENDPOINT, HUB_EID));
        oracle = new CreatorOracle(registry, address(0), "CREATOR", address(this));
    }

    function _deployAgentOracle() internal returns (AgentOracle oracle) {
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(address(this)));
        address registry = address(new MockRegistryForOracleQuoteTokenGuard(LZ_ENDPOINT, HUB_EID));
        oracle = new AgentOracle(registry, address(0), "AGENT", address(this));
    }
}
