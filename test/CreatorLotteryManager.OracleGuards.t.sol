// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {CreatorLotteryManager} from "../contracts/utilities/lottery/CreatorLotteryManager.sol";

contract MockCreatorOracleOracleGuards {
    int256 public price = 1e18;
    uint256 public updatedAt;

    constructor() {
        updatedAt = block.timestamp;
    }

    function setPrice(int256 nextPrice) external {
        price = nextPrice;
        updatedAt = block.timestamp;
    }

    function setUpdatedAt(uint256 nextUpdatedAt) external {
        updatedAt = nextUpdatedAt;
    }

    function getCreatorPrice() external view returns (int256, uint256) {
        return (price, updatedAt);
    }
}

contract MockLotteryRegistryOracleGuards {
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

    function getLayerZeroEndpoint(uint256) external view returns (address) {
        return endpoint;
    }

    function getAllCreatorCoins() external view returns (address[] memory coins) {
        coins = new address[](1);
        coins[0] = creatorCoin;
    }
}

contract MockLocalVrfConsumerOracleGuards {
    uint256 public nextRequestId = 1;

    function requestRandomWords() external returns (uint256 requestId) {
        requestId = nextRequestId++;
    }
}

contract CreatorLotteryManagerOracleGuardsTest is Test {
    CreatorLotteryManager internal lotteryManager;
    MockLotteryRegistryOracleGuards internal registry;
    MockCreatorOracleOracleGuards internal oracle;
    MockLocalVrfConsumerOracleGuards internal localVrfConsumer;

    address internal owner = address(0xA11CE);
    address internal authorizedSwap = address(0xBEEF);
    address internal buyer = address(0xCAFE);

    address internal creatorCoin = address(0x1001);
    address internal shareOFT = address(0x1002);

    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    function setUp() public {
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(owner));

        oracle = new MockCreatorOracleOracleGuards();
        localVrfConsumer = new MockLocalVrfConsumerOracleGuards();
        registry = new MockLotteryRegistryOracleGuards(LZ_ENDPOINT, creatorCoin, shareOFT, address(oracle));

        vm.prank(owner);
        lotteryManager = new CreatorLotteryManager(address(registry), owner);

        vm.startPrank(owner);
        lotteryManager.setAuthorizedSwapContract(authorizedSwap, true);
        lotteryManager.setLocalVRFConsumer(address(localVrfConsumer));
        lotteryManager.setUseLocalVRF(true);
        vm.stopPrank();
    }

    function test_ProcessSwapLottery_SkipsWhenOracleStaleBeyondConfiguredMax() public {
        vm.prank(owner);
        (bool ok,) = address(lotteryManager).call(abi.encodeWithSignature("setOracleMaxStaleness(uint256)", 60));
        assertTrue(ok, "expected staleness setter");

        // Oracle timestamp stays at deploy-time, advance beyond max staleness.
        vm.warp(block.timestamp + 61);

        vm.prank(authorizedSwap);
        uint256 entryId = lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether);
        assertEq(entryId, 0, "stale oracle should skip the entry");
    }

    function test_ProcessSwapLottery_SkipsWhenOracleDeviationTooHighWithinWindow() public {
        vm.startPrank(owner);
        (bool ok1,) = address(lotteryManager)
            .call(abi.encodeWithSignature("setOracleDeviationGuard(uint256,uint256)", 1000, 1 hours));
        assertTrue(ok1, "expected deviation guard setter");
        vm.stopPrank();

        // First entry sets the reference price.
        vm.prank(authorizedSwap);
        uint256 firstId = lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether);
        assertGt(firstId, 0, "first entry should succeed");

        // Price jumps +50% within the deviation window → should be considered ineligible.
        oracle.setPrice(15e17);

        vm.prank(authorizedSwap);
        uint256 secondId = lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether);
        assertEq(secondId, 0, "deviation guard should skip the entry");
    }
}

