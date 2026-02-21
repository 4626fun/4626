// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {CreatorLotteryManager} from "../contracts/services/lottery/CreatorLotteryManager.sol";

contract MockCreatorOracleFutureTimestamp {
    int256 public price = 1e18;
    uint256 public updatedAt;

    constructor(uint256 _updatedAt) {
        updatedAt = _updatedAt;
    }

    function getCreatorPrice() external view returns (int256, uint256) {
        return (price, updatedAt);
    }
}

contract MockLotteryRegistryTimestampGuard {
    address public immutable endpoint;
    address public immutable creatorCoin;
    address public immutable shareOFT;
    address public immutable oracle;

    constructor(address _endpoint, address _creatorCoin, address _shareOFT, address _oracle) {
        endpoint = _endpoint;
        creatorCoin = _creatorCoin;
        shareOFT = _shareOFT;
        oracle = _oracle;
    }

    function getVaultForToken(address) external pure returns (address) {
        return address(0);
    }

    function getShareOFTForToken(address token) external view returns (address) {
        if (token == creatorCoin) return shareOFT;
        return address(0);
    }

    function getTokenForShareOFT(address _shareOFT) external view returns (address) {
        if (_shareOFT == shareOFT) return creatorCoin;
        return address(0);
    }

    function getOracleForToken(address token) external view returns (address) {
        if (token == creatorCoin) return oracle;
        return address(0);
    }

    function getGaugeControllerForToken(address) external pure returns (address) {
        return address(0);
    }

    function isCreatorCoinActive(address token) external view returns (bool) {
        return token == creatorCoin;
    }

    function getLayerZeroEndpoint(uint16) external view returns (address) {
        return endpoint;
    }

    function getAllCreatorCoins() external view returns (address[] memory coins) {
        coins = new address[](1);
        coins[0] = creatorCoin;
    }
}

contract CreatorLotteryManagerOracleTimestampGuardTest is Test {
    CreatorLotteryManager internal lotteryManager;
    MockLotteryRegistryTimestampGuard internal registry;
    MockCreatorOracleFutureTimestamp internal oracle;

    address internal owner = address(0xA11CE);
    address internal authorizedSwap = address(0xBEEF);
    address internal buyer = address(0xCAFE);

    address internal creatorCoin = address(0x1001);
    address internal shareOFT = address(0x1002);

    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    function setUp() public {
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(owner));

        oracle = new MockCreatorOracleFutureTimestamp(block.timestamp + 1 days);
        registry = new MockLotteryRegistryTimestampGuard(LZ_ENDPOINT, creatorCoin, shareOFT, address(oracle));

        vm.prank(owner);
        lotteryManager = new CreatorLotteryManager(address(registry), owner);

        vm.prank(owner);
        lotteryManager.setAuthorizedSwapContract(authorizedSwap, true);
    }

    function test_ProcessSwapLottery_SkipsWhenOracleTimestampInFuture() public {
        // This should never revert; timestamp anomalies should just skip the entry.
        vm.prank(authorizedSwap);
        uint256 entryId = lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether);

        assertEq(entryId, 0);
    }
}

