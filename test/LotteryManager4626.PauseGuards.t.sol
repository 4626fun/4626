// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {LotteryManager4626} from "@4626/shared/lottery/manager/LotteryManager4626.sol";
import {Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract MockCreatorOraclePauseGuards {
    int256 public price = 1e18;
    uint256 public updatedAt;

    constructor() {
        updatedAt = block.timestamp;
    }

    function getAssetPrice() external view returns (int256, uint256) {
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

    function availableJackpotReserve() external view returns (uint256) {
        return jackpot;
    }

    function payJackpot(address winner, uint256 shares) external {
        require(shares <= jackpot, "InsufficientJackpot");
        jackpot -= shares;
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

contract Mockve4626PauseGuards {
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

    function setve4626(address nextve4626) external {
        ve4626 = nextve4626;
    }

    function setCoverageBps(uint256 nextCoverageBps) external {
        coverageBps = nextCoverageBps;
    }

    function calculateBoost(address) external view returns (uint256) {
        return boostBps;
    }

    /// @dev Curve path: honor forced boostBps when coverage is non-zero.
    function calculateBoostForPosition(address, uint256 shareUSD, uint256 swapUSD, uint256)
        external
        view
        returns (uint256)
    {
        if (shareUSD == 0 || swapUSD == 0) return 10_000;
        if (coverageBps == 0) return 10_000;
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

contract Mockve4626GaugeVotingPauseGuards {
    mapping(address => uint256) public boostPPMByVault;

    function setGaugeBoostPPM(address vault, uint256 nextBoostPPM) external {
        boostPPMByVault[vault] = nextBoostPPM;
    }

    function getVaultProbabilityBoostPPM(address vault) external view returns (uint256) {
        return boostPPMByVault[vault];
    }
}

contract LotteryManager4626PauseHarness is LotteryManager4626 {
    constructor(address registry_, address owner_) LotteryManager4626(registry_, owner_) {}

    function exposedLzReceive(Origin calldata origin, bytes calldata payload) external {
        // Pass an empty `extraData` as calldata (required by the signature).
        _lzReceive(origin, bytes32(0), payload, address(0), payload[:0]);
    }
}

contract LotteryManager4626PauseGuardsTest is Test {
    LotteryManager4626PauseHarness internal lotteryManager;
    MockLotteryRegistryPauseGuards internal registry;
    MockCreatorOraclePauseGuards internal oracle;
    MockGaugeControllerPauseGuards internal gauge;
    MockLocalVrfConsumerPauseGuards internal localVrfConsumer;
    MockBoostManagerPauseGuards internal boostManager;
    Mockve4626GaugeVotingPauseGuards internal ve4626GaugeVoting;
    MockShareTokenPauseGuards internal shareToken;
    Mockve4626PauseGuards internal ve4626;

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
        ve4626GaugeVoting = new Mockve4626GaugeVotingPauseGuards();
        shareToken = new MockShareTokenPauseGuards();
        shareOFT = address(shareToken);
        ve4626 = new Mockve4626PauseGuards();
        boostManager.setve4626(address(ve4626));
        shareToken.mint(buyer, 100 ether);
        ve4626.setLock(buyer, shareOFT, 100 ether, 100 ether);

        registry = new MockLotteryRegistryPauseGuards(
            LZ_ENDPOINT, creatorCoin, shareOFT, address(oracle), vault, address(gauge)
        );

        vm.prank(owner);
        lotteryManager = new LotteryManager4626PauseHarness(address(registry), owner);

        vm.startPrank(owner);
        lotteryManager.setAuthorizedSwapContract(authorizedSwap, true);
        lotteryManager.setLocalVRFConsumer(address(localVrfConsumer));
        lotteryManager.setUseLocalVRF(true);
        lotteryManager.setBoostManager(address(boostManager));
        lotteryManager.setve4626GaugeVoting(address(ve4626GaugeVoting));
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

        uint256 rawVrfId = localVrfConsumer.nextRequestId(); // raw ID before call
        vm.prank(authorizedSwap);
        uint256 requestId = lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether, 100 ether);
        assertGt(requestId, 0, "expected VRF request");

        (,, uint256 amountUSD, uint256 effectiveWinChancePPM,,,) = lotteryManager.vrfRequests(requestId);
        uint256 baseWinChance = lotteryManager.calculateWinChance(amountUSD);
        // PR 1 — linear formula: $1.05 / 250_000 (1e6 units) = 4 PPM. With 2x boost → 8 PPM.
        assertEq(baseWinChance, 4, "expected $1 trade to use base odds (linear)");
        assertEq(effectiveWinChancePPM, 8, "request should store boosted odds snapshot");

        boostManager.setBoostBps(10_000);

        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = 6; // Above base odds (4), below boosted odds (8).

        // CLM-01: receiveRandomWords expects the raw VRF ID; it applies _localVrfKey internally
        vm.prank(address(localVrfConsumer));
        lotteryManager.receiveRandomWords(rawVrfId, randomWords);

        assertEq(gauge.payCount(), 1, "boosted odds should settle as a win");
        assertEq(gauge.lastWinner(), buyer, "winner should match buyer");
    }

    function test_VrfCallback_DefersWhilePaused_AndUsesStoredBoostedOddsAfterUnpause() public {
        boostManager.setBoostBps(20_000);

        uint256 rawVrfId = localVrfConsumer.nextRequestId(); // raw ID before call
        vm.prank(authorizedSwap);
        uint256 requestId = lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether, 100 ether);
        assertGt(requestId, 0, "expected VRF request");

        (,, uint256 amountUSD, uint256 effectiveWinChancePPM,,,) = lotteryManager.vrfRequests(requestId);
        uint256 baseWinChance = lotteryManager.calculateWinChance(amountUSD);
        // PR 1 — linear formula: $1.05 / 250_000 = 4 PPM. With 2x boost → 8 PPM.
        assertEq(baseWinChance, 4, "expected $1 trade to use base odds (linear)");
        assertEq(effectiveWinChancePPM, 8, "request should store boosted odds snapshot");

        boostManager.setBoostBps(10_000);

        vm.prank(owner);
        lotteryManager.pause();

        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = 6; // Above base odds (4), below boosted odds (8).

        // CLM-01: receiveRandomWords expects the raw VRF ID; it applies _localVrfKey internally
        vm.prank(address(localVrfConsumer));
        lotteryManager.receiveRandomWords(rawVrfId, randomWords);

        assertEq(gauge.payCount(), 0, "payout should be deferred while paused");

        (address storedUser,,,,,,) = lotteryManager.vrfRequests(requestId);
        assertEq(storedUser, buyer, "request should remain until processed");

        vm.prank(owner);
        lotteryManager.unpause();

        assertEq(gauge.payCount(), 0, "unpause should not auto-settle deferred VRF FIFO");

        vm.prank(buyer);
        lotteryManager.applyDeferredVrf(requestId);

        assertEq(gauge.payCount(), 1, "apply should settle deferred request");
        assertEq(gauge.lastWinner(), buyer, "winner should match buyer");

        (address userAfter,,,,,,) = lotteryManager.vrfRequests(requestId);
        assertEq(userAfter, address(0), "request should be cleared after processing");

        vm.prank(owner);
        lotteryManager.applyDeferredVrf(requestId);
        assertEq(gauge.payCount(), 1, "second apply should no-op when pending word cleared");
    }

    function test_VrfCallback_DefersMultipleWhilePaused_AndFlushSettlesInPages() public {
        address buyer2 = makeAddr("buyer2");
        shareToken.mint(buyer2, 100 ether);
        ve4626.setLock(buyer2, shareOFT, 100 ether, 100 ether);

        uint256 rawVrfId1 = localVrfConsumer.nextRequestId();
        vm.prank(authorizedSwap);
        uint256 requestId1 = lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether, 100 ether);

        uint256 rawVrfId2 = localVrfConsumer.nextRequestId();
        vm.prank(authorizedSwap);
        uint256 requestId2 = lotteryManager.processSwapLottery(buyer2, shareOFT, 1 ether, 100 ether);

        vm.prank(owner);
        lotteryManager.pause();

        uint256[] memory randomWords1 = new uint256[](1);
        randomWords1[0] = 0;
        vm.prank(address(localVrfConsumer));
        lotteryManager.receiveRandomWords(rawVrfId1, randomWords1);

        uint256[] memory randomWords2 = new uint256[](1);
        randomWords2[0] = 0;
        vm.prank(address(localVrfConsumer));
        lotteryManager.receiveRandomWords(rawVrfId2, randomWords2);

        assertEq(gauge.payCount(), 0, "both payouts should remain deferred while paused");

        vm.prank(owner);
        lotteryManager.unpause();

        assertEq(gauge.payCount(), 0, "unpause should not settle deferred requests");

        // Out-of-order apply must fail (H-02 / M2-07 — no cherry-pick).
        vm.prank(owner);
        vm.expectRevert();
        lotteryManager.applyDeferredVrf(requestId2);

        vm.prank(owner);
        lotteryManager.applyDeferredVrf(requestId1);
        assertEq(gauge.payCount(), 1, "first apply should settle first request");

        vm.prank(owner);
        lotteryManager.applyDeferredVrf(requestId2);
        assertEq(gauge.payCount(), 2, "second apply should settle second request");
        assertEq(gauge.lastWinner(), buyer2, "second deferred request should settle last in FIFO order");

        (address userAfter1,,,,,,) = lotteryManager.vrfRequests(requestId1);
        (address userAfter2,,,,,,) = lotteryManager.vrfRequests(requestId2);
        assertEq(userAfter1, address(0));
        assertEq(userAfter2, address(0));
    }

    function test_processDeferredVrfBatch_settlesFifoHeadFirst() public {
        address buyer2 = makeAddr("buyer2batch");
        shareToken.mint(buyer2, 100 ether);
        ve4626.setLock(buyer2, shareOFT, 100 ether, 100 ether);

        uint256 rawVrfId1 = localVrfConsumer.nextRequestId();
        vm.prank(authorizedSwap);
        uint256 requestId1 = lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether, 100 ether);

        uint256 rawVrfId2 = localVrfConsumer.nextRequestId();
        vm.prank(authorizedSwap);
        uint256 requestId2 = lotteryManager.processSwapLottery(buyer2, shareOFT, 1 ether, 100 ether);

        vm.prank(owner);
        lotteryManager.pause();

        uint256[] memory words1 = new uint256[](1);
        words1[0] = 0;
        vm.prank(address(localVrfConsumer));
        lotteryManager.receiveRandomWords(rawVrfId1, words1);

        uint256[] memory words2 = new uint256[](1);
        words2[0] = 0;
        vm.prank(address(localVrfConsumer));
        lotteryManager.receiveRandomWords(rawVrfId2, words2);

        assertEq(lotteryManager.deferredVrfQueueLength(), 2, "both deferred on queue");
        assertEq(lotteryManager.deferredVrfQueueHead(), requestId1, "FIFO head is first request");

        vm.prank(owner);
        lotteryManager.unpause();

        vm.prank(buyer);
        uint256 processed = lotteryManager.processDeferredVrfBatch(16);
        assertEq(processed, 2, "batch settles entire small queue");
        assertEq(gauge.payCount(), 2, "both wins settled");
        assertEq(lotteryManager.deferredVrfQueueLength(), 0, "queue drained");
        assertEq(gauge.lastWinner(), buyer2, "FIFO order preserved (second last)");
        requestId2; // silence unused if compiler complains
    }

    function test_DeferredVrf_RemainsValidAcrossLongPause() public {
        uint256 rawVrfId = localVrfConsumer.nextRequestId();
        vm.prank(authorizedSwap);
        uint256 requestId = lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether, 100 ether);
        assertGt(requestId, 0, "expected VRF request");

        vm.prank(owner);
        lotteryManager.pause();

        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = 0;
        vm.prank(address(localVrfConsumer));
        lotteryManager.receiveRandomWords(rawVrfId, randomWords);

        // Longer than the default 30 minute grace, but entirely paused time.
        vm.warp(block.timestamp + 31 minutes);

        vm.prank(owner);
        lotteryManager.unpause();

        vm.prank(owner);
        lotteryManager.applyDeferredVrf(requestId);

        assertEq(gauge.payCount(), 1, "paused time must not age deferred VRF beyond grace");
    }

    /// ODA-426-F6: admin flush must settle while still paused (no FIFO re-enqueue / reorder).
    function test_applyDeferredVrf_settlesWhileStillPaused() public {
        address buyer2 = makeAddr("buyer2pausedSettle");
        shareToken.mint(buyer2, 100 ether);
        ve4626.setLock(buyer2, shareOFT, 100 ether, 100 ether);

        uint256 rawVrfId1 = localVrfConsumer.nextRequestId();
        vm.prank(authorizedSwap);
        uint256 requestId1 = lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether, 100 ether);

        uint256 rawVrfId2 = localVrfConsumer.nextRequestId();
        vm.prank(authorizedSwap);
        uint256 requestId2 = lotteryManager.processSwapLottery(buyer2, shareOFT, 1 ether, 100 ether);

        vm.prank(owner);
        lotteryManager.pause();

        uint256[] memory words1 = new uint256[](1);
        words1[0] = 0;
        vm.prank(address(localVrfConsumer));
        lotteryManager.receiveRandomWords(rawVrfId1, words1);

        uint256[] memory words2 = new uint256[](1);
        words2[0] = 0;
        vm.prank(address(localVrfConsumer));
        lotteryManager.receiveRandomWords(rawVrfId2, words2);

        assertEq(lotteryManager.deferredVrfQueueLength(), 2);

        // Permissionless callers cannot bypass the emergency payout pause.
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, buyer));
        lotteryManager.applyDeferredVrf(requestId1);

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, buyer));
        lotteryManager.processDeferredVrfBatch(8);

        // Owner may still settle the head while paused without rotating to tail.
        vm.prank(owner);
        lotteryManager.applyDeferredVrf(requestId1);
        assertEq(gauge.payCount(), 1, "head settles while paused");
        assertEq(lotteryManager.deferredVrfQueueLength(), 1, "head removed, not re-enqueued");
        assertEq(lotteryManager.deferredVrfQueueHead(), requestId2, "FIFO order preserved");

        vm.prank(owner);
        lotteryManager.processDeferredVrfBatch(8);
        assertEq(gauge.payCount(), 2, "batch flush also settles while paused");
        assertEq(lotteryManager.deferredVrfQueueLength(), 0);
    }

    function test_VrfCallback_DiscardsTrulyStaleResultWhenActive() public {
        uint256 rawVrfId = localVrfConsumer.nextRequestId();
        vm.prank(authorizedSwap);
        uint256 requestId = lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether, 100 ether);
        assertGt(requestId, 0, "expected VRF request");

        // ODA-496-4: default grace period is 1 hour (aligned with spoke requestTimeout).
        vm.warp(block.timestamp + 1 hours + 1);

        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = 0;
        vm.prank(address(localVrfConsumer));
        lotteryManager.receiveRandomWords(rawVrfId, randomWords);

        assertEq(gauge.payCount(), 0, "stale active-time VRF result must be discarded");
        (address userAfter,,,,,,) = lotteryManager.vrfRequests(requestId);
        assertEq(userAfter, address(0), "stale request should be cleared");
    }

    function test_VrfCallback_SingleEnvelope_IgnoresAdditiveProbabilityBoost() public {
        // Design §7: lock-duration additive PPM removed. Even if boost manager returns
        // non-zero getTotalProbabilityBoost, lottery must not add it.
        boostManager.setProbabilityBoostBps(1); // would have been +100 PPM under old path
        boostManager.setBoostBps(10_000); // 1.0x mult only
        boostManager.setCoverageBps(10_000);

        uint256 rawVrfId = localVrfConsumer.nextRequestId();
        vm.prank(authorizedSwap);
        uint256 requestId = lotteryManager.processSwapLottery(buyer, shareOFT, 1 ether, 100 ether);
        assertGt(requestId, 0, "expected VRF request");

        (,, uint256 amountUSD, uint256 effectiveWinChancePPM,,,) = lotteryManager.vrfRequests(requestId);
        uint256 baseWinChance = lotteryManager.calculateWinChance(amountUSD);
        assertEq(baseWinChance, 4, "expected $1 trade to use base odds (linear)");
        // Single envelope: no additive stack → odds stay at base when mult is 1.0x
        assertEq(effectiveWinChancePPM, baseWinChance, "must ignore getTotalProbabilityBoost additive");

        boostManager.setProbabilityBoostBps(0);

        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = 0; // win at base odds

        vm.prank(address(localVrfConsumer));
        lotteryManager.receiveRandomWords(rawVrfId, randomWords);

        assertEq(gauge.payCount(), 1, "base-odds win should still settle");
        assertEq(gauge.lastWinner(), buyer, "winner should match buyer");
    }

    function test_VrfCallback_UsesStoredVoteDirectedGaugeBoost() public {
        uint256 tradeAmount = 2 ether;
        ve4626GaugeVoting.setGaugeBoostPPM(vault, 10_000);

        uint256 rawVrfId = localVrfConsumer.nextRequestId(); // raw ID before call
        vm.prank(authorizedSwap);
        uint256 requestId = lotteryManager.processSwapLottery(buyer, shareOFT, tradeAmount, 100 ether);
        assertGt(requestId, 0, "expected VRF request");

        (,, uint256 amountUSD, uint256 effectiveWinChancePPM,,,) = lotteryManager.vrfRequests(requestId);
        uint256 baseWinChance = lotteryManager.calculateWinChance(amountUSD);
        uint256 expectedGaugeBoost = (10_000 * (amountUSD - 1_000_000)) / 9_999_000_000;
        assertGt(expectedGaugeBoost, 0, "expected scaled gauge boost");
        assertEq(
            effectiveWinChancePPM,
            baseWinChance + expectedGaugeBoost,
            "request should include stored scaled gauge boost"
        );

        ve4626GaugeVoting.setGaugeBoostPPM(vault, 0);

        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = baseWinChance; // Loses at base odds, wins with stored gauge boost.

        // CLM-01: receiveRandomWords expects the raw VRF ID; it applies _localVrfKey internally
        vm.prank(address(localVrfConsumer));
        lotteryManager.receiveRandomWords(rawVrfId, randomWords);

        assertEq(gauge.payCount(), 1, "vote-directed gauge boost should settle as a win");
        assertEq(gauge.lastWinner(), buyer, "winner should match buyer");
    }

    function test_SetLotteryConfig_Allows200kCapAndRejectsAbove() public {
        vm.prank(owner);
        lotteryManager.setLotteryConfig(1_000_000, 6900, true, 40, 150_000, 10_000);

        (,,,, uint256 maxWinChance,) = lotteryManager.lotteryConfig();
        assertEq(maxWinChance, 150_000, "expected max win chance updated to policy cap");

        vm.prank(owner);
        vm.expectRevert(LotteryManager4626.InvalidAmount.selector);
        lotteryManager.setLotteryConfig(1_000_000, 6900, true, 40, 150_001, 10_000);
    }

}

