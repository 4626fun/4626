// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {CreatorOracle} from "../contracts/utilities/oracles/CreatorOracle.sol";

interface IChainlinkFeed {
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

contract MockSequencerFeed is IChainlinkFeed {
    int256 public answer;
    uint256 public updatedAt;

    constructor(int256 _answer) {
        answer = _answer;
        updatedAt = block.timestamp;
    }

    function setAnswer(int256 _answer) external {
        answer = _answer;
        updatedAt = block.timestamp;
    }

    function setUpdatedAt(uint256 ts) external {
        updatedAt = ts;
    }

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256, uint256, uint256, uint80)
    {
        return (1, answer, block.timestamp, updatedAt, 1);
    }
}

contract MockEthFeed is IChainlinkFeed {
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256, uint256 updatedAt, uint80 answeredInRound)
    {
        return (1, 3000e8, block.timestamp, block.timestamp, 1);
    }
}

contract MockRegistrySequencer {
    address public immutable endpoint;

    constructor(address _endpoint) {
        endpoint = _endpoint;
    }

    function getLayerZeroEndpoint(uint256) external view returns (address) {
        return endpoint;
    }

    function hubChainEid() external pure returns (uint32) {
        return 30184;
    }
}

/// @notice AUDIT-2026-07-01-M07 — Base sequencer uptime guard on ETH price reads.
contract CreatorOracleSequencerFeedTest is Test {
    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    CreatorOracle internal oracle;
    MockEthFeed internal ethFeed;
    MockSequencerFeed internal sequencerFeed;

    function setUp() public {
        vm.warp(1_700_000_000);
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(address(this)));

        MockRegistrySequencer registry = new MockRegistrySequencer(LZ_ENDPOINT);
        oracle = new CreatorOracle(address(registry), address(0), "TEST", address(this));
        ethFeed = new MockEthFeed();
        sequencerFeed = new MockSequencerFeed(0);

        oracle.setChainlinkFeed(address(ethFeed));
        oracle.setSequencerUptimeFeed(address(sequencerFeed));
        oracle.initializeCreatorPrice(int256(1e18));
    }

    function test_getEthPrice_returnsZeroWhenSequencerDown() public {
        sequencerFeed.setAnswer(1);
        (int256 price, uint256 ts) = oracle.getEthPrice();
        assertEq(price, 0);
        assertEq(ts, 0);
    }

    function test_getEthPrice_returnsFeedWhenSequencerUp() public view {
        (int256 price,) = oracle.getEthPrice();
        assertGt(price, 0);
    }

    function test_getEthPrice_returnsZeroWhenSequencerFeedStale() public {
        sequencerFeed.setUpdatedAt(block.timestamp - 2 days);
        (int256 price, uint256 ts) = oracle.getEthPrice();
        assertEq(price, 0);
        assertEq(ts, 0);
    }
}
