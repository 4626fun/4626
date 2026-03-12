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

contract MockShareTokenPauseGuards {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }
}

contract MockVe4626PauseGuards {
    struct Lock {
        uint256 amount;
        uint256 end;
        uint256 start;
        address lockedToken;
        uint256 underlyingValue;
    }

    mapping(address => Lock) internal _locks;

    function setLock(address user, address lockedToken, uint256 amount, uint256 underlyingValue) external {
        _locks[user] = Lock({
            amount: amount,
            end: block.timestamp + 365 days,
            start: block.timestamp,
            lockedToken: lockedToken,
            underlyingValue: underlyingValue
        });
    }

    function getLock(address user) external view returns (Lock memory) {
        return _locks[user];
    }
}

contract MockBoostManagerPauseGuards {
    uint256 public boostBps = 10_000;
    uint256 public probabilityBoostBps;
    uint256 public coverageBps = 10_000;
    address public ve4626;

    function setBoostBps(uint256 nextBoostBps) external {
        boostBps = nextBoostBps;
    }

    function setProbabilityBoostBps(uint256 nextProbabilityBoostBps) external {
        probabilityBoostBps = nextProbabilityBoostBps;
    }

    function setVe4626(address nextVe4626) external {
        ve4626 = nextVe4626;
    }

    function setCoverageBps(uint256 nextCoverageBps) external {
        coverageBps = nextCoverageBps;
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

    function getCoverageBps(address, address, address, address, uint256, uint256) external view returns (uint256) {
        return coverageBps;
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
    MockShareTokenPauseGuards internal shareToken;
    MockVe4626PauseGuards internal ve4626;

    address internal owner = address(0xA11CE);
    address internal authorizedSwap = address(0xBEEF);
    address internal buyer = address(0xCAFE);

    address internal creatorCoin = address(0x1001);
    address internal shareOFT;
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
        shareToken = new MockShareTokenPauseGuards();
        shareOFT = address(shareToken);
        ve4626 = new MockVe4626PauseGuards();
        boostManager.setVe4626(address(ve4626));
        shareToken.mint(buyer, 100 ether);
        ve4626.setLock(buyer, shareOFT, 100 ether, 100 ether);

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
        uint256 requestId = lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether, 100 ether);
        assertGt(requestId, 0, "expected VRF request");

        (,, uint256 amountUSD, uint256 effectiveWinChancePPM,,) = lotteryManager.vrfRequests(requestId);
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
        uint256 requestId = lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether, 100 ether);
        assertGt(requestId, 0, "expected VRF request");

        (,, uint256 amountUSD, uint256 effectiveWinChancePPM,,) = lotteryManager.vrfRequests(requestId);
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

        (address storedUser,,,,,) = lotteryManager.vrfRequests(requestId);
        assertEq(storedUser, buyer, "request should remain until processed");

        vm.prank(owner);
        lotteryManager.unpause();

        (bool ok,) =
            address(lotteryManager).call(abi.encodeWithSignature("processPendingVrfResult(uint256)", requestId));
        assertTrue(ok, "processPendingVrfResult should succeed after unpause");

        assertEq(gauge.payCount(), 1, "payout should occur after unpause processing");
        assertEq(gauge.lastWinner(), buyer, "winner should match buyer");

        (address userAfter,,,,,) = lotteryManager.vrfRequests(requestId);
        assertEq(userAfter, address(0), "request should be cleared after processing");
    }

    function test_VrfCallback_UsesStoredAdditiveProbabilityBoost() public {
        boostManager.setProbabilityBoostBps(1); // +100 PPM

        vm.prank(authorizedSwap);
        uint256 requestId = lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether, 100 ether);
        assertGt(requestId, 0, "expected VRF request");

        (,, uint256 amountUSD, uint256 effectiveWinChancePPM,,) = lotteryManager.vrfRequests(requestId);
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
        uint256 tradeAmount = 1 ether;
        vaultGaugeVoting.setGaugeBoostPPM(vault, 10_000);

        vm.prank(authorizedSwap);
        uint256 requestId = lotteryManager.processSwapLottery(buyer, shareOFT, tradeAmount, 100 ether);
        assertGt(requestId, 0, "expected VRF request");

        (,, uint256 amountUSD, uint256 effectiveWinChancePPM,,) = lotteryManager.vrfRequests(requestId);
        uint256 baseWinChance = lotteryManager.getWinChance(amountUSD);
        assertEq(effectiveWinChancePPM, baseWinChance + 10_000, "request should include full flat gauge boost");

        vaultGaugeVoting.setGaugeBoostPPM(vault, 0);

        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = baseWinChance + 1; // Loses at base odds, wins with stored gauge boost.

        vm.prank(address(localVrfConsumer));
        lotteryManager.receiveRandomWords(requestId, randomWords);

        assertEq(gauge.payCount(), 1, "vote-directed gauge boost should settle as a win");
        assertEq(gauge.lastWinner(), buyer, "winner should match buyer");
    }

    function test_SetLotteryConfig_Allows200kCapAndRejectsAbove() public {
        vm.prank(owner);
        lotteryManager.setLotteryConfig(1_000_000, 6900, true, 40, 200_000, 10_500);

        (,,,, uint256 maxWinChance,) = lotteryManager.lotteryConfig();
        assertEq(maxWinChance, 200_000, "expected max win chance updated to new cap");

        vm.prank(owner);
        vm.expectRevert(CreatorLotteryManager.InvalidAmount.selector);
        lotteryManager.setLotteryConfig(1_000_000, 6900, true, 40, 200_001, 10_500);
    }

}

