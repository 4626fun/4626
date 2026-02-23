// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {CreatorLotteryManager} from "../../contracts/services/lottery/CreatorLotteryManager.sol";
import {MessagingFee} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {MessagingReceipt} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";

contract MockCreatorOracle {
    int256 public price = 1e18;
    uint256 public updatedAt;

    constructor() {
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

contract MockVrfIntegrator {
    uint256 public nativeFee = 0.01 ether;
    uint64 public nextSequence = 1;
    uint256 public requestCount;
    uint256 public lastValue;

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
        lastValue = msg.value;
        sequence = nextSequence++;
        receipt = MessagingReceipt({
            guid: bytes32(uint256(sequence)),
            nonce: sequence,
            fee: MessagingFee({nativeFee: msg.value, lzTokenFee: 0})
        });
    }
}

contract RevertingVrfIntegrator {
    uint256 public nativeFee = 0.01 ether;

    function quoteFee() external view returns (MessagingFee memory fee) {
        fee = MessagingFee({nativeFee: nativeFee, lzTokenFee: 0});
    }

    function requestRandomWordsPayable(uint32)
        external
        payable
        returns (MessagingReceipt memory, uint64)
    {
        revert("send failed");
    }
}

contract MockLocalVrfConsumer {
    uint256 public nextRequestId = 1;

    function requestRandomWords() external returns (uint256 requestId) {
        requestId = nextRequestId++;
    }
}

contract CreatorLotteryManagerVrfSponsorshipHardeningTest is Test {
    CreatorLotteryManager internal lotteryManager;
    MockLotteryRegistry internal registry;
    MockCreatorOracle internal oracle;
    MockVrfIntegrator internal integrator;
    MockLocalVrfConsumer internal localConsumer;

    address internal owner = address(0xA11CE);
    address internal authorizedSwap = address(0xBEEF);
    address internal buyer = address(0xCAFE);
    address internal creatorCoin = address(0x1001);
    address internal shareOFT = address(0x1002);

    uint32 internal constant TARGET_EID = 30184;
    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    uint256 internal constant SWAP_AMOUNT = 1 ether;

    function setUp() public {
        // OApp constructor expects a LayerZero endpoint with setDelegate/delegate.
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(owner));

        oracle = new MockCreatorOracle();
        registry = new MockLotteryRegistry(LZ_ENDPOINT, creatorCoin, shareOFT, address(oracle));
        integrator = new MockVrfIntegrator();
        localConsumer = new MockLocalVrfConsumer();

        vm.prank(owner);
        lotteryManager = new CreatorLotteryManager(address(registry), owner);

        vm.startPrank(owner);
        lotteryManager.setAuthorizedSwapContract(authorizedSwap, true);
        vm.stopPrank();

        vm.deal(authorizedSwap, 10 ether);
    }

    function test_constructorDefaults_failClosedSponsorship() public view {
        (bool vrfEnabled,,,,,) = lotteryManager.vrfSponsorshipPolicy();
        (bool callbackEnabled,,,,,) = lotteryManager.callbackSponsorshipPolicy();

        assertFalse(vrfEnabled, "vrf sponsorship should be disabled by default");
        assertFalse(callbackEnabled, "callback sponsorship should be disabled by default");

        assertEq(lotteryManager.sponsoredVrfMinSwapAmountUSD(), 10_000_000, "default sponsored min swap should be $10");

        assertEq(lotteryManager.vrfMaxSponsoredPerBuyerPerEpoch(), 2, "default VRF buyer cap");
        assertEq(lotteryManager.vrfMaxSponsoredPerOriginPerEpoch(), 10, "default VRF origin cap");
        assertEq(lotteryManager.callbackMaxSponsoredPerBuyerPerEpoch(), 1, "default callback buyer cap");
        assertEq(lotteryManager.callbackMaxSponsoredPerOriginPerEpoch(), 10, "default callback origin cap");
    }

    function test_processSwapLottery_revertsWhenMsgValueProvidedInLocalVrfMode() public {
        vm.startPrank(owner);
        lotteryManager.setLocalVRFConsumer(address(localConsumer));
        lotteryManager.setUseLocalVRF(true);
        vm.stopPrank();

        vm.prank(authorizedSwap);
        vm.expectRevert(CreatorLotteryManager.InvalidAmount.selector);
        lotteryManager.processSwapLottery{value: 1}(buyer, shareOFT, SWAP_AMOUNT);
    }

    function test_processSwapLottery_revertsWhenCallerFeeNotExact() public {
        _configureCrossChain(address(integrator));
        uint256 nativeFee = integrator.nativeFee();

        bytes4 mismatchSelector = bytes4(keccak256("CallerFeeMismatch(uint256,uint256)"));

        vm.startPrank(authorizedSwap);
        vm.expectRevert(abi.encodeWithSelector(mismatchSelector, nativeFee - 1, nativeFee));
        lotteryManager.processSwapLottery{value: nativeFee - 1}(buyer, shareOFT, SWAP_AMOUNT);

        vm.expectRevert(abi.encodeWithSelector(mismatchSelector, nativeFee + 1, nativeFee));
        lotteryManager.processSwapLottery{value: nativeFee + 1}(buyer, shareOFT, SWAP_AMOUNT);
        vm.stopPrank();
    }

    function test_processSwapLottery_refundsCallerFeeOnSendFailure() public {
        RevertingVrfIntegrator badIntegrator = new RevertingVrfIntegrator();
        _configureCrossChain(address(badIntegrator));

        uint256 nativeFee = badIntegrator.nativeFee();
        assertEq(address(lotteryManager).balance, 0, "test assumes zero starting balance");

        vm.prank(authorizedSwap);
        uint256 entryId = lotteryManager.processSwapLottery{value: nativeFee}(buyer, shareOFT, SWAP_AMOUNT);

        assertEq(entryId, 0, "entry should be skipped when VRF send fails");
        assertEq(address(lotteryManager).balance, 0, "caller fee should be refunded on send failure");
    }

    function _configureCrossChain(address integratorAddr) internal {
        vm.startPrank(owner);
        lotteryManager.setVRFIntegrator(integratorAddr);
        lotteryManager.setTargetEid(TARGET_EID);
        lotteryManager.setUseLocalVRF(false);
        vm.stopPrank();
    }
}

