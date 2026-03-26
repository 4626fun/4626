// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {
    ILayerZeroEndpointV2,
    MessagingFee,
    MessagingReceipt
} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../contracts/utilities/messaging/CreatorShareOFT.sol";

contract MockRemoteRegistry {
    address public lotteryManager;

    constructor(address _lotteryManager) {
        lotteryManager = _lotteryManager;
    }

    function getLotteryManager(uint256) external view returns (address) {
        return lotteryManager;
    }

    function getLayerZeroEndpoint(uint256) external pure returns (address) {
        return address(0x1a44076050125825900e736c501f859c50fE728c);
    }

    function getEidForChainId(uint256) external pure returns (uint32) {
        return 30184;
    }
}

contract MockRemoteLotteryManager {
    uint256 public calls;
    address public lastBuyer;
    address public lastTokenIn;
    uint256 public lastAmountIn;

    function processSwapLottery(address buyer, address tokenIn, uint256 amountIn) external payable returns (uint256) {
        calls++;
        lastBuyer = buyer;
        lastTokenIn = tokenIn;
        lastAmountIn = amountIn;
        return calls;
    }

    function processSwapLottery(address buyer, address tokenIn, uint256 amountIn, uint256)
        external
        payable
        returns (uint256)
    {
        calls++;
        lastBuyer = buyer;
        lastTokenIn = tokenIn;
        lastAmountIn = amountIn;
        return calls;
    }
}

contract MockRemoteGaugeController {
    function receiveFees(uint256) external {}
}

contract MockRemoteDexRouter {
    function swap(address token, address recipient, uint256 amount) external {
        IERC20(token).transfer(recipient, amount);
    }
}

interface ICreatorShareOFTRemoteLottery {
    function nextPendingLotteryEntryId() external view returns (uint256);
    function pendingLotteryEntries(uint256 entryId) external view returns (address buyer, uint256 amount);
    function pendingLotteryEntryCount(address buyer) external view returns (uint256);
    function quotePendingLotteryEntry(uint256 entryId) external view returns (MessagingFee memory);
    function submitPendingLotteryEntry(uint256 entryId) external payable;
}

contract CreatorShareOFTRemoteLotteryFundingTest is Test {
    CreatorShareOFT public shareOFT;
    MockRemoteRegistry public registry;
    MockRemoteLotteryManager public lotteryManager;
    MockRemoteGaugeController public gaugeController;
    MockRemoteDexRouter public dexRouter;

    address public owner = address(0x1);
    address public buyer = address(0x2);
    address public attacker = address(0x3);

    address constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    uint32 constant HUB_EID = 30184;
    bytes32 constant HUB_PEER = bytes32(uint256(uint160(address(0xBEEF))));

    uint256 constant SWAP_AMOUNT = 100 ether;
    uint256 constant QUOTED_NATIVE_FEE = 0.01 ether;

    function setUp() public {
        lotteryManager = new MockRemoteLotteryManager();
        registry = new MockRemoteRegistry(address(lotteryManager));
        gaugeController = new MockRemoteGaugeController();

        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(owner));

        vm.prank(owner);
        shareOFT = new CreatorShareOFT("Test Share", "sTEST", address(registry), owner);

        dexRouter = new MockRemoteDexRouter();

        vm.startPrank(owner);
        shareOFT.setRegistry(address(registry));
        shareOFT.setHubConfig(false, HUB_EID, address(gaugeController));
        shareOFT.setHubLotteryPeer(HUB_EID, HUB_PEER);
        shareOFT.setPeer(HUB_EID, HUB_PEER);
        shareOFT.setFeesEnabled(true);
        shareOFT.setLotteryEnabled(true);
        shareOFT.setAddressType(address(dexRouter), CreatorShareOFT.OperationType.SwapOnly);
        shareOFT.setMinter(owner, true);
        vm.stopPrank();

        vm.prank(owner);
        shareOFT.mint(address(dexRouter), 1_000_000 ether);
    }

    function _queueEntry() internal returns (uint256 entryId, uint256 expectedPostFeeAmount) {
        uint256 idBefore = ICreatorShareOFTRemoteLottery(address(shareOFT)).nextPendingLotteryEntryId();
        uint256 basisPoints = shareOFT.BASIS_POINTS();
        expectedPostFeeAmount = (SWAP_AMOUNT * (basisPoints - shareOFT.buyFeeBps())) / basisPoints;

        vm.prank(address(dexRouter));
        shareOFT.transfer(buyer, SWAP_AMOUNT);

        entryId = idBefore;
    }

    function _mockLzFeeAndSend(uint256 nativeFee) internal {
        vm.mockCall(
            LZ_ENDPOINT,
            abi.encodeWithSelector(ILayerZeroEndpointV2.quote.selector),
            abi.encode(MessagingFee({nativeFee: nativeFee, lzTokenFee: 0}))
        );

        vm.mockCall(
            LZ_ENDPOINT,
            abi.encodeWithSelector(ILayerZeroEndpointV2.send.selector),
            abi.encode(
                MessagingReceipt({
                    guid: bytes32(uint256(1)), nonce: 1, fee: MessagingFee({nativeFee: nativeFee, lzTokenFee: 0})
                })
            )
        );
    }

    function test_RemoteBuy_QueuesEntry_AndDoesNotSponsorFromContractBalance() public {
        vm.deal(address(shareOFT), 5 ether);
        uint256 balanceBefore = address(shareOFT).balance;

        (uint256 entryId, uint256 expectedPostFeeAmount) = _queueEntry();

        (address entryBuyer, uint256 entryAmount) =
            ICreatorShareOFTRemoteLottery(address(shareOFT)).pendingLotteryEntries(entryId);

        assertEq(entryBuyer, buyer, "queued entry buyer");
        assertEq(entryAmount, expectedPostFeeAmount, "queued entry amount");
        assertEq(address(shareOFT).balance, balanceBefore, "buy should not spend contract native balance");
        assertEq(shareOFT.totalLotteryEntriesSent(), 0, "no remote message sent during buy");
        assertEq(ICreatorShareOFTRemoteLottery(address(shareOFT)).pendingLotteryEntryCount(buyer), 1, "pending count");
    }

    function test_SubmitPendingLotteryEntry_RevertsOnWrongNativeFee() public {
        vm.deal(buyer, 1 ether);
        (uint256 entryId,) = _queueEntry();
        _mockLzFeeAndSend(QUOTED_NATIVE_FEE);

        bytes4 invalidFeeSelector = bytes4(keccak256("InvalidLotteryEntryFee(uint256,uint256)"));
        vm.expectRevert(abi.encodeWithSelector(invalidFeeSelector, QUOTED_NATIVE_FEE - 1, QUOTED_NATIVE_FEE));
        vm.prank(buyer);
        ICreatorShareOFTRemoteLottery(address(shareOFT)).submitPendingLotteryEntry{value: QUOTED_NATIVE_FEE - 1}(
            entryId
        );

        vm.expectRevert(abi.encodeWithSelector(invalidFeeSelector, QUOTED_NATIVE_FEE + 1, QUOTED_NATIVE_FEE));
        vm.prank(buyer);
        ICreatorShareOFTRemoteLottery(address(shareOFT)).submitPendingLotteryEntry{value: QUOTED_NATIVE_FEE + 1}(
            entryId
        );
    }

    function test_SubmitPendingLotteryEntry_ExactFee_SucceedsAndConsumesEntry() public {
        vm.deal(buyer, 1 ether);
        (uint256 entryId,) = _queueEntry();
        _mockLzFeeAndSend(QUOTED_NATIVE_FEE);

        MessagingFee memory quoted = ICreatorShareOFTRemoteLottery(address(shareOFT)).quotePendingLotteryEntry(entryId);
        assertEq(quoted.nativeFee, QUOTED_NATIVE_FEE, "quoted fee");

        uint256 buyerBalanceBefore = buyer.balance;
        vm.expectCall(LZ_ENDPOINT, QUOTED_NATIVE_FEE, abi.encodeWithSelector(ILayerZeroEndpointV2.send.selector));

        vm.prank(buyer);
        ICreatorShareOFTRemoteLottery(address(shareOFT)).submitPendingLotteryEntry{value: QUOTED_NATIVE_FEE}(entryId);

        (address entryBuyer, uint256 entryAmount) =
            ICreatorShareOFTRemoteLottery(address(shareOFT)).pendingLotteryEntries(entryId);
        assertEq(entryBuyer, address(0), "entry consumed");
        assertEq(entryAmount, 0, "entry amount cleared");
        assertEq(
            ICreatorShareOFTRemoteLottery(address(shareOFT)).pendingLotteryEntryCount(buyer), 0, "pending count cleared"
        );
        assertEq(shareOFT.totalLotteryEntriesSent(), 1, "message sent");
        assertEq(buyerBalanceBefore - buyer.balance, QUOTED_NATIVE_FEE, "buyer should fund native fee");
    }

    function test_SubmitPendingLotteryEntry_RevertsForNonOwner() public {
        vm.deal(attacker, 1 ether);
        (uint256 entryId,) = _queueEntry();
        _mockLzFeeAndSend(QUOTED_NATIVE_FEE);

        bytes4 notOwnerSelector = bytes4(keccak256("NotPendingLotteryEntryOwner()"));
        vm.expectRevert(notOwnerSelector);
        vm.prank(attacker);
        ICreatorShareOFTRemoteLottery(address(shareOFT)).submitPendingLotteryEntry{value: QUOTED_NATIVE_FEE}(entryId);
    }

    function test_SubmitPendingLotteryEntry_ReplayPreventedAfterConsumption() public {
        vm.deal(buyer, 1 ether);
        (uint256 entryId,) = _queueEntry();
        _mockLzFeeAndSend(QUOTED_NATIVE_FEE);

        vm.prank(buyer);
        ICreatorShareOFTRemoteLottery(address(shareOFT)).submitPendingLotteryEntry{value: QUOTED_NATIVE_FEE}(entryId);

        bytes4 missingSelector = bytes4(keccak256("PendingLotteryEntryNotFound()"));
        vm.expectRevert(missingSelector);
        vm.prank(buyer);
        ICreatorShareOFTRemoteLottery(address(shareOFT)).submitPendingLotteryEntry{value: QUOTED_NATIVE_FEE}(entryId);
    }

    function test_HubMode_StillUsesLocalLotteryManager() public {
        vm.startPrank(owner);
        shareOFT.setHubConfig(true, 0, address(0));
        shareOFT.setLotteryEnabled(true);
        vm.stopPrank();

        vm.prank(address(dexRouter));
        shareOFT.transfer(buyer, SWAP_AMOUNT);

        assertEq(lotteryManager.calls(), 1, "hub path should call local manager");
        assertEq(lotteryManager.lastBuyer(), buyer, "hub buyer attribution");
        assertEq(lotteryManager.lastTokenIn(), address(shareOFT), "hub token attribution");
    }
}
