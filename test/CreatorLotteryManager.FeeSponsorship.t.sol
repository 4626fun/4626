// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {CreatorLotteryManager} from "../contracts/utilities/lottery/CreatorLotteryManager.sol";
import {MessagingFee, Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {MessagingReceipt} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";

contract MockCreatorOracle {
    int256 public price = 1e18;
    uint256 public updatedAt;

    constructor() {
        updatedAt = block.timestamp;
    }

    function setPrice(int256 nextPrice) external {
        price = nextPrice;
        updatedAt = block.timestamp;
    }

    function getCreatorPrice() external view returns (int256, uint256) {
        return (price, updatedAt);
    }
}

contract MockLotteryRegistry {
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

contract MockVrfIntegratorForLotteryManager {
    uint256 public nativeFee = 0.01 ether;
    uint64 public nextSequence = 1;
    uint256 public requestCount;
    uint256 public lastValue;

    function setNativeFee(uint256 fee) external {
        nativeFee = fee;
    }

    function quoteFee() external view returns (MessagingFee memory fee) {
        fee = MessagingFee({nativeFee: nativeFee, lzTokenFee: 0});
    }

    function requestRandomWordsPayable(uint32)
        external
        payable
        returns (MessagingReceipt memory receipt, uint64 sequence)
    {
        require(msg.value == nativeFee, "fee mismatch");
        requestCount++;
        sequence = nextSequence++;
        lastValue = msg.value;
        receipt = MessagingReceipt({
            guid: bytes32(uint256(sequence)), nonce: sequence, fee: MessagingFee({nativeFee: msg.value, lzTokenFee: 0})
        });
    }
}

contract CreatorLotteryManagerHarness is CreatorLotteryManager {
    constructor(address registry_, address owner_) CreatorLotteryManager(registry_, owner_) {}

    function exposedSendWinnerCallback(uint32 dstEid, address winner, address creatorCoin, uint256 totalSharesPaid)
        external
    {
        _sendWinnerCallback(dstEid, winner, creatorCoin, totalSharesPaid);
    }

    function exposedLzReceive(Origin calldata origin, bytes calldata payload) external {
        _lzReceive(origin, bytes32(0), payload, address(0), payload[:0]);
    }
}

contract CreatorLotteryManagerFeeSponsorshipTest is Test {
    CreatorLotteryManagerHarness internal lotteryManager;
    MockLotteryRegistry internal registry;
    MockCreatorOracle internal oracle;
    MockVrfIntegratorForLotteryManager internal integrator;

    address internal owner = address(0xA11CE);
    address internal authorizedSwap = address(0xBEEF);
    address internal unauthorizedSwap = address(0xBAD);
    address internal buyer = address(0xCAFE);
    address internal creatorCoin = address(0x1001);
    address internal shareOFT = address(0x1002);

    uint32 internal constant TARGET_EID = 30184;
    uint32 internal constant REMOTE_ENTRY_EID = 30110;
    bytes32 internal constant REMOTE_ENTRY_SENDER = bytes32(uint256(0x1234));
    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    uint256 internal constant SWAP_AMOUNT = 1 ether;
    bytes32 internal constant WINNER_CALLBACK_CONTEXT = keccak256("WINNER_CALLBACK");

    function setUp() public {
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(owner));

        oracle = new MockCreatorOracle();
        registry = new MockLotteryRegistry(LZ_ENDPOINT, creatorCoin, shareOFT, address(oracle));
        integrator = new MockVrfIntegratorForLotteryManager();

        vm.prank(owner);
        lotteryManager = new CreatorLotteryManagerHarness(address(registry), owner);

        vm.startPrank(owner);
        lotteryManager.setAuthorizedSwapContract(authorizedSwap, true);
        lotteryManager.setVRFIntegrator(address(integrator));
        lotteryManager.setTargetEid(TARGET_EID);
        lotteryManager.setUseLocalVRF(false);
        // Keep these regression tests focused on sponsorship behavior (not min-swap gating).
        // New deployments default `sponsoredVrfMinSwapAmountUSD` to $10; tests use ~$1 swaps.
        lotteryManager.setSponsoredVrfMinSwapAmountUSD(1_000_000); // $1 (6 decimals)
        lotteryManager.setPeer(TARGET_EID, bytes32(uint256(uint160(address(0x1234)))));
        lotteryManager.setAuthorizedRemoteOFT(REMOTE_ENTRY_EID, REMOTE_ENTRY_SENDER, true);
        vm.stopPrank();

        vm.deal(authorizedSwap, 5 ether);
    }

    function test_SponsoredEntries_RateLimitedPerBuyer() public {
        vm.deal(address(lotteryManager), 1 ether);

        vm.prank(owner);
        lotteryManager.setVrfSponsorshipPolicy(true, 0.02 ether, 1 ether, 1 hours);

        vm.prank(owner);
        (bool ok,) = address(lotteryManager)
            .call(abi.encodeWithSignature("setSponsorshipRateLimits(uint32,uint32,uint32,uint32)", 2, 0, 0, 0));
        assertTrue(ok, "expected sponsorship rate limits setter");

        uint256 id1 = _processSwap(0);
        uint256 id2 = _processSwap(0);
        uint256 id3 = _processSwap(0);

        assertGt(id1, 0, "first entry should succeed");
        assertGt(id2, 0, "second entry should succeed");
        assertEq(id3, 0, "third entry should be buyer-rate-limited");
        assertEq(integrator.requestCount(), 2, "only two VRF requests should be sent");
    }

    function test_CallerFundedEntry_WorksWhenSponsoredRateLimited() public {
        vm.deal(address(lotteryManager), 1 ether);

        vm.prank(owner);
        lotteryManager.setVrfSponsorshipPolicy(true, 0.02 ether, 1 ether, 1 hours);

        vm.prank(owner);
        (bool ok,) = address(lotteryManager)
            .call(abi.encodeWithSignature("setSponsorshipRateLimits(uint32,uint32,uint32,uint32)", 1, 0, 0, 0));
        assertTrue(ok, "expected sponsorship rate limits setter");

        uint256 sponsored = _processSwap(0);
        assertGt(sponsored, 0, "first sponsored entry should succeed");

        uint256 blocked = _processSwap(0);
        assertEq(blocked, 0, "second sponsored entry should be buyer-rate-limited");

        uint256 funded = _processSwap(integrator.nativeFee());
        assertGt(funded, 0, "caller-funded entry should still succeed");
    }

    function test_RemoteSponsoredEntries_RateLimitedPerOrigin() public {
        vm.deal(address(lotteryManager), 1 ether);

        vm.prank(owner);
        lotteryManager.setVrfSponsorshipPolicy(true, 0.02 ether, 1 ether, 1 hours);

        vm.prank(owner);
        (bool ok,) = address(lotteryManager)
            .call(abi.encodeWithSignature("setSponsorshipRateLimits(uint32,uint32,uint32,uint32)", 0, 2, 0, 0));
        assertTrue(ok, "expected sponsorship rate limits setter");

        Origin memory origin = Origin({srcEid: REMOTE_ENTRY_EID, sender: REMOTE_ENTRY_SENDER, nonce: 1});
        bytes memory payload1 = abi.encode(
            uint16(lotteryManager.MSG_TYPE_LOTTERY_ENTRY()), address(0x1111), shareOFT, SWAP_AMOUNT, uint32(42161)
        );
        bytes memory payload2 = abi.encode(
            uint16(lotteryManager.MSG_TYPE_LOTTERY_ENTRY()), address(0x2222), shareOFT, SWAP_AMOUNT, uint32(42161)
        );
        bytes memory payload3 = abi.encode(
            uint16(lotteryManager.MSG_TYPE_LOTTERY_ENTRY()), address(0x3333), shareOFT, SWAP_AMOUNT, uint32(42161)
        );

        lotteryManager.exposedLzReceive(origin, payload1);
        lotteryManager.exposedLzReceive(origin, payload2);
        lotteryManager.exposedLzReceive(origin, payload3);

        assertEq(integrator.requestCount(), 2, "origin cap should limit total sponsored VRF requests");
    }

    function test_RemoteLotteryEntry_V2Payload_IsAccepted() public {
        vm.deal(address(lotteryManager), 1 ether);

        vm.prank(owner);
        lotteryManager.setVrfSponsorshipPolicy(true, 0.02 ether, 1 ether, 1 hours);

        Origin memory origin = Origin({srcEid: REMOTE_ENTRY_EID, sender: REMOTE_ENTRY_SENDER, nonce: 1});
        bytes memory payload = abi.encode(
            uint16(lotteryManager.MSG_TYPE_LOTTERY_ENTRY()),
            address(0x1111),
            shareOFT,
            SWAP_AMOUNT,
            uint32(42161),
            uint256(100 ether)
        );

        lotteryManager.exposedLzReceive(origin, payload);
        assertEq(integrator.requestCount(), 1, "v2 payload should be decoded and processed");
    }

    function test_SponsoredEntries_CappedByBudget() public {
        vm.deal(address(lotteryManager), 1 ether);

        vm.prank(owner);
        lotteryManager.setVrfSponsorshipPolicy(true, 0.02 ether, 0.02 ether, 1 hours);

        uint256 id1 = _processSwap(0);
        uint256 id2 = _processSwap(0);
        uint256 id3 = _processSwap(0);
        uint256 id4 = _processSwap(0);

        assertGt(id1, 0, "first entry should succeed");
        assertGt(id2, 0, "second entry should succeed");
        assertEq(id3, 0, "third entry should be budget-blocked");
        assertEq(id4, 0, "fourth entry should be budget-blocked");
        assertEq(address(lotteryManager).balance, 0.98 ether, "only two sponsored sends should spend native");
    }

    function test_CallerFundedEntry_WorksWhenSponsorshipExhausted() public {
        vm.prank(owner);
        lotteryManager.setVrfSponsorshipPolicy(true, 0.02 ether, 0, 1 hours);

        uint256 blockedId = _processSwap(0);
        assertEq(blockedId, 0, "zero-budget sponsorship should block no-value entries");

        uint256 fundedId = _processSwap(integrator.nativeFee());
        assertGt(fundedId, 0, "caller-funded entry should still succeed");
        assertEq(address(lotteryManager).balance, 0, "caller-funded path should not retain value");
    }

    function test_SponsoredEntry_BelowSponsoredMinSwapIsBlocked() public {
        vm.deal(address(lotteryManager), 1 ether);

        vm.startPrank(owner);
        lotteryManager.setSponsoredVrfMinSwapAmountUSD(10_000_000); // $10
        lotteryManager.setVrfSponsorshipPolicy(true, 0.02 ether, 1 ether, 1 hours);
        vm.stopPrank();

        uint256 id = _processSwap(0);
        assertEq(id, 0, "sponsored entry should fail below min sponsored swap");
    }

    function test_SponsoredEntry_FeeAboveCapIsBlocked() public {
        vm.deal(address(lotteryManager), 1 ether);
        integrator.setNativeFee(0.02 ether);

        vm.prank(owner);
        lotteryManager.setVrfSponsorshipPolicy(true, 0.01 ether, 1 ether, 1 hours);

        uint256 id = _processSwap(0);
        assertEq(id, 0, "sponsored entry should fail when fee exceeds per-send cap");
    }

    function test_WinnerCallbackSkipsWhenBudgetExhausted() public {
        vm.mockCall(
            LZ_ENDPOINT,
            abi.encodeWithSelector(bytes4(keccak256("quote((uint32,bytes32,bytes,bytes,bool),address)"))),
            abi.encode(MessagingFee({nativeFee: 0.01 ether, lzTokenFee: 0}))
        );
        vm.deal(address(lotteryManager), 1 ether);

        vm.prank(owner);
        lotteryManager.setCallbackSponsorshipPolicy(true, 0.02 ether, 0, 1 hours);

        vm.recordLogs();
        lotteryManager.exposedSendWinnerCallback(TARGET_EID, buyer, creatorCoin, 123e18);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        bytes32 callbackSig = keccak256("WinnerCallbackSent(uint32,address,address,uint256)");
        bytes32 skippedSig = keccak256("SponsorshipSkipped(bytes32,uint8,uint256,uint256)");

        bool sawWinnerCallback;
        bool sawBudgetSkip;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == callbackSig) {
                sawWinnerCallback = true;
            }
            if (
                logs[i].topics[0] == skippedSig && logs[i].topics.length > 1
                    && logs[i].topics[1] == WINNER_CALLBACK_CONTEXT
            ) {
                (uint8 reason,,) = abi.decode(logs[i].data, (uint8, uint256, uint256));
                if (reason == uint8(CreatorLotteryManager.SponsorshipSkipReason.BUDGET_EXCEEDED)) {
                    sawBudgetSkip = true;
                }
            }
        }

        assertFalse(sawWinnerCallback, "callback should be skipped when budget is exhausted");
        assertTrue(sawBudgetSkip, "budget-exhausted skip event should be emitted");
    }

    function test_WinnerCallbackSkipsWhenRateLimited() public {
        vm.mockCall(
            LZ_ENDPOINT,
            abi.encodeWithSelector(bytes4(keccak256("quote((uint32,bytes32,bytes,bytes,bool),address)"))),
            abi.encode(MessagingFee({nativeFee: 0.01 ether, lzTokenFee: 0}))
        );
        vm.mockCall(
            LZ_ENDPOINT,
            abi.encodeWithSelector(bytes4(keccak256("send((uint32,bytes32,bytes,bytes,bool),address)"))),
            abi.encode(
                MessagingReceipt({
                        guid: bytes32(uint256(1)), nonce: 1, fee: MessagingFee({nativeFee: 0.01 ether, lzTokenFee: 0})
                    })
            )
        );

        vm.deal(address(lotteryManager), 1 ether);

        vm.startPrank(owner);
        lotteryManager.setCallbackSponsorshipPolicy(true, 0.02 ether, 1 ether, 1 hours);
        lotteryManager.setSponsorshipRateLimits(0, 0, 1, 0);
        vm.stopPrank();

        vm.recordLogs();
        lotteryManager.exposedSendWinnerCallback(TARGET_EID, buyer, creatorCoin, 123e18);
        lotteryManager.exposedSendWinnerCallback(TARGET_EID, buyer, creatorCoin, 123e18);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        bytes32 callbackSig = keccak256("WinnerCallbackSent(uint32,address,address,uint256)");
        bytes32 skippedSig = keccak256("SponsorshipSkipped(bytes32,uint8,uint256,uint256)");

        bool sawWinnerCallback;
        bool sawRateLimitSkip;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == callbackSig) {
                sawWinnerCallback = true;
            }
            if (
                logs[i].topics[0] == skippedSig && logs[i].topics.length > 1
                    && logs[i].topics[1] == WINNER_CALLBACK_CONTEXT
            ) {
                (uint8 reason,,) = abi.decode(logs[i].data, (uint8, uint256, uint256));
                if (reason == 6) {
                    sawRateLimitSkip = true;
                }
            }
        }

        assertTrue(sawWinnerCallback, "first callback should be sent");
        assertTrue(sawRateLimitSkip, "rate-limited skip event should be emitted");
    }

    function test_ProcessSwapLottery_RevertsForUnauthorizedCaller() public {
        vm.prank(unauthorizedSwap);
        vm.expectRevert(CreatorLotteryManager.Unauthorized.selector);
        lotteryManager.processSwapLottery(buyer, shareOFT, SWAP_AMOUNT, 0);
    }

    function _processSwap(uint256 msgValue) internal returns (uint256) {
        vm.prank(authorizedSwap);
        return lotteryManager.processSwapLottery{value: msgValue}(buyer, shareOFT, SWAP_AMOUNT, 0);
    }
}
