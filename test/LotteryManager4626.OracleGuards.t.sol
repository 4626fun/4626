// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {LotteryManager4626} from "@4626/shared/lottery/manager/LotteryManager4626.sol";

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

    function getAssetPrice() external view returns (int256, uint256) {
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

    function isTokenActive(address token) external view returns (bool) {
        return token == creatorCoin;
    }

    function getLayerZeroEndpoint(uint256) external view returns (address) {
        return endpoint;
    }

    function getAllTokens() external view returns (address[] memory coins) {
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

contract LotteryManager4626OracleGuardsTest is Test {
    LotteryManager4626 internal lotteryManager;
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
        lotteryManager = new LotteryManager4626(address(registry), owner);

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
        uint256 entryId = lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether, 0);
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
        uint256 firstId = lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether, 0);
        assertGt(firstId, 0, "first entry should succeed");

        // Price jumps +50% within the deviation window → should be considered ineligible.
        oracle.setPrice(15e17);

        vm.prank(authorizedSwap);
        uint256 secondId = lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether, 0);
        assertEq(secondId, 0, "deviation guard should skip the entry");
    }

    function test_ProcessSwapLottery_RebootstrapsWhenDeviationReferenceStale() public {
        vm.prank(owner);
        lotteryManager.setOracleDeviationGuard(1000, 1 hours);

        vm.prank(authorizedSwap);
        uint256 firstId = lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether, 0);
        assertGt(firstId, 0);
        uint256 firstTimestamp = lotteryManager.lastAcceptedPriceTimestamp(creatorCoin);
        assertEq(lotteryManager.lastAcceptedPriceUSD1e18(creatorCoin), 1e18);

        oracle.setPrice(15e17);
        vm.prank(authorizedSwap);
        assertEq(lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether, 0), 0);
        assertEq(lotteryManager.lastAcceptedPriceUSD1e18(creatorCoin), 1e18);
        assertEq(lotteryManager.lastAcceptedPriceTimestamp(creatorCoin), firstTimestamp);

        // ODA-496-6: widen the band over multiple windows (10% × 5 = 50%) instead of
        // disabling deviation after a single window elapses.
        vm.warp(block.timestamp + 4 hours + 1);
        oracle.setPrice(15e17);
        vm.prank(authorizedSwap);
        uint256 recoveredId = lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether, 0);
        assertGt(recoveredId, 0, "aged reference must widen band enough to accept");
        assertEq(lotteryManager.lastAcceptedPriceUSD1e18(creatorCoin), 15e17);
        assertEq(lotteryManager.lastAcceptedPriceTimestamp(creatorCoin), block.timestamp);
    }

    function test_ProcessSwapLottery_ZeroDeviationSettingDisablesGuard() public {
        vm.prank(authorizedSwap);
        assertGt(lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether, 0), 0);

        vm.prank(owner);
        lotteryManager.setOracleDeviationGuard(0, 1 hours);
        oracle.setPrice(2e18);
        vm.prank(authorizedSwap);
        assertGt(lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether, 0), 0);

        vm.prank(owner);
        lotteryManager.setOracleDeviationGuard(1000, 0);
        oracle.setPrice(4e18);
        vm.prank(authorizedSwap);
        assertGt(lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether, 0), 0);
    }
}
