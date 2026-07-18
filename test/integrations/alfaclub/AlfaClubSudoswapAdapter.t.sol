// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {AlfaClubSudoswapAdapter} from "../../../contracts/other/alfaclub/universal-router/AlfaClubSudoswapAdapter.sol";

import {LSSVMPair} from "sudoswap/LSSVMPair.sol";
import {LSSVMRouter} from "sudoswap/LSSVMRouter.sol";
import {RoyaltyEngine} from "sudoswap/RoyaltyEngine.sol";
import {LSSVMPairFactory} from "sudoswap/LSSVMPairFactory.sol";
import {XykCurve} from "sudoswap/bonding-curves/XykCurve.sol";
import {Test20} from "sudoswap/mocks/Test20.sol";
import {Test1155} from "sudoswap/mocks/Test1155.sol";
import {TestRoyaltyRegistry} from "sudoswap/mocks/TestRoyaltyRegistry.sol";
import {LSSVMPairERC721ETH} from "sudoswap/erc721/LSSVMPairERC721ETH.sol";
import {LSSVMPairERC721ERC20} from "sudoswap/erc721/LSSVMPairERC721ERC20.sol";
import {LSSVMPairERC1155ETH} from "sudoswap/erc1155/LSSVMPairERC1155ETH.sol";
import {LSSVMPairERC1155ERC20} from "sudoswap/erc1155/LSSVMPairERC1155ERC20.sol";

import {IAllowanceTransfer} from "../../../lib/universal-router/lib/permit2/src/interfaces/IAllowanceTransfer.sol";
import {ERC20} from "../../../lib/sudoswap-lssvm2/lib/solmate/src/tokens/ERC20.sol";
import {IERC1155} from "../../../lib/sudoswap-lssvm2/lib/openzeppelin-contracts/contracts/token/ERC1155/IERC1155.sol";
import {
    ERC1155Holder
} from "../../../lib/sudoswap-lssvm2/lib/openzeppelin-contracts/contracts/token/ERC1155/utils/ERC1155Holder.sol";

contract AdapterPermit2Mock {
    mapping(address owner => mapping(address token => mapping(address spender => uint160 amount))) public allowance;

    function approve(address token, address spender, uint160 amount) external {
        allowance[msg.sender][token][spender] = amount;
    }

    function transferFrom(address from, address to, uint160 amount, address token) external {
        uint160 available = allowance[from][token][msg.sender];
        require(available >= amount, "PERMIT2_ALLOWANCE");
        if (available != type(uint160).max) allowance[from][token][msg.sender] = available - amount;
        require(ERC20(token).transferFrom(from, to, amount), "TOKEN_TRANSFER");
    }
}

contract AlfaClubSudoswapAdapterTest is Test, ERC1155Holder {
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

    Test20 private creatorCoin;
    Test1155 private friendKey;
    XykCurve private xykCurve;
    LSSVMPairFactory private factory;
    LSSVMPairERC1155ERC20 private pair;
    AdapterPermit2Mock private permit2;
    AlfaClubSudoswapAdapter private adapter;

    function setUp() public {
        TestRoyaltyRegistry registry = new TestRoyaltyRegistry();
        registry.initialize(address(this));
        RoyaltyEngine royaltyEngine = new RoyaltyEngine(address(registry));

        factory = new LSSVMPairFactory(
            new LSSVMPairERC721ETH(royaltyEngine),
            new LSSVMPairERC721ERC20(royaltyEngine),
            new LSSVMPairERC1155ETH(royaltyEngine),
            new LSSVMPairERC1155ERC20(royaltyEngine),
            payable(address(0xFEE)),
            1e16,
            address(this)
        );
        creatorCoin = new Test20();
        friendKey = new Test1155();
        xykCurve = new XykCurve();
        permit2 = new AdapterPermit2Mock();

        factory.setBondingCurveAllowed(xykCurve, true);
        creatorCoin.mint(address(this), 1_000 ether);
        friendKey.mint(address(this), TOKEN_ID, 50);
        creatorCoin.approve(address(factory), type(uint256).max);
        friendKey.setApprovalForAll(address(factory), true);

        // Encode the official factory tuple at the ABI boundary. The adapter
        // intentionally imports Sudoswap's pinned ERC20/ERC1155 types directly,
        // while the factory sources reach the same types through remappings.
        (bool pairCreated, bytes memory pairResult) = address(factory)
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
        pair = LSSVMPairERC1155ERC20(payable(abi.decode(pairResult, (address))));

        adapter = new AlfaClubSudoswapAdapter(
            address(this),
            address(this),
            factory,
            IAllowanceTransfer(address(permit2)),
            IERC1155(address(friendKey)),
            xykCurve
        );
        factory.setRouterAllowed(LSSVMRouter(payable(address(adapter))), true);
        adapter.setMarket(address(pair), address(creatorCoin), TOKEN_ID, true);

        creatorCoin.mint(PAYER, 100 ether);
        vm.startPrank(PAYER);
        creatorCoin.approve(address(permit2), type(uint256).max);
        permit2.approve(address(creatorCoin), address(adapter), type(uint160).max);
        friendKey.setApprovalForAll(address(adapter), true);
        vm.stopPrank();
    }

    function test_buyAndSellThroughOfficialSudoswapPair() public {
        uint256 coinBeforeBuy = creatorCoin.balanceOf(PAYER);
        uint256 pairKeysBeforeBuy = friendKey.balanceOf(address(pair), TOKEN_ID);
        uint256 factoryCoinBeforeBuy = creatorCoin.balanceOf(address(factory));

        uint256 creatorCoinIn = adapter.buy(address(pair), PAYER, 2, 10 ether, PAYER);

        assertGt(creatorCoinIn, 0);
        assertEq(creatorCoin.balanceOf(PAYER), coinBeforeBuy - creatorCoinIn);
        assertGt(creatorCoin.balanceOf(address(factory)), factoryCoinBeforeBuy);
        assertEq(friendKey.balanceOf(PAYER, TOKEN_ID), 2);
        assertEq(friendKey.balanceOf(address(pair), TOKEN_ID), pairKeysBeforeBuy - 2);

        uint256 coinBeforeSell = creatorCoin.balanceOf(PAYER);
        uint256 creatorCoinOut = adapter.sell(address(pair), PAYER, 2, 1, PAYER);

        assertGt(creatorCoinOut, 0);
        assertEq(creatorCoin.balanceOf(PAYER), coinBeforeSell + creatorCoinOut);
        assertEq(friendKey.balanceOf(PAYER, TOKEN_ID), 0);
        assertEq(friendKey.balanceOf(address(pair), TOKEN_ID), pairKeysBeforeBuy);
    }

    function test_rejectsCallerOtherThanUniversalRouter() public {
        vm.prank(PAYER);
        vm.expectRevert(abi.encodeWithSelector(AlfaClubSudoswapAdapter.UnauthorizedRouter.selector, PAYER));
        adapter.buy(address(pair), PAYER, 1, 10 ether, PAYER);
    }

    function test_usesDirectPairFallbackWhenFactoryDoesNotAllowAdapter() public {
        factory.setRouterAllowed(LSSVMRouter(payable(address(adapter))), false);

        uint256 creatorCoinIn = adapter.buy(address(pair), PAYER, 1, 10 ether, PAYER);
        assertGt(creatorCoinIn, 0);
        assertEq(creatorCoin.balanceOf(address(adapter)), 0, "adapter Creator Coin residue");
        assertEq(creatorCoin.allowance(address(adapter), address(pair)), 0, "pair token allowance revoked");

        uint256 creatorCoinOut = adapter.sell(address(pair), PAYER, 1, 1, PAYER);
        assertGt(creatorCoinOut, 0);
        assertEq(friendKey.balanceOf(address(adapter), TOKEN_ID), 0, "adapter key residue");
        assertFalse(friendKey.isApprovedForAll(address(adapter), address(pair)), "pair key approval revoked");
    }

    function test_rejectsInactivePairCallbacks() public {
        vm.expectRevert(AlfaClubSudoswapAdapter.InactiveCallback.selector);
        adapter.pairTransferERC20From(ERC20(address(creatorCoin)), PAYER, address(pair), 1);
    }

    function test_marketBindingRejectsWrongCreatorCoin() public {
        Test20 wrongCoin = new Test20();
        vm.expectRevert(
            abi.encodeWithSelector(
                AlfaClubSudoswapAdapter.InvalidCreatorCoin.selector, address(pair), address(creatorCoin)
            )
        );
        adapter.setMarket(address(pair), address(wrongCoin), TOKEN_ID, true);
    }
}
