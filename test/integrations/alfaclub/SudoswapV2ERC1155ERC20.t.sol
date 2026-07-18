// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";

import {IERC1155} from "lib/sudoswap-lssvm2/lib/openzeppelin-contracts/contracts/token/ERC1155/IERC1155.sol";
import {
    ERC1155Holder
} from "lib/sudoswap-lssvm2/lib/openzeppelin-contracts/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {RoyaltyRegistry} from "lib/sudoswap-lssvm2/lib/royalty-registry-solidity/contracts/RoyaltyRegistry.sol";
import {ERC20} from "lib/sudoswap-lssvm2/lib/solmate/src/tokens/ERC20.sol";

import {ILSSVMPairFactoryLike} from "sudoswap/ILSSVMPairFactoryLike.sol";
import {LSSVMPair} from "sudoswap/LSSVMPair.sol";
import {LSSVMRouter} from "sudoswap/LSSVMRouter.sol";
import {RoyaltyEngine} from "sudoswap/RoyaltyEngine.sol";
import {VeryFastRouter} from "sudoswap/VeryFastRouter.sol";
import {XykCurve} from "sudoswap/bonding-curves/XykCurve.sol";
import {CurveErrorCodes} from "sudoswap/bonding-curves/CurveErrorCodes.sol";
import {LSSVMPairFactory} from "sudoswap/LSSVMPairFactory.sol";
import {LSSVMPairERC1155ERC20} from "sudoswap/erc1155/LSSVMPairERC1155ERC20.sol";
import {LSSVMPairERC1155ETH} from "sudoswap/erc1155/LSSVMPairERC1155ETH.sol";
import {LSSVMPairERC721ERC20} from "sudoswap/erc721/LSSVMPairERC721ERC20.sol";
import {LSSVMPairERC721ETH} from "sudoswap/erc721/LSSVMPairERC721ETH.sol";
import {Test1155} from "sudoswap/mocks/Test1155.sol";
import {Test20} from "sudoswap/mocks/Test20.sol";

/**
 * @notice Focused integration proof using only the pinned official Sudoswap v2
 *         engine, templates, factory, XYK curve, router, pair, and test assets.
 */
contract SudoswapV2ERC1155ERC20Test is Test, ERC1155Holder {
    uint256 internal constant ROOM_TOKEN_ID = 1659;
    uint256 internal constant INITIAL_KEY_BALANCE = 100;
    uint256 internal constant INITIAL_TOKEN_BALANCE = 10_000 ether;
    uint128 internal constant VIRTUAL_KEY_RESERVE = 1_000;
    uint128 internal constant VIRTUAL_TOKEN_RESERVE = 10_000 ether;
    uint96 internal constant LP_FEE = 0.069e18;
    uint256 internal constant PROTOCOL_FEE = 0.005e18;

    address internal constant BUYER = address(0xB0B);
    address payable internal constant PROTOCOL_FEE_RECIPIENT = payable(address(0xFEE));

    RoyaltyEngine internal royaltyEngine;
    LSSVMPairFactory internal factory;
    XykCurve internal xykCurve;
    VeryFastRouter internal veryFastRouter;
    Test1155 internal friendKey;
    Test20 internal creatorCoin;
    LSSVMPairERC1155ERC20 internal pair;

    function setUp() public {
        RoyaltyRegistry royaltyRegistry = new RoyaltyRegistry(address(0));
        royaltyRegistry.initialize(address(this));
        royaltyEngine = new RoyaltyEngine(address(royaltyRegistry));

        LSSVMPairERC721ETH erc721ETHTemplate = new LSSVMPairERC721ETH(royaltyEngine);
        LSSVMPairERC721ERC20 erc721ERC20Template = new LSSVMPairERC721ERC20(royaltyEngine);
        LSSVMPairERC1155ETH erc1155ETHTemplate = new LSSVMPairERC1155ETH(royaltyEngine);
        LSSVMPairERC1155ERC20 erc1155ERC20Template = new LSSVMPairERC1155ERC20(royaltyEngine);

        factory = new LSSVMPairFactory(
            erc721ETHTemplate,
            erc721ERC20Template,
            erc1155ETHTemplate,
            erc1155ERC20Template,
            PROTOCOL_FEE_RECIPIENT,
            PROTOCOL_FEE,
            address(this)
        );

        xykCurve = new XykCurve();
        factory.setBondingCurveAllowed(xykCurve, true);

        veryFastRouter = new VeryFastRouter(factory);
        factory.setRouterAllowed(LSSVMRouter(payable(address(veryFastRouter))), true);

        friendKey = new Test1155();
        creatorCoin = new Test20();
        friendKey.mint(address(this), ROOM_TOKEN_ID, INITIAL_KEY_BALANCE);
        creatorCoin.mint(address(this), INITIAL_TOKEN_BALANCE);
        friendKey.setApprovalForAll(address(factory), true);
        creatorCoin.approve(address(factory), INITIAL_TOKEN_BALANCE);

        pair = factory.createPairERC1155ERC20(
            LSSVMPairFactory.CreateERC1155ERC20PairParams({
                token: ERC20(address(creatorCoin)),
                nft: IERC1155(address(friendKey)),
                bondingCurve: xykCurve,
                assetRecipient: payable(address(0)),
                poolType: LSSVMPair.PoolType.TRADE,
                delta: VIRTUAL_KEY_RESERVE,
                fee: LP_FEE,
                spotPrice: VIRTUAL_TOKEN_RESERVE,
                nftId: ROOM_TOKEN_ID,
                initialNFTBalance: INITIAL_KEY_BALANCE,
                initialTokenBalance: INITIAL_TOKEN_BALANCE
            })
        );
    }

    function testDeploysCanonicalOfficialStackAndPair() public view {
        assertEq(royaltyEngine.ROYALTY_REGISTRY().code.length > 0, true, "royalty registry code");
        assertTrue(factory.bondingCurveAllowed(xykCurve), "XYK curve allowed");
        assertEq(address(veryFastRouter.factory()), address(factory), "router factory");

        (bool routerAllowed, bool routerWasEverTouched) =
            factory.routerStatus(LSSVMRouter(payable(address(veryFastRouter))));
        assertTrue(routerAllowed, "router allowed");
        assertTrue(routerWasEverTouched, "router status initialized");

        assertTrue(factory.isValidPair(address(pair)), "official pair clone");
        assertEq(
            uint256(pair.pairVariant()),
            uint256(ILSSVMPairFactoryLike.PairVariant.ERC1155_ERC20),
            "ERC1155/ERC20 variant"
        );
        assertEq(address(pair.factory()), address(factory), "pair factory");
        assertEq(address(pair.bondingCurve()), address(xykCurve), "pair curve");
        assertEq(pair.nft(), address(friendKey), "pair FriendKey");
        assertEq(address(pair.token()), address(creatorCoin), "pair Creator Coin");
        assertEq(pair.nftId(), ROOM_TOKEN_ID, "room token ID");
        assertEq(uint256(pair.poolType()), uint256(LSSVMPair.PoolType.TRADE), "TRADE pool");
        assertEq(pair.fee(), LP_FEE, "6.9% Room 1659 pair fee");
        assertEq(pair.owner(), address(this), "pair is the LP position");
        assertEq(friendKey.balanceOf(address(pair), ROOM_TOKEN_ID), INITIAL_KEY_BALANCE, "seeded keys");
        assertEq(creatorCoin.balanceOf(address(pair)), INITIAL_TOKEN_BALANCE, "seeded Creator Coins");
    }

    function testOfficialPairBuysAndSellsRoomKeysAgainstCreatorCoin() public {
        creatorCoin.mint(BUYER, 2_000 ether);

        uint256[] memory quantities = new uint256[](1);
        quantities[0] = 3;

        (CurveErrorCodes.Error buyError,,, uint256 buyQuote,,) = pair.getBuyNFTQuote(ROOM_TOKEN_ID, quantities[0]);
        assertEq(uint256(buyError), uint256(CurveErrorCodes.Error.OK), "buy quote");

        vm.startPrank(BUYER);
        creatorCoin.approve(address(pair), buyQuote);
        uint256 buyerTokenBefore = creatorCoin.balanceOf(BUYER);
        uint256 boughtFor = pair.swapTokenForSpecificNFTs(quantities, buyQuote, BUYER, false, address(0));
        vm.stopPrank();

        assertEq(boughtFor, buyQuote, "buy execution matches quote");
        assertEq(creatorCoin.balanceOf(BUYER), buyerTokenBefore - buyQuote, "Creator Coin spent");
        assertEq(friendKey.balanceOf(BUYER, ROOM_TOKEN_ID), quantities[0], "keys received");
        assertEq(
            friendKey.balanceOf(address(pair), ROOM_TOKEN_ID), INITIAL_KEY_BALANCE - quantities[0], "pair keys debited"
        );

        quantities[0] = 2;
        (CurveErrorCodes.Error sellError,,, uint256 sellQuote,,) = pair.getSellNFTQuote(ROOM_TOKEN_ID, quantities[0]);
        assertEq(uint256(sellError), uint256(CurveErrorCodes.Error.OK), "sell quote");

        vm.startPrank(BUYER);
        friendKey.setApprovalForAll(address(pair), true);
        buyerTokenBefore = creatorCoin.balanceOf(BUYER);
        uint256 soldFor = pair.swapNFTsForToken(quantities, sellQuote, payable(BUYER), false, address(0));
        vm.stopPrank();

        assertEq(soldFor, sellQuote, "sell execution matches quote");
        assertEq(creatorCoin.balanceOf(BUYER), buyerTokenBefore + sellQuote, "Creator Coin received");
        assertEq(friendKey.balanceOf(BUYER, ROOM_TOKEN_ID), 1, "remaining buyer key");
        assertEq(friendKey.balanceOf(address(pair), ROOM_TOKEN_ID), INITIAL_KEY_BALANCE - 1, "pair keys credited");
        assertGt(creatorCoin.balanceOf(address(factory)), 0, "protocol fees accrued to factory");
    }
}
