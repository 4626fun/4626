// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

import {IERC1155} from "lib/sudoswap-lssvm2/lib/openzeppelin-contracts/contracts/token/ERC1155/IERC1155.sol";
import {ERC20} from "lib/sudoswap-lssvm2/lib/solmate/src/tokens/ERC20.sol";

import {ILSSVMPairFactoryLike} from "sudoswap/ILSSVMPairFactoryLike.sol";
import {LSSVMPair} from "sudoswap/LSSVMPair.sol";
import {LSSVMPairERC20} from "sudoswap/LSSVMPairERC20.sol";
import {LSSVMPairFactory} from "sudoswap/LSSVMPairFactory.sol";
import {ICurve} from "sudoswap/bonding-curves/ICurve.sol";
import {LSSVMPairERC1155} from "sudoswap/erc1155/LSSVMPairERC1155.sol";
import {LSSVMPairERC1155ERC20} from "sudoswap/erc1155/LSSVMPairERC1155ERC20.sol";
import {IOfficialSudoswapV2Factory} from "contracts/other/alfaclub/sudoswap/IOfficialSudoswapV2Factory.sol";

/**
 * @title CreateRoom1659SudoswapPair
 * @notice Seeds the canonical AlfaClub room 1659 FriendKey / AKITA Creator
 *         Coin market in the official Sudoswap v2 ERC-1155/ERC-20 factory.
 * @dev The pair contract itself is the LP position and is transferred to
 *      PAIR_OWNER after creation. Sudoswap does not mint ERC-20 LP shares.
 *
 * Required environment variables:
 * - PRIVATE_KEY: EOA holding the initial FriendKeys and Creator Coins. This is
 *   a rehearsal/fallback path, not the production canonical-CSW path. When the
 *   assets are held by CANONICAL_CSW_ADDRESS, use
 *   `ops:alfaclub-sudoswap-seed-csw` so the CSW remains the sender.
 * - SUDOSWAP_PAIR_FACTORY: official LSSVMPairFactory deployed on Base.
 * - SUDOSWAP_XYK_CURVE: allowlisted official XykCurve.
 * - PAIR_OWNER: final owner of the pair/LP position.
 * - INITIAL_KEY_BALANCE: room keys transferred into the pair.
 * - INITIAL_CREATOR_COIN_BALANCE: Creator Coins transferred into the pair.
 * - VIRTUAL_KEY_RESERVE: XYK virtual ERC-1155 reserve (`delta`).
 * - VIRTUAL_CREATOR_COIN_RESERVE: XYK virtual ERC-20 reserve (`spotPrice`).
 * - PAIR_FEE: must equal the Room 1659 Trading-room fee, 0.069e18
 *   (690 basis points / 6.9%).
 */
contract CreateRoom1659SudoswapPair is Script {
    uint256 internal constant BASE_CHAIN_ID = 8453;
    address internal constant OFFICIAL_BASE_FACTORY = 0x605145D263482684590f630E9e581B21E4938eb8;

    address public constant ALFA_CLUB_FRIEND_KEY = 0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F;
    address public constant AKITA_CREATOR_COIN = 0x5b674196812451B7cEC024FE9d22D2c0b172fa75;
    uint256 public constant ROOM_TOKEN_ID = 1659;
    uint256 public constant TRADING_PAIR_FEE = 69_000_000_000_000_000;

    error InvalidAddress(string field);
    error InvalidAmount(string field);
    error RefusingNonBaseDeployment(uint256 chainId);
    error PostCreateInvariantFailed(string invariant);

    struct PairConfig {
        uint256 privateKey;
        LSSVMPairFactory factory;
        ICurve xykCurve;
        address pairOwner;
        uint256 initialKeyBalance;
        uint256 initialCreatorCoinBalance;
        uint256 virtualKeyReserve;
        uint256 virtualCreatorCoinReserve;
        uint256 pairFee;
    }

    function run() external returns (LSSVMPairERC1155ERC20 pair) {
        PairConfig memory config = PairConfig({
            privateKey: vm.envUint("PRIVATE_KEY"),
            factory: LSSVMPairFactory(payable(vm.envAddress("SUDOSWAP_PAIR_FACTORY"))),
            xykCurve: ICurve(vm.envAddress("SUDOSWAP_XYK_CURVE")),
            pairOwner: vm.envAddress("PAIR_OWNER"),
            initialKeyBalance: vm.envUint("INITIAL_KEY_BALANCE"),
            initialCreatorCoinBalance: vm.envUint("INITIAL_CREATOR_COIN_BALANCE"),
            virtualKeyReserve: vm.envUint("VIRTUAL_KEY_RESERVE"),
            virtualCreatorCoinReserve: vm.envUint("VIRTUAL_CREATOR_COIN_RESERVE"),
            pairFee: vm.envUint("PAIR_FEE")
        });
        pair = _run(config);
    }

    /// @dev Typed core used by `run()` and by the local deployment rehearsal.
    /// Keeping environment reads at the external boundary avoids process-global
    /// Foundry environment races without changing the broadcast path.
    function _run(PairConfig memory config) internal returns (LSSVMPairERC1155ERC20 pair) {
        if (block.chainid != BASE_CHAIN_ID) revert RefusingNonBaseDeployment(block.chainid);

        address seeder = vm.addr(config.privateKey);

        if (seeder.code.length != 0) revert InvalidAddress("seeder EOA");

        if (address(config.factory) == address(0)) revert InvalidAddress("SUDOSWAP_PAIR_FACTORY");
        if (address(config.xykCurve) == address(0)) revert InvalidAddress("SUDOSWAP_XYK_CURVE");
        if (config.pairOwner == address(0)) revert InvalidAddress("PAIR_OWNER");
        if (address(config.factory).code.length == 0) {
            revert InvalidAddress("SUDOSWAP_PAIR_FACTORY code");
        }
        if (address(config.xykCurve).code.length == 0) revert InvalidAddress("SUDOSWAP_XYK_CURVE code");
        if (ALFA_CLUB_FRIEND_KEY.code.length == 0) revert InvalidAddress("FriendKey code");
        if (AKITA_CREATOR_COIN.code.length == 0) revert InvalidAddress("Creator Coin code");

        if (config.initialKeyBalance == 0) revert InvalidAmount("INITIAL_KEY_BALANCE");
        if (config.initialCreatorCoinBalance == 0) {
            revert InvalidAmount("INITIAL_CREATOR_COIN_BALANCE");
        }
        if (config.virtualKeyReserve <= 1 || config.virtualKeyReserve > type(uint128).max) {
            revert InvalidAmount("VIRTUAL_KEY_RESERVE");
        }
        if (config.virtualCreatorCoinReserve == 0 || config.virtualCreatorCoinReserve > type(uint128).max) {
            revert InvalidAmount("VIRTUAL_CREATOR_COIN_RESERVE");
        }
        if (config.pairFee != TRADING_PAIR_FEE) {
            revert InvalidAmount("PAIR_FEE must equal 0.069e18 (690 bps)");
        }
        if (!config.factory.bondingCurveAllowed(config.xykCurve)) {
            revert PostCreateInvariantFailed("XYK curve not allowlisted");
        }

        IERC1155 friendKey = IERC1155(ALFA_CLUB_FRIEND_KEY);
        ERC20 creatorCoin = ERC20(AKITA_CREATOR_COIN);

        console2.log("Seeder", seeder);
        console2.log("Factory", address(config.factory));
        console2.log("XYK curve", address(config.xykCurve));
        console2.log("Pair owner", config.pairOwner);
        console2.log("Initial keys", config.initialKeyBalance);
        console2.log("Initial Creator Coins", config.initialCreatorCoinBalance);

        vm.startBroadcast(config.privateKey);

        friendKey.setApprovalForAll(address(config.factory), true);
        creatorCoin.approve(address(config.factory), config.initialCreatorCoinBalance);

        if (address(config.factory) == OFFICIAL_BASE_FACTORY) {
            pair = LSSVMPairERC1155ERC20(
                payable(IOfficialSudoswapV2Factory(address(config.factory))
                        .createPairERC1155ERC20(
                            IOfficialSudoswapV2Factory.CreateERC1155ERC20PairParams({
                            token: address(creatorCoin),
                            nft: address(friendKey),
                            bondingCurve: address(config.xykCurve),
                            assetRecipient: payable(address(0)),
                            poolType: uint8(LSSVMPair.PoolType.TRADE),
                            delta: uint128(config.virtualKeyReserve),
                            fee: uint96(config.pairFee),
                            spotPrice: uint128(config.virtualCreatorCoinReserve),
                            nftId: ROOM_TOKEN_ID,
                            initialNFTBalance: config.initialKeyBalance,
                            initialTokenBalance: config.initialCreatorCoinBalance,
                            hookAddress: address(0),
                            referralAddress: address(0)
                        })
                        ))
            );
        } else {
            pair = config.factory
                .createPairERC1155ERC20(
                    LSSVMPairFactory.CreateERC1155ERC20PairParams({
                        token: creatorCoin,
                        nft: friendKey,
                        bondingCurve: config.xykCurve,
                        assetRecipient: payable(address(0)),
                        poolType: LSSVMPair.PoolType.TRADE,
                        // Bounds checked before broadcasting.
                        // forge-lint: disable-next-line(unsafe-typecast)
                        delta: uint128(config.virtualKeyReserve),
                        // PAIR_FEE is required to equal the uint96-safe constant TRADING_PAIR_FEE.
                        // forge-lint: disable-next-line(unsafe-typecast)
                        fee: uint96(config.pairFee),
                        // forge-lint: disable-next-line(unsafe-typecast)
                        spotPrice: uint128(config.virtualCreatorCoinReserve),
                        nftId: ROOM_TOKEN_ID,
                        initialNFTBalance: config.initialKeyBalance,
                        initialTokenBalance: config.initialCreatorCoinBalance
                    })
                );
        }

        friendKey.setApprovalForAll(address(config.factory), false);
        creatorCoin.approve(address(config.factory), 0);
        pair.transferOwnership(config.pairOwner, "");

        vm.stopBroadcast();

        _validatePair(
            pair,
            config.factory,
            config.xykCurve,
            friendKey,
            creatorCoin,
            seeder,
            config.pairOwner,
            config.initialKeyBalance,
            config.initialCreatorCoinBalance
        );

        console2.log("Room 1659 Sudoswap pair", address(pair));
    }

    function _validatePair(
        LSSVMPairERC1155ERC20 pair,
        LSSVMPairFactory factory,
        ICurve xykCurve,
        IERC1155 friendKey,
        ERC20 creatorCoin,
        address seeder,
        address pairOwner,
        uint256 initialKeyBalance,
        uint256 initialCreatorCoinBalance
    ) internal view {
        if (!factory.isValidPair(address(pair))) {
            revert PostCreateInvariantFailed("invalid pair clone");
        }
        if (pair.pairVariant() != ILSSVMPairFactoryLike.PairVariant.ERC1155_ERC20) {
            revert PostCreateInvariantFailed("pair variant");
        }
        if (address(pair.factory()) != address(factory)) {
            revert PostCreateInvariantFailed("factory");
        }
        if (address(pair.bondingCurve()) != address(xykCurve)) {
            revert PostCreateInvariantFailed("bonding curve");
        }
        if (pair.nft() != address(friendKey)) revert PostCreateInvariantFailed("FriendKey");
        if (address(LSSVMPairERC20(address(pair)).token()) != address(creatorCoin)) {
            revert PostCreateInvariantFailed("Creator Coin");
        }
        if (LSSVMPairERC1155(address(pair)).nftId() != ROOM_TOKEN_ID) {
            revert PostCreateInvariantFailed("room token ID");
        }
        if (pair.poolType() != LSSVMPair.PoolType.TRADE) {
            revert PostCreateInvariantFailed("pool type");
        }
        if (pair.fee() != TRADING_PAIR_FEE) revert PostCreateInvariantFailed("pair fee");
        if (pair.owner() != pairOwner) revert PostCreateInvariantFailed("pair owner");
        if (friendKey.balanceOf(address(pair), ROOM_TOKEN_ID) != initialKeyBalance) {
            revert PostCreateInvariantFailed("initial key balance");
        }
        if (creatorCoin.balanceOf(address(pair)) != initialCreatorCoinBalance) {
            revert PostCreateInvariantFailed("initial Creator Coin balance");
        }
        if (friendKey.isApprovedForAll(seeder, address(factory))) {
            revert PostCreateInvariantFailed("FriendKey approval not revoked");
        }
        if (creatorCoin.allowance(seeder, address(factory)) != 0) {
            revert PostCreateInvariantFailed("Creator Coin approval not revoked");
        }
    }
}
