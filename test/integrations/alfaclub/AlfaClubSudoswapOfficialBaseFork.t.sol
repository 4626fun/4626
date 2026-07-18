// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {AlfaClubSudoswapAdapter} from "contracts/other/alfaclub/universal-router/AlfaClubSudoswapAdapter.sol";
import {AlfaClubUniversalRouter} from "contracts/other/alfaclub/universal-router/AlfaClubUniversalRouter.sol";
import {IOfficialSudoswapV2Factory} from "contracts/other/alfaclub/sudoswap/IOfficialSudoswapV2Factory.sol";
import {AlfaClubCommands} from "contracts/other/alfaclub/universal-router/AlfaClubCommands.sol";

import {LSSVMPair} from "sudoswap/LSSVMPair.sol";
import {LSSVMRouter} from "sudoswap/LSSVMRouter.sol";
import {LSSVMPairFactory} from "sudoswap/LSSVMPairFactory.sol";
import {CurveErrorCodes} from "sudoswap/bonding-curves/CurveErrorCodes.sol";
import {ICurve} from "sudoswap/bonding-curves/ICurve.sol";
import {LSSVMPairERC1155ERC20} from "sudoswap/erc1155/LSSVMPairERC1155ERC20.sol";

import {IAllowanceTransfer} from "lib/universal-router/lib/permit2/src/interfaces/IAllowanceTransfer.sol";
import {ERC20} from "lib/sudoswap-lssvm2/lib/solmate/src/tokens/ERC20.sol";
import {IERC1155} from "lib/sudoswap-lssvm2/lib/openzeppelin-contracts/contracts/token/ERC1155/IERC1155.sol";

/**
 * @notice Exact rehearsal of the proposed Room 1659 production market against
 * the official Base factory and the already deployed AlfaClub adapter/router.
 * @dev All writes occur only on a Foundry fork. The test impersonates the
 * canonical CSW and market-admin Safe, then proves a buy/sell round trip and
 * restores every approval to its fork-start value.
 */
contract AlfaClubSudoswapOfficialBaseForkTest is Test {
    address private constant OFFICIAL_FACTORY = 0x605145D263482684590f630E9e581B21E4938eb8;
    address private constant OFFICIAL_XYK_CURVE = 0xd0A2f4ae5E816ec09374c67F6532063B60dE037B;
    address private constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address private constant FRIEND_KEY = 0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F;
    address private constant AKITA = 0x5b674196812451B7cEC024FE9d22D2c0b172fa75;
    address private constant CANONICAL_CSW = 0xAb6d5C10b03300326CD7fAb7267Ae192842967b5;
    address private constant MARKET_ADMIN_SAFE = 0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3;
    address private constant ADAPTER = 0x961b113FF5E3547e8198758900b8f4Fa552A3Fe5;
    address private constant ROUTER = 0x14c0e8840A3B7caE49EbdA899C7101A827598e9f;
    address private constant PRODUCTION_PAIR = 0x4a1bD15948A6a61DbE5dfD1e57d5982fD1285766;

    uint256 private constant ROOM_TOKEN_ID = 1659;
    uint256 private constant INITIAL_KEYS = 3;
    uint256 private constant INITIAL_AKITA = 50_000_000 ether;
    uint128 private constant VIRTUAL_KEY_RESERVE = 23;
    uint128 private constant VIRTUAL_AKITA_RESERVE = 251_783_879_406_935_024_227_051_578;
    uint96 private constant PAIR_FEE = 69_000_000_000_000_000;

    bool private forkConfigured;

    function setUp() public {
        string memory rpcUrl = vm.envOr("BASE_RPC_URL", string(""));
        if (bytes(rpcUrl).length == 0) return;
        vm.createSelectFork(rpcUrl);
        forkConfigured = true;
    }

    function testOfficialBasePairAndDeployedRouterRoundTrip() public {
        if (!forkConfigured) return;

        LSSVMPairFactory factory = LSSVMPairFactory(payable(OFFICIAL_FACTORY));
        ICurve curve = ICurve(OFFICIAL_XYK_CURVE);
        IAllowanceTransfer permit2 = IAllowanceTransfer(PERMIT2);
        IERC1155 friendKey = IERC1155(FRIEND_KEY);
        ERC20 akita = ERC20(AKITA);
        AlfaClubSudoswapAdapter adapter = AlfaClubSudoswapAdapter(ADAPTER);
        AlfaClubUniversalRouter router = AlfaClubUniversalRouter(payable(ROUTER));

        assertGt(OFFICIAL_FACTORY.code.length, 0, "official factory code");
        assertGt(OFFICIAL_XYK_CURVE.code.length, 0, "official curve code");
        assertGt(ADAPTER.code.length, 0, "deployed adapter code");
        assertGt(ROUTER.code.length, 0, "deployed router code");
        assertTrue(factory.bondingCurveAllowed(curve), "official XYK allowlisted");
        assertEq(adapter.owner(), MARKET_ADMIN_SAFE, "Safe owns adapter");
        assertEq(address(adapter.factory()), OFFICIAL_FACTORY, "adapter official factory");
        assertEq(address(adapter.xykCurve()), OFFICIAL_XYK_CURVE, "adapter official curve");
        assertEq(address(adapter.permit2()), PERMIT2, "adapter Permit2");
        assertEq(adapter.universalRouter(), ROUTER, "adapter router");
        assertEq(address(router.SUDOSWAP_ADAPTER()), ADAPTER, "router adapter");
        (bool adapterFactoryAllowed,) = factory.routerStatus(LSSVMRouter(payable(ADAPTER)));
        assertFalse(adapterFactoryAllowed, "official factory uses direct adapter path");

        uint256 canonicalKeysBefore = friendKey.balanceOf(CANONICAL_CSW, ROOM_TOKEN_ID);
        uint256 canonicalAkitaBefore = akita.balanceOf(CANONICAL_CSW);
        bool usingProductionPair = factory.isValidPair(PRODUCTION_PAIR);
        if (usingProductionPair) {
            assertGe(canonicalKeysBefore, 1, "production canary key available");
        } else {
            assertGe(canonicalKeysBefore, INITIAL_KEYS + 1, "retain one canonical key");
        }
        assertGe(canonicalAkitaBefore, INITIAL_AKITA, "seed AKITA available");
        assertFalse(friendKey.isApprovedForAll(CANONICAL_CSW, OFFICIAL_FACTORY), "clean factory key approval");
        assertEq(akita.allowance(CANONICAL_CSW, OFFICIAL_FACTORY), 0, "clean factory token allowance");

        LSSVMPairERC1155ERC20 pair;
        if (usingProductionPair) {
            pair = LSSVMPairERC1155ERC20(payable(PRODUCTION_PAIR));
        } else {
            vm.startPrank(CANONICAL_CSW);
            friendKey.setApprovalForAll(OFFICIAL_FACTORY, true);
            assertTrue(akita.approve(OFFICIAL_FACTORY, INITIAL_AKITA), "approve official factory");
            pair = LSSVMPairERC1155ERC20(
                payable(IOfficialSudoswapV2Factory(OFFICIAL_FACTORY)
                        .createPairERC1155ERC20(
                            IOfficialSudoswapV2Factory.CreateERC1155ERC20PairParams({
                            token: address(akita),
                            nft: address(friendKey),
                            bondingCurve: address(curve),
                            assetRecipient: payable(address(0)),
                            poolType: uint8(LSSVMPair.PoolType.TRADE),
                            delta: VIRTUAL_KEY_RESERVE,
                            fee: PAIR_FEE,
                            spotPrice: VIRTUAL_AKITA_RESERVE,
                            nftId: ROOM_TOKEN_ID,
                            initialNFTBalance: INITIAL_KEYS,
                            initialTokenBalance: INITIAL_AKITA,
                            hookAddress: address(0),
                            referralAddress: address(0)
                        })
                        ))
            );
            friendKey.setApprovalForAll(OFFICIAL_FACTORY, false);
            assertTrue(akita.approve(OFFICIAL_FACTORY, 0), "revoke official factory");
            pair.transferOwnership(MARKET_ADMIN_SAFE, "");
            vm.stopPrank();
        }

        assertTrue(factory.isValidPair(address(pair)), "factory-authenticated pair");
        assertEq(pair.owner(), MARKET_ADMIN_SAFE, "Safe owns pair");
        assertEq(pair.delta(), VIRTUAL_KEY_RESERVE, "virtual key reserve");
        assertEq(pair.spotPrice(), VIRTUAL_AKITA_RESERVE, "virtual AKITA reserve");
        assertEq(pair.fee(), PAIR_FEE, "6.9 percent pair fee");
        assertEq(friendKey.balanceOf(address(pair), ROOM_TOKEN_ID), INITIAL_KEYS, "three keys seeded");
        if (usingProductionPair) {
            assertGe(akita.balanceOf(address(pair)), INITIAL_AKITA, "production pair AKITA inventory");
        } else {
            assertEq(akita.balanceOf(address(pair)), INITIAL_AKITA, "fifty million AKITA seeded");
        }
        if (!usingProductionPair) {
            assertEq(friendKey.balanceOf(CANONICAL_CSW, ROOM_TOKEN_ID), canonicalKeysBefore - INITIAL_KEYS);
        }
        assertFalse(friendKey.isApprovedForAll(CANONICAL_CSW, OFFICIAL_FACTORY), "factory key approval revoked");
        assertEq(akita.allowance(CANONICAL_CSW, OFFICIAL_FACTORY), 0, "factory token allowance revoked");

        vm.prank(MARKET_ADMIN_SAFE);
        adapter.setMarket(address(pair), AKITA, ROOM_TOKEN_ID, true);
        (address marketCoin, uint256 marketId, bool marketAllowed) = adapter.markets(address(pair));
        assertEq(marketCoin, AKITA, "market AKITA");
        assertEq(marketId, ROOM_TOKEN_ID, "market Room 1659");
        assertTrue(marketAllowed, "market enabled");

        (CurveErrorCodes.Error buyError,,, uint256 buyQuote,,) = pair.getBuyNFTQuote(ROOM_TOKEN_ID, 1);
        (CurveErrorCodes.Error sellError,,, uint256 sellQuote,,) = pair.getSellNFTQuote(ROOM_TOKEN_ID, 1);
        assertEq(uint256(buyError), uint256(CurveErrorCodes.Error.OK), "buy quote valid");
        assertEq(uint256(sellError), uint256(CurveErrorCodes.Error.OK), "sell quote valid");
        uint256 buyLimit = (buyQuote * 10_100 + 9_999) / 10_000;
        uint256 sellLimit = (sellQuote * 9_900) / 10_000;

        uint256 erc20AllowanceBefore = akita.allowance(CANONICAL_CSW, PERMIT2);
        (uint160 permitAmountBefore, uint48 permitExpirationBefore,) = permit2.allowance(CANONICAL_CSW, AKITA, ADAPTER);
        bool keyApprovalBefore = friendKey.isApprovedForAll(CANONICAL_CSW, ADAPTER);
        uint256 canonicalKeysBeforeRoundTrip = friendKey.balanceOf(CANONICAL_CSW, ROOM_TOKEN_ID);
        uint256 pairKeysBeforeRoundTrip = friendKey.balanceOf(address(pair), ROOM_TOKEN_ID);
        uint256 canonicalAkitaBeforeRoundTrip = akita.balanceOf(CANONICAL_CSW);
        uint128 deltaBeforeRoundTrip = pair.delta();
        uint128 spotPriceBeforeRoundTrip = pair.spotPrice();

        vm.startPrank(CANONICAL_CSW);
        if (erc20AllowanceBefore < buyLimit) {
            assertTrue(akita.approve(PERMIT2, buyLimit), "temporary Permit2 token approval");
        }
        permit2.approve(AKITA, ADAPTER, uint160(buyLimit), uint48(block.timestamp + 15 minutes));

        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(address(pair), CANONICAL_CSW, 1, buyLimit, true);
        router.execute(
            bytes.concat(bytes1(uint8(AlfaClubCommands.SUDOSWAP_ERC1155_BUY))), inputs, block.timestamp + 15 minutes
        );

        friendKey.setApprovalForAll(ADAPTER, true);
        inputs[0] = abi.encode(address(pair), CANONICAL_CSW, 1, sellLimit, true);
        router.execute(
            bytes.concat(bytes1(uint8(AlfaClubCommands.SUDOSWAP_ERC1155_SELL))), inputs, block.timestamp + 15 minutes
        );

        friendKey.setApprovalForAll(ADAPTER, keyApprovalBefore);
        permit2.approve(AKITA, ADAPTER, permitAmountBefore, permitExpirationBefore);
        assertTrue(akita.approve(PERMIT2, erc20AllowanceBefore), "restore Permit2 token approval");
        vm.stopPrank();

        assertEq(friendKey.balanceOf(CANONICAL_CSW, ROOM_TOKEN_ID), canonicalKeysBeforeRoundTrip, "CSW key restored");
        assertEq(friendKey.balanceOf(address(pair), ROOM_TOKEN_ID), pairKeysBeforeRoundTrip, "pair key restored");
        assertEq(pair.delta(), deltaBeforeRoundTrip, "virtual key reserve restored");
        assertEq(pair.spotPrice(), spotPriceBeforeRoundTrip, "virtual AKITA reserve restored");
        assertLt(akita.balanceOf(CANONICAL_CSW), canonicalAkitaBeforeRoundTrip, "round trip paid fees");
        assertEq(akita.allowance(CANONICAL_CSW, PERMIT2), erc20AllowanceBefore, "token approval restored");
        (uint160 permitAmountAfter, uint48 permitExpirationAfter,) = permit2.allowance(CANONICAL_CSW, AKITA, ADAPTER);
        assertEq(permitAmountAfter, permitAmountBefore, "Permit2 amount restored");
        if (permitExpirationBefore != 0) {
            assertEq(permitExpirationAfter, permitExpirationBefore, "Permit2 expiry restored");
        }
        assertEq(friendKey.isApprovedForAll(CANONICAL_CSW, ADAPTER), keyApprovalBefore, "key approval restored");
        assertEq(akita.balanceOf(ADAPTER), 0, "adapter AKITA residue");
        assertEq(friendKey.balanceOf(ADAPTER, ROOM_TOKEN_ID), 0, "adapter key residue");
    }
}
