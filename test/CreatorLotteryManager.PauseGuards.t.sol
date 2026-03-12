// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {CreatorLotteryManager} from "../contracts/utilities/lottery/CreatorLotteryManager.sol";
import {Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract MockCreatorOraclePauseGuards {
    int256 public price = 1e18;
    uint256 public updatedAt;

    constructor() {
        updatedAt = block.timestamp;
    }

    function getCreatorPrice() external view returns (int256, uint256) {
        return (price, updatedAt);
    }
}

contract MockGaugeControllerPauseGuards {
    uint256 public jackpot = 100e18;
    uint256 public payCount;
    address public lastWinner;
    uint256 public lastShares;

    function setJackpot(uint256 nextJackpot) external {
        jackpot = nextJackpot;
    }

    function getJackpotReserve() external view returns (uint256) {
        return jackpot;
    }

    function payJackpot(address winner, uint256 shares) external {
        payCount++;
        lastWinner = winner;
        lastShares = shares;
    }
}

contract MockLotteryRegistryPauseGuards {
    address public immutable endpoint;
    address public immutable creatorCoin;
    address public immutable shareOFT;
    address public immutable oracle;
    address public immutable vault;
    address public immutable gauge;

    constructor(
        address _endpoint,
        address _creatorCoin,
        address _shareOFT,
        address _oracle,
        address _vault,
        address _gauge
    ) {
        endpoint = _endpoint;
        creatorCoin = _creatorCoin;
        shareOFT = _shareOFT;
        oracle = _oracle;
        vault = _vault;
        gauge = _gauge;
    }

    function getVaultForToken(address token) external view returns (address) {
        if (token == creatorCoin) return vault;
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

    function getGaugeControllerForToken(address token) external view returns (address) {
        if (token == creatorCoin) return gauge;
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

contract MockLocalVrfConsumerPauseGuards {
    uint256 public nextRequestId = 1;

    function requestRandomWords() external returns (uint256 requestId) {
        requestId = nextRequestId++;
    }
}

contract MockBoostManagerPauseGuards {
    uint256 public boostBps = 10_000;
    uint256 public probabilityBoostBps;

    function setBoostBps(uint256 nextBoostBps) external {
        boostBps = nextBoostBps;
    }

    function setProbabilityBoostBps(uint256 nextProbabilityBoostBps) external {
        probabilityBoostBps = nextProbabilityBoostBps;
    }

    function calculateBoost(address) external view returns (uint256) {
        return boostBps;
    }

    function getTotalProbabilityBoost(address) external view returns (uint256) {
        return probabilityBoostBps;
    }

    function hasBoost(address) external view returns (bool) {
        return boostBps > 10_000 || probabilityBoostBps > 0;
    }
}

contract MockVaultGaugeVotingPauseGuards {
    mapping(address => uint256) public boostPPMByVault;

    function setGaugeBoostPPM(address vault, uint256 nextBoostPPM) external {
        boostPPMByVault[vault] = nextBoostPPM;
    }

    function getVaultGaugeProbabilityBoostPPM(address vault) external view returns (uint256) {
        return boostPPMByVault[vault];
    }
}

contract CreatorLotteryManagerPauseHarness is CreatorLotteryManager {
    constructor(address registry_, address owner_) CreatorLotteryManager(registry_, owner_) {}

    function exposedLzReceive(Origin calldata origin, bytes calldata payload) external {
        // Pass an empty `extraData` as calldata (required by the signature).
        _lzReceive(origin, bytes32(0), payload, address(0), payload[:0]);
    }
}

contract CreatorLotteryManagerPauseGuardsTest is Test {
    CreatorLotteryManagerPauseHarness internal lotteryManager;
    MockLotteryRegistryPauseGuards internal registry;
    MockCreatorOraclePauseGuards internal oracle;
    MockGaugeControllerPauseGuards internal gauge;
    MockLocalVrfConsumerPauseGuards internal localVrfConsumer;
    MockBoostManagerPauseGuards internal boostManager;
    MockVaultGaugeVotingPauseGuards internal vaultGaugeVoting;

    address internal owner = address(0xA11CE);
    address internal authorizedSwap = address(0xBEEF);
    address internal buyer = address(0xCAFE);

    address internal creatorCoin = address(0x1001);
    address internal shareOFT = address(0x1002);
    address internal vault = address(0x1003);

    uint32 internal constant SRC_EID = 30110;
    bytes32 internal constant SRC_SENDER = bytes32(uint256(0x1234));
    uint32 internal constant SOURCE_CHAIN_ID = 42161;

    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    function setUp() public {
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(owner));

        oracle = new MockCreatorOraclePauseGuards();
        gauge = new MockGaugeControllerPauseGuards();
        localVrfConsumer = new MockLocalVrfConsumerPauseGuards();
        boostManager = new MockBoostManagerPauseGuards();
        vaultGaugeVoting = new MockVaultGaugeVotingPauseGuards();

        registry = new MockLotteryRegistryPauseGuards(
            LZ_ENDPOINT, creatorCoin, shareOFT, address(oracle), vault, address(gauge)
        );

        vm.prank(owner);
        lotteryManager = new CreatorLotteryManagerPauseHarness(address(registry), owner);

        vm.startPrank(owner);
        lotteryManager.setAuthorizedSwapContract(authorizedSwap, true);
        lotteryManager.setLocalVRFConsumer(address(localVrfConsumer));
        lotteryManager.setUseLocalVRF(true);
        lotteryManager.setBoostManager(address(boostManager));
        lotteryManager.setVaultGaugeVoting(address(vaultGaugeVoting));
        lotteryManager.setAuthorizedRemoteOFT(SRC_EID, SRC_SENDER, true);
        vm.stopPrank();
    }

    function test_LzReceive_RevertsWhenPaused() public {
        vm.prank(owner);
        lotteryManager.pause();

        Origin memory origin = Origin({srcEid: SRC_EID, sender: SRC_SENDER, nonce: 1});
        bytes memory payload =
            abi.encode(uint16(lotteryManager.MSG_TYPE_LOTTERY_ENTRY()), buyer, shareOFT, 1 ether, SOURCE_CHAIN_ID);

        vm.expectRevert(Pausable.EnforcedPause.selector);
        lotteryManager.exposedLzReceive(origin, payload);
    }

    function test_VrfCallback_UsesStoredBoostedOddsForImmediateSettlement() public {
        boostManager.setBoostBps(20_000);

        vm.prank(authorizedSwap);
        uint256 requestId = lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether);
        assertGt(requestId, 0, "expected VRF request");

        (,, uint256 amountUSD, uint256 effectiveWinChancePPM,,,,,) = lotteryManager.vrfRequests(requestId);
        uint256 baseWinChance = lotteryManager.getWinChance(amountUSD);
        assertEq(baseWinChance, 40, "expected $1 trade to use base odds");
        assertEq(effectiveWinChancePPM, 80, "request should store boosted odds snapshot");

        boostManager.setBoostBps(10_000);

        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = 60; // Above base odds (40), below boosted odds (80).

        vm.prank(address(localVrfConsumer));
        lotteryManager.receiveRandomWords(requestId, randomWords);

        assertEq(gauge.payCount(), 1, "boosted odds should settle as a win");
        assertEq(gauge.lastWinner(), buyer, "winner should match buyer");
    }

    function test_VrfCallback_DefersWhilePaused_AndUsesStoredBoostedOddsAfterUnpause() public {
        boostManager.setBoostBps(20_000);

        vm.prank(authorizedSwap);
        uint256 requestId = lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether);
        assertGt(requestId, 0, "expected VRF request");

        (,, uint256 amountUSD, uint256 effectiveWinChancePPM,,,,,) = lotteryManager.vrfRequests(requestId);
        uint256 baseWinChance = lotteryManager.getWinChance(amountUSD);
        assertEq(baseWinChance, 40, "expected $1 trade to use base odds");
        assertEq(effectiveWinChancePPM, 80, "request should store boosted odds snapshot");

        boostManager.setBoostBps(10_000);

        vm.prank(owner);
        lotteryManager.pause();

        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = 60; // Above base odds (40), below boosted odds (80).

        vm.prank(address(localVrfConsumer));
        lotteryManager.receiveRandomWords(requestId, randomWords);

        assertEq(gauge.payCount(), 0, "payout should be deferred while paused");

        (address storedUser,,,,,,,,) = lotteryManager.vrfRequests(requestId);
        assertEq(storedUser, buyer, "request should remain until processed");

        vm.prank(owner);
        lotteryManager.unpause();

        (bool ok,) =
            address(lotteryManager).call(abi.encodeWithSignature("processPendingVrfResult(uint256)", requestId));
        assertTrue(ok, "processPendingVrfResult should succeed after unpause");

        assertEq(gauge.payCount(), 1, "payout should occur after unpause processing");
        assertEq(gauge.lastWinner(), buyer, "winner should match buyer");

        (address userAfter,,,,,,,,) = lotteryManager.vrfRequests(requestId);
        assertEq(userAfter, address(0), "request should be cleared after processing");
    }

    function test_VrfCallback_UsesStoredAdditiveProbabilityBoost() public {
        boostManager.setProbabilityBoostBps(1); // +100 PPM

        vm.prank(authorizedSwap);
        uint256 requestId = lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether);
        assertGt(requestId, 0, "expected VRF request");

        (,, uint256 amountUSD, uint256 effectiveWinChancePPM,,,,,) = lotteryManager.vrfRequests(requestId);
        uint256 baseWinChance = lotteryManager.getWinChance(amountUSD);
        assertEq(baseWinChance, 40, "expected $1 trade to use base odds");
        assertEq(effectiveWinChancePPM, 140, "request should include additive probability boost");

        boostManager.setProbabilityBoostBps(0);

        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = 100; // Above base odds (40), below boosted odds (140).

        vm.prank(address(localVrfConsumer));
        lotteryManager.receiveRandomWords(requestId, randomWords);

        assertEq(gauge.payCount(), 1, "additive probability boost should settle as a win");
        assertEq(gauge.lastWinner(), buyer, "winner should match buyer");
    }

    function test_VrfCallback_UsesStoredVoteDirectedGaugeBoost() public {
        uint256 tradeAmount = 5000 ether;
        vaultGaugeVoting.setGaugeBoostPPM(vault, 10_000);

        vm.prank(authorizedSwap);
        uint256 requestId = lotteryManager.processSwapLottery(buyer, shareOFT, tradeAmount);
        assertGt(requestId, 0, "expected VRF request");

        (,, uint256 amountUSD, uint256 effectiveWinChancePPM,,,,,) = lotteryManager.vrfRequests(requestId);
        uint256 baseWinChance = lotteryManager.getWinChance(amountUSD);
        assertGt(effectiveWinChancePPM, baseWinChance + 1, "request should include vote-directed gauge boost");

        vaultGaugeVoting.setGaugeBoostPPM(vault, 0);

        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = baseWinChance + 1; // Loses at base odds, wins with stored gauge boost.

        vm.prank(address(localVrfConsumer));
        lotteryManager.receiveRandomWords(requestId, randomWords);

        assertEq(gauge.payCount(), 1, "vote-directed gauge boost should settle as a win");
        assertEq(gauge.lastWinner(), buyer, "winner should match buyer");
    }

    function test_VrfCallback_AllowsOriginalProviderAfterConsumerRotation() public {
        boostManager.setBoostBps(20_000);

        vm.prank(authorizedSwap);
        uint256 requestId = lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether);
        assertGt(requestId, 0, "expected VRF request");

        MockLocalVrfConsumerPauseGuards replacementConsumer = new MockLocalVrfConsumerPauseGuards();
        vm.prank(owner);
        lotteryManager.setLocalVRFConsumer(address(replacementConsumer));

        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = 60; // Above base odds (40), below boosted odds (80).

        vm.prank(address(replacementConsumer));
        vm.expectRevert(CreatorLotteryManager.InvalidVrfCallback.selector);
        lotteryManager.receiveRandomWords(requestId, randomWords);

        vm.prank(address(localVrfConsumer));
        lotteryManager.receiveRandomWords(requestId, randomWords);

        assertEq(gauge.payCount(), 1, "request-bound provider should still finalize settlement");
        assertEq(gauge.lastWinner(), buyer, "winner should match buyer");
    }

    function test_VrfCallback_UsesStoredRewardSnapshotAfterConfigChange() public {
        boostManager.setBoostBps(20_000);

        vm.prank(authorizedSwap);
        uint256 requestId = lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether);
        assertGt(requestId, 0, "expected VRF request");

        (,,, uint256 effectiveWinChancePPM, uint16 rewardBps,,,,) = lotteryManager.vrfRequests(requestId);
        assertEq(effectiveWinChancePPM, 80, "request should store boosted odds snapshot");
        assertEq(uint256(rewardBps), 6900, "request should snapshot current reward bps");

        (uint256 minSwap, uint256 currentReward, bool isActive, uint256 baseWinChance, uint256 maxWinChance, uint256 usdMultiplierBps)
        = lotteryManager.lotteryConfig();
        assertEq(currentReward, 6900, "default reward bps mismatch");

        vm.prank(owner);
        lotteryManager.setLotteryConfig(minSwap, 0, isActive, baseWinChance, maxWinChance, usdMultiplierBps);

        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = 60; // Above base odds (40), below boosted odds (80).

        vm.prank(address(localVrfConsumer));
        lotteryManager.receiveRandomWords(requestId, randomWords);

        uint256 expectedRewardShares = (gauge.jackpot() * uint256(rewardBps)) / 10_000;
        assertEq(gauge.payCount(), 1, "entry-time reward snapshot should drive payout");
        assertEq(gauge.lastShares(), expectedRewardShares, "payout should use snapshotted reward bps");
    }

    function test_RemoteWin_FinalizesEvenWhenWinnerCallbackSendFails() public {
        boostManager.setBoostBps(20_000);

        Origin memory origin = Origin({srcEid: SRC_EID, sender: SRC_SENDER, nonce: 7});
        bytes memory payload =
            abi.encode(uint16(lotteryManager.MSG_TYPE_LOTTERY_ENTRY()), buyer, shareOFT, 1 ether, SOURCE_CHAIN_ID);

        lotteryManager.exposedLzReceive(origin, payload);

        uint256 requestId = localVrfConsumer.nextRequestId() - 1;
        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = 60; // Above base odds (40), below boosted odds (80).

        vm.prank(address(localVrfConsumer));
        lotteryManager.receiveRandomWords(requestId, randomWords);

        assertEq(gauge.payCount(), 1, "remote entry payout should finalize even if callback send fails");
        assertEq(gauge.lastWinner(), buyer, "winner should match buyer");
    }
}

