// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";

import {AlfaCreatorKeyLPFactory} from "../../../contracts/alfaclub/AlfaCreatorKeyLPFactory.sol";
import {AlfaCreatorKeyPool} from "../../../contracts/alfaclub/AlfaCreatorKeyPool.sol";

contract MockCreatorCoin is ERC20 {
    constructor() ERC20("Creator Coin", "CREATOR") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockFriendKey is ERC1155Supply {
    mapping(uint256 => address) public creatorByTokenId;
    mapping(uint256 => uint8) public roomTypes;
    mapping(address => uint256) public bondingCurveReserves;
    mapping(uint256 => mapping(address => uint256)) public keyHoldingSince;

    mapping(uint256 => uint256) private sold;

    constructor() ERC1155("") {}

    function createRoom(uint256 tokenId, address creator, address recipient, uint256 amount) external {
        creatorByTokenId[tokenId] = creator;
        _mint(recipient, tokenId, amount, "");
    }

    function setRoomType(uint256 tokenId, uint8 roomType) external {
        roomTypes[tokenId] = roomType;
    }

    function mintKeys(address recipient, uint256 tokenId, uint256 amount) external {
        require(creatorByTokenId[tokenId] != address(0), "missing creator");
        _mint(recipient, tokenId, amount, "");
    }

    function getKeyHoldingSince(uint256 tokenId, address user) external view returns (uint256) {
        return keyHoldingSince[tokenId][user];
    }

    function setBondingCurveReserve(address creator, uint256 amount) external {
        bondingCurveReserves[creator] = amount;
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override(ERC1155Supply)
    {
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 tokenId = ids[i];
            sold[tokenId] += values[i];

            if (to != address(0) && values[i] > 0 && balanceOf(to, tokenId) == 0) {
                keyHoldingSince[tokenId][to] = block.timestamp;
            }

            if (from != address(0) && balanceOf(from, tokenId) == sold[tokenId]) {
                keyHoldingSince[tokenId][from] = 0;
            }
        }

        for (uint256 i = 0; i < ids.length; i++) {
            delete sold[ids[i]];
        }

        super._update(from, to, ids, values);
    }
}

contract MockFriendPool {
    mapping(uint256 => uint256) public poolReserves;

    function setReserve(uint256 tokenId, uint256 amount) external {
        poolReserves[tokenId] = amount;
    }
}

contract AlfaCreatorKeyLPTest is Test {
    address internal constant BASE_FRIEND_KEY = 0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F;

    MockCreatorCoin internal creatorCoin;
    MockFriendKey internal friendKey;
    MockFriendPool internal friendPool;
    AlfaCreatorKeyLPFactory internal factory;

    address internal owner = address(0xA11CE);
    address internal creator = address(0xCAFE);
    address internal lpCreator = address(0xBEEF);
    address internal lp2 = address(0xB0B);
    address internal trader = address(0xD00D);
    address internal recipient = address(0xF00D);

    uint256 internal constant TOKEN_ID = 1;
    uint256 internal constant INITIAL_KEYS = 10;
    uint256 internal constant INITIAL_CREATOR_COIN = 10_000 ether;

    function setUp() public {
        vm.warp(100);
        creatorCoin = new MockCreatorCoin();
        MockFriendKey friendKeyImplementation = new MockFriendKey();
        vm.etch(BASE_FRIEND_KEY, address(friendKeyImplementation).code);
        friendKey = MockFriendKey(BASE_FRIEND_KEY);
        friendPool = new MockFriendPool();
        factory = new AlfaCreatorKeyLPFactory(owner);

        friendKey.createRoom(TOKEN_ID, creator, creator, 1);
        friendKey.mintKeys(lpCreator, TOKEN_ID, 50);
        creatorCoin.mint(lpCreator, 1_000_000 ether);
        creatorCoin.mint(lp2, 1_000_000 ether);
        creatorCoin.mint(trader, 1_000_000 ether);

        vm.startPrank(owner);
        factory.setPoolCreatorAllowed(lpCreator, true);
        factory.setPairAllowed(address(creatorCoin), TOKEN_ID, true);
        vm.stopPrank();
    }

    function _createPool() internal returns (AlfaCreatorKeyPool pool) {
        vm.startPrank(lpCreator);
        creatorCoin.approve(address(factory), type(uint256).max);
        friendKey.setApprovalForAll(address(factory), true);
        address poolAddress = factory.createPoolWithInitialLiquidity(
            address(creatorCoin), TOKEN_ID, INITIAL_KEYS, INITIAL_CREATOR_COIN, lpCreator
        );
        vm.stopPrank();
        pool = AlfaCreatorKeyPool(poolAddress);
    }

    function testFactoryUsesFixedBaseFriendKey() public view {
        assertEq(factory.friendKey(), BASE_FRIEND_KEY);
    }

    function testFactoryRequiresPoolCreatorAllowlist() public {
        vm.prank(owner);
        factory.setPoolCreatorAllowed(lpCreator, false);

        vm.startPrank(lpCreator);
        creatorCoin.approve(address(factory), type(uint256).max);
        friendKey.setApprovalForAll(address(factory), true);
        vm.expectRevert(abi.encodeWithSelector(AlfaCreatorKeyLPFactory.PoolCreatorNotAllowed.selector, lpCreator));
        factory.createPoolWithInitialLiquidity(address(creatorCoin), TOKEN_ID, 1, 1 ether, lpCreator);
        vm.stopPrank();
    }

    function testFactoryRequiresPairAllowlist() public {
        vm.prank(owner);
        factory.setPairAllowed(address(creatorCoin), TOKEN_ID, false);

        vm.prank(lpCreator);
        vm.expectRevert(
            abi.encodeWithSelector(AlfaCreatorKeyLPFactory.PairNotAllowed.selector, address(creatorCoin), TOKEN_ID)
        );
        factory.createPoolWithInitialLiquidity(address(creatorCoin), TOKEN_ID, 1, 1 ether, lpCreator);
    }

    function testFactoryRejectsDuplicatePool() public {
        _createPool();

        vm.startPrank(lpCreator);
        vm.expectRevert(
            abi.encodeWithSelector(AlfaCreatorKeyLPFactory.PoolAlreadyExists.selector, address(creatorCoin), TOKEN_ID)
        );
        factory.createPoolWithInitialLiquidity(address(creatorCoin), TOKEN_ID, 1, 1 ether, lpCreator);
        vm.stopPrank();
    }

    function testFactoryRejectsInvalidFriendKeyTokenId() public {
        uint256 invalidTokenId = 999;
        vm.prank(owner);
        factory.setPairAllowed(address(creatorCoin), invalidTokenId, true);

        vm.prank(lpCreator);
        vm.expectRevert(
            abi.encodeWithSelector(AlfaCreatorKeyLPFactory.FriendKeyCreatorMissing.selector, invalidTokenId)
        );
        factory.createPoolWithInitialLiquidity(address(creatorCoin), invalidTokenId, 1, 1 ether, lpCreator);
    }

    function testCreatePoolMintsLpSharesAndStoresPool() public {
        AlfaCreatorKeyPool pool = _createPool();

        assertEq(factory.getPool(address(creatorCoin), TOKEN_ID), address(pool));
        assertEq(factory.allPoolsLength(), 1);
        assertGt(pool.totalSupply(), 0);
        assertEq(pool.balanceOf(lpCreator), pool.totalSupply());

        (uint256 creatorReserve, uint256 keyReserve) = pool.getReserves();
        assertEq(creatorReserve, INITIAL_CREATOR_COIN);
        assertEq(keyReserve, INITIAL_KEYS);
    }

    function testReceiverRejectsWrongFriendKeyWrongTokenIdAndBatchTransfers() public {
        AlfaCreatorKeyPool pool = _createPool();

        MockFriendKey otherFriendKey = new MockFriendKey();
        otherFriendKey.createRoom(2, creator, trader, 1);
        vm.prank(trader);
        vm.expectRevert(AlfaCreatorKeyPool.WrongFriendKey.selector);
        otherFriendKey.safeTransferFrom(trader, address(pool), 2, 1, "");

        friendKey.createRoom(2, creator, trader, 1);
        vm.prank(trader);
        vm.expectRevert(abi.encodeWithSelector(AlfaCreatorKeyPool.WrongTokenId.selector, 2));
        friendKey.safeTransferFrom(trader, address(pool), 2, 1, "");

        // OpenZeppelin's ERC1155 routes single-element batches through
        // `onERC1155Received`, so use a true multi-id batch to actually exercise
        // `onERC1155BatchReceived` on the pool.
        uint256 secondTokenId = 3;
        friendKey.createRoom(secondTokenId, creator, lpCreator, 1);
        uint256[] memory ids = new uint256[](2);
        ids[0] = TOKEN_ID;
        ids[1] = secondTokenId;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1;
        amounts[1] = 1;
        vm.prank(lpCreator);
        vm.expectRevert(AlfaCreatorKeyPool.BatchTransfersUnsupported.selector);
        friendKey.safeBatchTransferFrom(lpCreator, address(pool), ids, amounts, "");
    }

    function testAddAndRemoveLiquidityUsesLpShareAccounting() public {
        AlfaCreatorKeyPool pool = _createPool();

        vm.startPrank(lp2);
        friendKey.mintKeys(lp2, TOKEN_ID, 5);
        friendKey.setApprovalForAll(address(pool), true);
        creatorCoin.approve(address(pool), type(uint256).max);

        // Add enough keys that a half-share burn still rounds to >=1 whole key
        // out (keys are unitary integers in this pool by design).
        (uint256 requiredCreatorCoin, uint256 quotedShares) = pool.quoteAddLiquidity(4);
        assertEq(requiredCreatorCoin, 4_000 ether);
        assertGt(quotedShares, 0);

        (uint256 paid, uint256 minted) = pool.addLiquidity(4, requiredCreatorCoin, quotedShares, lp2);
        assertEq(paid, requiredCreatorCoin);
        assertEq(minted, quotedShares);
        assertEq(pool.balanceOf(lp2), quotedShares);

        uint256 sharesToBurn = quotedShares / 2;
        (uint256 creatorOut, uint256 keysOut) = pool.removeLiquidity(sharesToBurn, 0, 1, lp2);
        vm.stopPrank();

        assertGt(creatorOut, 0);
        assertGt(keysOut, 0);
        assertEq(pool.balanceOf(lp2), quotedShares - sharesToBurn);
    }

    function testBuyAndSellKeysDoNotTouchFriendKeyPrimaryCurveOrFriendPoolReserves() public {
        AlfaCreatorKeyPool pool = _createPool();

        uint256 supplyBefore = friendKey.totalSupply(TOKEN_ID);
        friendKey.setBondingCurveReserve(creator, 123 ether);
        friendPool.setReserve(TOKEN_ID, 456 ether);

        uint256 buyQuote = pool.quoteBuyKeys(1);
        assertGt(buyQuote, 0);

        vm.startPrank(trader);
        creatorCoin.approve(address(pool), type(uint256).max);
        pool.buyKeys(1, buyQuote, trader);
        vm.stopPrank();

        assertEq(friendKey.balanceOf(trader, TOKEN_ID), 1);
        assertGt(friendKey.getKeyHoldingSince(TOKEN_ID, trader), 0);
        assertEq(friendKey.totalSupply(TOKEN_ID), supplyBefore);
        assertEq(friendKey.bondingCurveReserves(creator), 123 ether);
        assertEq(friendPool.poolReserves(TOKEN_ID), 456 ether);

        uint256 sellQuote = pool.quoteSellKeys(1);
        vm.startPrank(trader);
        friendKey.setApprovalForAll(address(pool), true);
        pool.sellKeys(1, sellQuote, recipient);
        vm.stopPrank();

        assertEq(friendKey.balanceOf(trader, TOKEN_ID), 0);
        assertEq(friendKey.getKeyHoldingSince(TOKEN_ID, trader), 0);
        assertEq(creatorCoin.balanceOf(recipient), sellQuote);
        assertEq(friendKey.totalSupply(TOKEN_ID), supplyBefore);
        assertEq(friendKey.bondingCurveReserves(creator), 123 ether);
        assertEq(friendPool.poolReserves(TOKEN_ID), 456 ether);
    }

    function testBuyKeysCannotDrainAllKeysAndHonorsSlippage() public {
        AlfaCreatorKeyPool pool = _createPool();
        vm.expectRevert(AlfaCreatorKeyPool.InsufficientReserves.selector);
        pool.quoteBuyKeys(INITIAL_KEYS);

        uint256 quote = pool.quoteBuyKeys(1);
        vm.startPrank(trader);
        creatorCoin.approve(address(pool), type(uint256).max);
        vm.expectRevert(AlfaCreatorKeyPool.SlippageExceeded.selector);
        pool.buyKeys(1, quote - 1, trader);
        vm.stopPrank();
    }

    function testSellKeysHonorsSlippage() public {
        AlfaCreatorKeyPool pool = _createPool();
        friendKey.mintKeys(trader, TOKEN_ID, 1);
        uint256 quote = pool.quoteSellKeys(1);

        vm.startPrank(trader);
        friendKey.setApprovalForAll(address(pool), true);
        vm.expectRevert(AlfaCreatorKeyPool.SlippageExceeded.selector);
        pool.sellKeys(1, quote + 1, trader);
        vm.stopPrank();
    }

    /// @dev Default-mocked room type is 0 (Trading) so the existing pool created
    /// in `_createPool` must wire up the legacy 690 bps fee.
    function testTradingPoolUsesTradingFee() public {
        AlfaCreatorKeyPool pool = _createPool();
        assertEq(pool.feeBps(), 690);
        assertEq(factory.TRADING_FEE_BPS(), 690);
    }

    /// @dev A Social room (roomTypes = 1) must spawn a pool with the 3 bps fee.
    function testSocialPoolUsesSocialFee() public {
        uint256 socialTokenId = 42;
        friendKey.createRoom(socialTokenId, creator, lpCreator, 1);
        friendKey.mintKeys(lpCreator, socialTokenId, 50);
        friendKey.setRoomType(socialTokenId, 1);

        vm.prank(owner);
        factory.setPairAllowed(address(creatorCoin), socialTokenId, true);

        vm.startPrank(lpCreator);
        creatorCoin.approve(address(factory), type(uint256).max);
        friendKey.setApprovalForAll(address(factory), true);
        address poolAddress = factory.createPoolWithInitialLiquidity(
            address(creatorCoin), socialTokenId, INITIAL_KEYS, INITIAL_CREATOR_COIN, lpCreator
        );
        vm.stopPrank();

        AlfaCreatorKeyPool socialPool = AlfaCreatorKeyPool(poolAddress);
        assertEq(socialPool.feeBps(), 3);
        assertEq(factory.SOCIAL_FEE_BPS(), 3);
    }

    /// @dev Same reserves: a Social pool quotes a smaller buy-in and a larger
    /// sell-out than a Trading pool. The fee tier is the only thing changing
    /// between the two pools so quote math has to differ in the expected
    /// direction (lower fee = better trade for the user).
    function testSocialAndTradingPoolsQuoteDifferentlyForSameReserves() public {
        AlfaCreatorKeyPool tradingPool = _createPool();

        uint256 socialTokenId = 7;
        friendKey.createRoom(socialTokenId, creator, lpCreator, 1);
        friendKey.mintKeys(lpCreator, socialTokenId, 50);
        friendKey.setRoomType(socialTokenId, 1);

        vm.prank(owner);
        factory.setPairAllowed(address(creatorCoin), socialTokenId, true);

        vm.startPrank(lpCreator);
        creatorCoin.approve(address(factory), type(uint256).max);
        friendKey.setApprovalForAll(address(factory), true);
        address socialAddress = factory.createPoolWithInitialLiquidity(
            address(creatorCoin), socialTokenId, INITIAL_KEYS, INITIAL_CREATOR_COIN, lpCreator
        );
        vm.stopPrank();
        AlfaCreatorKeyPool socialPool = AlfaCreatorKeyPool(socialAddress);

        // Reserves are identical between the two pools by construction.
        (uint256 tradingC, uint256 tradingK) = tradingPool.getReserves();
        (uint256 socialC, uint256 socialK) = socialPool.getReserves();
        assertEq(tradingC, socialC);
        assertEq(tradingK, socialK);

        // Buy: a Trading buyer pays MORE creator coin than a Social buyer.
        assertGt(tradingPool.quoteBuyKeys(1), socialPool.quoteBuyKeys(1));
        // Sell: a Trading seller receives LESS creator coin than a Social seller.
        assertLt(tradingPool.quoteSellKeys(1), socialPool.quoteSellKeys(1));
    }

    /// @dev An unsupported room type (>= 2) must revert pool creation with a
    /// clear custom error rather than silently defaulting to one of the fees.
    function testFactoryRejectsUnsupportedRoomType() public {
        uint256 weirdTokenId = 9001;
        friendKey.createRoom(weirdTokenId, creator, lpCreator, 1);
        friendKey.mintKeys(lpCreator, weirdTokenId, 50);
        friendKey.setRoomType(weirdTokenId, 2);

        vm.prank(owner);
        factory.setPairAllowed(address(creatorCoin), weirdTokenId, true);

        vm.startPrank(lpCreator);
        creatorCoin.approve(address(factory), type(uint256).max);
        friendKey.setApprovalForAll(address(factory), true);
        vm.expectRevert(
            abi.encodeWithSelector(AlfaCreatorKeyLPFactory.UnsupportedRoomType.selector, weirdTokenId, uint8(2))
        );
        factory.createPoolWithInitialLiquidity(
            address(creatorCoin), weirdTokenId, INITIAL_KEYS, INITIAL_CREATOR_COIN, lpCreator
        );
        vm.stopPrank();
    }

    /// @dev Pool deployed directly (bypassing the factory) cannot exceed the
    /// hard fee ceiling. Defends against a future factory bug that maps a
    /// new room type to an unreasonable fee.
    function testPoolRejectsFeeAboveMax() public {
        AlfaCreatorKeyPool tradingPool = _createPool();
        uint16 tooHigh = uint16(tradingPool.MAX_FEE_BPS()) + 1;

        vm.expectRevert(abi.encodeWithSelector(AlfaCreatorKeyPool.FeeBpsTooHigh.selector, tooHigh));
        new AlfaCreatorKeyPool(address(friendKey), address(creatorCoin), TOKEN_ID, tooHigh);
    }
}
