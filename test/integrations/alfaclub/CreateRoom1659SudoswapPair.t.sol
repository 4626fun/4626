// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {RoyaltyRegistry} from "lib/sudoswap-lssvm2/lib/royalty-registry-solidity/contracts/RoyaltyRegistry.sol";
import {IERC1155} from "lib/sudoswap-lssvm2/lib/openzeppelin-contracts/contracts/token/ERC1155/IERC1155.sol";
import {
    ERC1155Holder
} from "lib/sudoswap-lssvm2/lib/openzeppelin-contracts/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {ERC20} from "lib/sudoswap-lssvm2/lib/solmate/src/tokens/ERC20.sol";

import {LSSVMPairFactory} from "sudoswap/LSSVMPairFactory.sol";
import {LSSVMPair} from "sudoswap/LSSVMPair.sol";
import {RoyaltyEngine} from "sudoswap/RoyaltyEngine.sol";
import {XykCurve} from "sudoswap/bonding-curves/XykCurve.sol";
import {LSSVMPairERC1155ERC20} from "sudoswap/erc1155/LSSVMPairERC1155ERC20.sol";
import {LSSVMPairERC1155ETH} from "sudoswap/erc1155/LSSVMPairERC1155ETH.sol";
import {LSSVMPairERC721ERC20} from "sudoswap/erc721/LSSVMPairERC721ERC20.sol";
import {LSSVMPairERC721ETH} from "sudoswap/erc721/LSSVMPairERC721ETH.sol";
import {Test1155} from "sudoswap/mocks/Test1155.sol";
import {Test20} from "sudoswap/mocks/Test20.sol";

import {CreateRoom1659SudoswapPair} from "alfaclub/contracts/script/CreateRoom1659SudoswapPair.s.sol";

contract CreateRoom1659SudoswapPairHarness is CreateRoom1659SudoswapPair {
    function runWithConfig(PairConfig calldata config) external returns (LSSVMPairERC1155ERC20 pair) {
        pair = _run(config);
    }
}

contract Room1659TestCsw is ERC1155Holder {
    error CallFailed(uint256 index, bytes reason);

    struct Call {
        address target;
        bytes data;
    }

    function executeBatch(Call[] memory calls) external {
        for (uint256 i; i < calls.length; ++i) {
            (bool success, bytes memory result) = calls[i].target.call(calls[i].data);
            if (!success) revert CallFailed(i, result);
        }
    }
}

contract CreateRoom1659SudoswapPairTest is Test {
    uint256 private constant SEEDER_KEY = 0xA11CE;
    uint256 private constant INITIAL_KEY_BALANCE = 25;
    uint256 private constant INITIAL_CREATOR_COIN_BALANCE = 50_000 ether;
    uint256 private constant VIRTUAL_KEY_RESERVE = 1_000;
    uint256 private constant VIRTUAL_CREATOR_COIN_RESERVE = 50_000 ether;

    CreateRoom1659SudoswapPairHarness private script;
    LSSVMPairFactory private factory;
    XykCurve private xykCurve;
    Test1155 private friendKey;
    Test20 private creatorCoin;
    address private seeder;
    address private pairOwner;

    function setUp() public {
        vm.chainId(8453);
        script = new CreateRoom1659SudoswapPairHarness();
        seeder = vm.addr(SEEDER_KEY);
        pairOwner = makeAddr("pairOwner");

        RoyaltyRegistry royaltyRegistry = new RoyaltyRegistry(address(0));
        royaltyRegistry.initialize(address(this));
        RoyaltyEngine royaltyEngine = new RoyaltyEngine(address(royaltyRegistry));
        factory = new LSSVMPairFactory(
            new LSSVMPairERC721ETH(royaltyEngine),
            new LSSVMPairERC721ERC20(royaltyEngine),
            new LSSVMPairERC1155ETH(royaltyEngine),
            new LSSVMPairERC1155ERC20(royaltyEngine),
            payable(address(this)),
            0,
            address(this)
        );
        xykCurve = new XykCurve();
        factory.setBondingCurveAllowed(xykCurve, true);

        // The production script intentionally pins the live FriendKey and AKITA
        // addresses. Etching the official test-token runtimes at those exact
        // addresses lets this rehearsal execute the unmodified script path.
        Test1155 friendKeyRuntime = new Test1155();
        Test20 creatorCoinRuntime = new Test20();
        vm.etch(script.ALFA_CLUB_FRIEND_KEY(), address(friendKeyRuntime).code);
        vm.etch(script.AKITA_CREATOR_COIN(), address(creatorCoinRuntime).code);
        friendKey = Test1155(script.ALFA_CLUB_FRIEND_KEY());
        creatorCoin = Test20(script.AKITA_CREATOR_COIN());

        friendKey.mint(seeder, script.ROOM_TOKEN_ID(), INITIAL_KEY_BALANCE);
        creatorCoin.mint(seeder, INITIAL_CREATOR_COIN_BALANCE);
        vm.deal(seeder, 100 ether);
    }

    function testCreatesSeedsTransfersAndRevokesThroughProductionScript() public {
        LSSVMPairERC1155ERC20 pair = script.runWithConfig(_config(script.TRADING_PAIR_FEE()));

        assertTrue(factory.isValidPair(address(pair)), "factory-authenticated pair");
        assertEq(address(pair.factory()), address(factory), "factory");
        assertEq(address(pair.bondingCurve()), address(xykCurve), "XYK curve");
        assertEq(pair.nft(), address(friendKey), "FriendKey");
        assertEq(address(pair.token()), address(creatorCoin), "Creator Coin");
        assertEq(pair.nftId(), script.ROOM_TOKEN_ID(), "Room 1659 token ID");
        assertEq(pair.fee(), script.TRADING_PAIR_FEE(), "6.9% fee");
        assertEq(pair.owner(), pairOwner, "pair ownership");
        assertEq(friendKey.balanceOf(address(pair), script.ROOM_TOKEN_ID()), INITIAL_KEY_BALANCE, "seeded keys");
        assertEq(creatorCoin.balanceOf(address(pair)), INITIAL_CREATOR_COIN_BALANCE, "seeded Creator Coin");
        assertFalse(friendKey.isApprovedForAll(seeder, address(factory)), "ERC1155 approval revoked");
        assertEq(creatorCoin.allowance(seeder, address(factory)), 0, "ERC20 approval revoked");
    }

    function testRejectsFeeOtherThanExactRoomTradingFeeBeforeBroadcast() public {
        uint256 invalidFee = script.TRADING_PAIR_FEE() - 1;
        vm.expectRevert(
            abi.encodeWithSelector(
                CreateRoom1659SudoswapPair.InvalidAmount.selector, "PAIR_FEE must equal 0.069e18 (690 bps)"
            )
        );
        script.runWithConfig(_config(invalidFee));

        assertEq(vm.getNonce(seeder), 0, "no broadcast transaction");
        assertEq(friendKey.balanceOf(seeder, script.ROOM_TOKEN_ID()), INITIAL_KEY_BALANCE, "keys untouched");
        assertEq(creatorCoin.balanceOf(seeder), INITIAL_CREATOR_COIN_BALANCE, "Creator Coin untouched");
    }

    function testRejectsContractAddressOnPrivateKeySeederPath() public {
        vm.etch(seeder, hex"60006000f3");
        assertGt(seeder.code.length, 0, "contract seeder test fixture");
        uint256 pairFee = script.TRADING_PAIR_FEE();

        vm.expectRevert(abi.encodeWithSelector(CreateRoom1659SudoswapPair.InvalidAddress.selector, "seeder EOA"));
        script.runWithConfig(_config(pairFee));
    }

    function testCanonicalContractWalletCanSeedAtomicallyThenTransferPairOwnership() public {
        Room1659TestCsw canonicalCsw = new Room1659TestCsw();
        Room1659TestCsw adminSafe = new Room1659TestCsw();
        friendKey.mint(address(canonicalCsw), script.ROOM_TOKEN_ID(), INITIAL_KEY_BALANCE);
        creatorCoin.mint(address(canonicalCsw), INITIAL_CREATOR_COIN_BALANCE);

        LSSVMPairFactory.CreateERC1155ERC20PairParams memory params = LSSVMPairFactory.CreateERC1155ERC20PairParams({
            token: creatorCoin,
            nft: friendKey,
            bondingCurve: xykCurve,
            assetRecipient: payable(address(0)),
            poolType: LSSVMPair.PoolType.TRADE,
            delta: uint128(VIRTUAL_KEY_RESERVE),
            fee: uint96(script.TRADING_PAIR_FEE()),
            spotPrice: uint128(VIRTUAL_CREATOR_COIN_RESERVE),
            nftId: script.ROOM_TOKEN_ID(),
            initialNFTBalance: INITIAL_KEY_BALANCE,
            initialTokenBalance: INITIAL_CREATOR_COIN_BALANCE
        });

        Room1659TestCsw.Call[] memory createCalls = new Room1659TestCsw.Call[](5);
        createCalls[0] = Room1659TestCsw.Call({
            target: address(friendKey), data: abi.encodeCall(IERC1155.setApprovalForAll, (address(factory), true))
        });
        createCalls[1] = Room1659TestCsw.Call({
            target: address(creatorCoin),
            data: abi.encodeCall(ERC20.approve, (address(factory), INITIAL_CREATOR_COIN_BALANCE))
        });
        createCalls[2] = Room1659TestCsw.Call({
            target: address(factory), data: abi.encodeCall(LSSVMPairFactory.createPairERC1155ERC20, (params))
        });
        createCalls[3] = Room1659TestCsw.Call({
            target: address(friendKey), data: abi.encodeCall(IERC1155.setApprovalForAll, (address(factory), false))
        });
        createCalls[4] = Room1659TestCsw.Call({
            target: address(creatorCoin), data: abi.encodeCall(ERC20.approve, (address(factory), 0))
        });

        address predictedPair = vm.computeCreateAddress(address(factory), vm.getNonce(address(factory)));
        canonicalCsw.executeBatch(createCalls);
        LSSVMPairERC1155ERC20 pair = LSSVMPairERC1155ERC20(payable(predictedPair));

        assertTrue(factory.isValidPair(address(pair)), "factory-authenticated pair");
        assertEq(pair.owner(), address(canonicalCsw), "CSW owns pair after create batch");
        assertEq(friendKey.balanceOf(address(pair), script.ROOM_TOKEN_ID()), INITIAL_KEY_BALANCE, "seeded keys");
        assertEq(creatorCoin.balanceOf(address(pair)), INITIAL_CREATOR_COIN_BALANCE, "seeded Creator Coin");
        assertFalse(friendKey.isApprovedForAll(address(canonicalCsw), address(factory)), "ERC1155 approval revoked");
        assertEq(creatorCoin.allowance(address(canonicalCsw), address(factory)), 0, "ERC20 approval revoked");

        Room1659TestCsw.Call[] memory transferCalls = new Room1659TestCsw.Call[](1);
        transferCalls[0] = Room1659TestCsw.Call({
            target: address(pair),
            data: abi.encodeWithSignature("transferOwnership(address,bytes)", address(adminSafe), bytes(""))
        });
        canonicalCsw.executeBatch(transferCalls);

        assertEq(pair.owner(), address(adminSafe), "admin Safe owns pair after verified second phase");
    }

    function _config(uint256 pairFee) private view returns (CreateRoom1659SudoswapPair.PairConfig memory config) {
        config = CreateRoom1659SudoswapPair.PairConfig({
            privateKey: SEEDER_KEY,
            factory: factory,
            xykCurve: xykCurve,
            pairOwner: pairOwner,
            initialKeyBalance: INITIAL_KEY_BALANCE,
            initialCreatorCoinBalance: INITIAL_CREATOR_COIN_BALANCE,
            virtualKeyReserve: VIRTUAL_KEY_RESERVE,
            virtualCreatorCoinReserve: VIRTUAL_CREATOR_COIN_RESERVE,
            pairFee: pairFee
        });
    }
}
