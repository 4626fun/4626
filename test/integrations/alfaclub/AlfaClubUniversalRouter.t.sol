// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {AlfaClubCommands} from "../../../contracts/other/alfaclub/universal-router/AlfaClubCommands.sol";
import {AlfaClubDispatcher} from "../../../contracts/other/alfaclub/universal-router/AlfaClubDispatcher.sol";
import {AlfaClubSudoswapAdapter} from "../../../contracts/other/alfaclub/universal-router/AlfaClubSudoswapAdapter.sol";
import {AlfaClubUniversalRouter} from "../../../contracts/other/alfaclub/universal-router/AlfaClubUniversalRouter.sol";

import {RouterParameters} from "universal-router/types/RouterParameters.sol";
import {IUniversalRouter} from "universal-router/interfaces/IUniversalRouter.sol";

import {LSSVMPair} from "sudoswap/LSSVMPair.sol";
import {LSSVMRouter} from "sudoswap/LSSVMRouter.sol";
import {RoyaltyEngine} from "sudoswap/RoyaltyEngine.sol";
import {LSSVMPairFactory} from "sudoswap/LSSVMPairFactory.sol";
import {XykCurve} from "sudoswap/bonding-curves/XykCurve.sol";
import {CurveErrorCodes} from "sudoswap/bonding-curves/CurveErrorCodes.sol";
import {Test20} from "sudoswap/mocks/Test20.sol";
import {Test1155} from "sudoswap/mocks/Test1155.sol";
import {TestRoyaltyRegistry} from "sudoswap/mocks/TestRoyaltyRegistry.sol";
import {LSSVMPairERC721ETH} from "sudoswap/erc721/LSSVMPairERC721ETH.sol";
import {LSSVMPairERC721ERC20} from "sudoswap/erc721/LSSVMPairERC721ERC20.sol";
import {LSSVMPairERC1155ETH} from "sudoswap/erc1155/LSSVMPairERC1155ETH.sol";
import {LSSVMPairERC1155ERC20} from "sudoswap/erc1155/LSSVMPairERC1155ERC20.sol";

import {IAllowanceTransfer} from "../../../lib/universal-router/lib/permit2/src/interfaces/IAllowanceTransfer.sol";
import {Permit2Mock} from "../../../test/fixtures/universal-router/Permit2Mock.sol";
import {IERC1155} from "../../../lib/sudoswap-lssvm2/lib/openzeppelin-contracts/contracts/token/ERC1155/IERC1155.sol";
import {
    ERC1155Holder
} from "../../../lib/sudoswap-lssvm2/lib/openzeppelin-contracts/contracts/token/ERC1155/utils/ERC1155Holder.sol";

interface IUniswapV2FactoryFixture {
    function createPair(address tokenA, address tokenB) external returns (address pair);
}

interface IUniswapV2PairFixture {
    function mint(address to) external returns (uint256 liquidity);
}

contract AlfaClubUniversalRouterTest is Test, ERC1155Holder {
    struct RawPairParams {
        address token;
        address nft;
        address bondingCurve;
        address payable assetRecipient;
        uint8 poolType;
        uint128 delta;
        uint96 fee;
        uint128 spotPrice;
        uint256 nftId;
        uint256 initialNFTBalance;
        uint256 initialTokenBalance;
    }

    uint256 private constant TOKEN_ID = 1659;
    address private constant PAYER = address(0xBEEF);
    address private constant SINK = address(0xCAFE);

    Test20 private creatorCoin;
    Test20 private inputToken;
    Test1155 private friendKey;
    XykCurve private xykCurve;
    LSSVMPairFactory private sudoswapFactory;
    LSSVMPairERC1155ERC20 private sudoswapPair;
    IAllowanceTransfer private permit2;
    IUniswapV2FactoryFixture private uniswapV2Factory;
    IUniswapV2PairFixture private uniswapV2Pair;
    AlfaClubSudoswapAdapter private adapter;
    AlfaClubUniversalRouter private router;

    function setUp() public {
        _deployOfficialSudoswapMarket();
        _deployOfficialPermit2AndUniswapV2();
        _deployRouterAndAdapter();
        _seedUniswapV2();
        _approvePayerAssets();
    }

    function test_atomicUniswapV2ToSudoswapBuyAndSudoswapToUniswapV2Sell() public {
        uint256 inputAmount = 20 ether;
        uint256 payerInputBefore = inputToken.balanceOf(PAYER);

        address[] memory buyPath = new address[](2);
        buyPath[0] = address(inputToken);
        buyPath[1] = address(creatorCoin);
        uint256[] memory noHopPriceLimits = new uint256[](0);

        bytes memory buyCommands = abi.encodePacked(
            bytes1(uint8(AlfaClubCommands.V2_SWAP_EXACT_IN)), bytes1(uint8(AlfaClubCommands.SUDOSWAP_ERC1155_BUY))
        );
        bytes[] memory buyInputs = new bytes[](2);
        buyInputs[0] = abi.encode(PAYER, inputAmount, 1, buyPath, true, noHopPriceLimits);
        buyInputs[1] = abi.encode(address(sudoswapPair), PAYER, 1, 5 ether, true);

        vm.prank(PAYER);
        router.execute(buyCommands, buyInputs, block.timestamp + 1);

        assertEq(inputToken.balanceOf(PAYER), payerInputBefore - inputAmount);
        assertEq(friendKey.balanceOf(PAYER, TOKEN_ID), 1);
        assertGt(creatorCoin.balanceOf(PAYER), 0);

        // Remove the unused v2 output so the reverse route can only succeed by
        // consuming the Creator Coin produced by the Sudoswap sell command in
        // the same Universal Router execution.
        uint256 unusedCreatorCoin = creatorCoin.balanceOf(PAYER);
        vm.prank(PAYER);
        creatorCoin.transfer(SINK, unusedCreatorCoin);
        assertEq(creatorCoin.balanceOf(PAYER), 0);

        (CurveErrorCodes.Error quoteError,,, uint256 sellOutput,,) = sudoswapPair.getSellNFTQuote(TOKEN_ID, 1);
        assertEq(uint256(quoteError), uint256(CurveErrorCodes.Error.OK));
        assertGt(sellOutput, 0);

        address[] memory sellPath = new address[](2);
        sellPath[0] = address(creatorCoin);
        sellPath[1] = address(inputToken);

        bytes memory sellCommands = abi.encodePacked(
            bytes1(uint8(AlfaClubCommands.SUDOSWAP_ERC1155_SELL)), bytes1(uint8(AlfaClubCommands.V2_SWAP_EXACT_IN))
        );
        bytes[] memory sellInputs = new bytes[](2);
        sellInputs[0] = abi.encode(address(sudoswapPair), PAYER, 1, 1, true);
        sellInputs[1] = abi.encode(PAYER, sellOutput, 1, sellPath, true, noHopPriceLimits);

        uint256 payerInputBeforeSell = inputToken.balanceOf(PAYER);
        vm.prank(PAYER);
        router.execute(sellCommands, sellInputs, block.timestamp + 1);

        assertEq(friendKey.balanceOf(PAYER, TOKEN_ID), 0);
        assertEq(creatorCoin.balanceOf(PAYER), 0);
        assertGt(inputToken.balanceOf(PAYER), payerInputBeforeSell);
    }

    function test_mapsMsgSenderRecipientForSudoswapBuy() public {
        bytes memory commands = abi.encodePacked(bytes1(uint8(AlfaClubCommands.SUDOSWAP_ERC1155_BUY)));
        bytes[] memory inputs = new bytes[](1);
        // Upstream ActionConstants.MSG_SENDER is address(1).
        inputs[0] = abi.encode(address(sudoswapPair), address(1), 1, 5 ether, true);

        creatorCoin.mint(PAYER, 5 ether);
        vm.prank(PAYER);
        router.execute(commands, inputs, block.timestamp + 1);

        assertEq(friendKey.balanceOf(PAYER, TOKEN_ID), 1);
    }

    function test_rejectsRouterFundedSudoswapCommand() public {
        bytes memory commands = abi.encodePacked(bytes1(uint8(AlfaClubCommands.SUDOSWAP_ERC1155_BUY)));
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(address(sudoswapPair), PAYER, 1, 5 ether, false);

        bytes memory payerError = abi.encodePacked(AlfaClubDispatcher.SudoswapPayerMustBeUser.selector);
        vm.prank(PAYER);
        vm.expectRevert(abi.encodeWithSelector(IUniversalRouter.ExecutionFailed.selector, 0, payerError));
        router.execute(commands, inputs, block.timestamp + 1);
    }

    function test_allowRevertRetainsUpstreamSemanticsForUnsponsoredRoute() public {
        bytes memory commands = abi.encodePacked(bytes1(uint8(AlfaClubCommands.SUDOSWAP_ERC1155_BUY) | uint8(0x80)));
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(address(sudoswapPair), PAYER, 1, 5 ether, false);

        uint256 keysBefore = friendKey.balanceOf(PAYER, TOKEN_ID);
        vm.prank(PAYER);
        router.execute(commands, inputs, block.timestamp + 1);
        assertEq(friendKey.balanceOf(PAYER, TOKEN_ID), keysBefore);
    }

    function test_malformedSudoswapInputReturnsIndexedExecutionFailure() public {
        bytes memory commands = abi.encodePacked(bytes1(uint8(AlfaClubCommands.SUDOSWAP_ERC1155_BUY)));
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(address(sudoswapPair), PAYER);

        bytes memory adapterError = abi.encodePacked(AlfaClubDispatcher.InvalidSudoswapInput.selector);
        vm.prank(PAYER);
        vm.expectRevert(abi.encodeWithSelector(IUniversalRouter.ExecutionFailed.selector, 0, adapterError));
        router.execute(commands, inputs, block.timestamp + 1);
    }

    function _deployOfficialSudoswapMarket() private {
        TestRoyaltyRegistry registry = new TestRoyaltyRegistry();
        registry.initialize(address(this));
        RoyaltyEngine royaltyEngine = new RoyaltyEngine(address(registry));

        sudoswapFactory = new LSSVMPairFactory(
            new LSSVMPairERC721ETH(royaltyEngine),
            new LSSVMPairERC721ERC20(royaltyEngine),
            new LSSVMPairERC1155ETH(royaltyEngine),
            new LSSVMPairERC1155ERC20(royaltyEngine),
            payable(address(0xFEE)),
            1e16,
            address(this)
        );
        creatorCoin = new Test20();
        inputToken = new Test20();
        friendKey = new Test1155();
        xykCurve = new XykCurve();

        sudoswapFactory.setBondingCurveAllowed(xykCurve, true);
        creatorCoin.mint(address(this), 2_000 ether);
        friendKey.mint(address(this), TOKEN_ID, 50);
        creatorCoin.approve(address(sudoswapFactory), type(uint256).max);
        friendKey.setApprovalForAll(address(sudoswapFactory), true);

        (bool pairCreated, bytes memory pairResult) = address(sudoswapFactory)
            .call(
                abi.encodeWithSelector(
                    LSSVMPairFactory.createPairERC1155ERC20.selector,
                    RawPairParams({
                    token: address(creatorCoin),
                    nft: address(friendKey),
                    bondingCurve: address(xykCurve),
                    assetRecipient: payable(address(0)),
                    poolType: uint8(LSSVMPair.PoolType.TRADE),
                    delta: 100,
                    fee: 0,
                    spotPrice: 100 ether,
                    nftId: TOKEN_ID,
                    initialNFTBalance: 50,
                    initialTokenBalance: 500 ether
                })
                )
            );
        if (!pairCreated) {
            assembly ("memory-safe") {
                revert(add(pairResult, 0x20), mload(pairResult))
            }
        }
        sudoswapPair = LSSVMPairERC1155ERC20(payable(abi.decode(pairResult, (address))));
    }

    function _deployOfficialPermit2AndUniswapV2() private {
        permit2 = IAllowanceTransfer(address(new Permit2Mock()));
        uniswapV2Factory =
            IUniswapV2FactoryFixture(vm.deployCode("UniswapV2Factory.sol:UniswapV2Factory", abi.encode(address(this))));
        uniswapV2Pair = IUniswapV2PairFixture(uniswapV2Factory.createPair(address(inputToken), address(creatorCoin)));
    }

    function _deployRouterAndAdapter() private {
        uint64 deploymentNonce = vm.getNonce(address(this));
        address predictedAdapter = vm.computeCreateAddress(address(this), deploymentNonce);
        address predictedRouter = vm.computeCreateAddress(address(this), deploymentNonce + 1);

        adapter = new AlfaClubSudoswapAdapter(
            predictedRouter, address(this), sudoswapFactory, permit2, IERC1155(address(friendKey)), xykCurve
        );
        assertEq(address(adapter), predictedAdapter);

        bytes memory v2PairCreationCode = vm.getCode("UniswapV2Pair.sol:UniswapV2Pair");
        RouterParameters memory parameters = RouterParameters({
            permit2: address(permit2),
            weth9: address(0),
            v2Factory: address(uniswapV2Factory),
            v3Factory: address(0),
            pairInitCodeHash: keccak256(v2PairCreationCode),
            poolInitCodeHash: bytes32(0),
            v4PoolManager: address(0),
            permissionsAdapterFactory: address(0),
            v3NFTPositionManager: address(0),
            v4PositionManager: address(0),
            spokePool: address(0)
        });
        router = new AlfaClubUniversalRouter(parameters, address(adapter));
        assertEq(address(router), predictedRouter);

        sudoswapFactory.setRouterAllowed(LSSVMRouter(payable(address(adapter))), true);
        adapter.setMarket(address(sudoswapPair), address(creatorCoin), TOKEN_ID, true);
    }

    function _seedUniswapV2() private {
        inputToken.mint(address(this), 1_000 ether);
        inputToken.transfer(address(uniswapV2Pair), 1_000 ether);
        creatorCoin.transfer(address(uniswapV2Pair), 1_000 ether);
        uniswapV2Pair.mint(address(this));
    }

    function _approvePayerAssets() private {
        inputToken.mint(PAYER, 100 ether);
        vm.startPrank(PAYER);
        inputToken.approve(address(permit2), type(uint256).max);
        creatorCoin.approve(address(permit2), type(uint256).max);
        permit2.approve(address(inputToken), address(router), type(uint160).max, type(uint48).max);
        permit2.approve(address(creatorCoin), address(router), type(uint160).max, type(uint48).max);
        permit2.approve(address(creatorCoin), address(adapter), type(uint160).max, type(uint48).max);
        friendKey.setApprovalForAll(address(adapter), true);
        vm.stopPrank();
    }
}
