// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";

import {AlfaCreatorKeyLPFactory} from "../../../contracts/alfaclub/AlfaCreatorKeyLPFactory.sol";
import {AlfaCreatorKeyPool} from "../../../contracts/alfaclub/AlfaCreatorKeyPool.sol";

contract VanillaCreatorCoin is ERC20 {
    constructor() ERC20("Creator Coin", "CREATOR") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

// Burns a fixed bps fee from the recipient on every transfer (fee-on-transfer).
contract FeeOnTransferCreatorCoin is ERC20 {
    uint256 public feeBps;

    constructor(uint256 _feeBps) ERC20("Fee Creator Coin", "FCREATOR") {
        feeBps = _feeBps;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setFeeBps(uint256 _feeBps) external {
        feeBps = _feeBps;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0) || feeBps == 0) {
            super._update(from, to, value);
            return;
        }
        uint256 fee = (value * feeBps) / 10_000;
        super._update(from, to, value - fee);
        if (fee > 0) {
            super._update(from, address(0xdead), fee);
        }
    }
}

// Taxes the SENDER on every transfer: recipient still gets the full `value`,
// but an additional `fee` is burnt from the sender's balance. This is the
// pathological shape that can leave a pool's stored reserves overstated
// relative to its live balance if the contract only checks the recipient's
// credit when pushing creator coin out.
contract SenderFeeCreatorCoin is ERC20 {
    uint256 public feeBps;

    constructor(uint256 _feeBps) ERC20("Sender Fee Coin", "SFCREATOR") {
        feeBps = _feeBps;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setFeeBps(uint256 _feeBps) external {
        feeBps = _feeBps;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0) || feeBps == 0) {
            super._update(from, to, value);
            return;
        }
        // Recipient is credited the full quoted amount...
        super._update(from, to, value);
        // ...but the sender is debited an extra fee on top.
        uint256 fee = (value * feeBps) / 10_000;
        if (fee > 0) {
            super._update(from, address(0xdead), fee);
        }
    }
}

contract MockFriendKey is ERC1155Supply {
    mapping(uint256 => address) public creatorByTokenId;
    mapping(uint256 => uint8) public roomTypes;
    mapping(uint256 => mapping(address => uint256)) public keyHoldingSince;

    mapping(uint256 => uint256) private sold;

    constructor() ERC1155("") {}

    function createRoom(uint256 tokenId, address creator, address recipient, uint256 amount) external {
        creatorByTokenId[tokenId] = creator;
        _mint(recipient, tokenId, amount, "");
    }

    function mintKeys(address recipient, uint256 tokenId, uint256 amount) external {
        require(creatorByTokenId[tokenId] != address(0), "missing creator");
        _mint(recipient, tokenId, amount, "");
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

abstract contract AlfaPoolSecurityBase is Test {
    address internal constant BASE_FRIEND_KEY = 0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F;

    MockFriendKey internal friendKey;
    AlfaCreatorKeyLPFactory internal factory;

    address internal owner = address(0xA11CE);
    address internal creator = address(0xCAFE);
    address internal lpCreator = address(0xBEEF);
    address internal attacker = address(0xBAD);
    address internal victim = address(0xC0DE);
    address internal trader = address(0xD00D);
    address internal recipient = address(0xF00D);

    uint256 internal constant TOKEN_ID = 1;
    // Initial liquidity sized so subsequent LP additions/removals stay > 0 even
    // after integer-divisional rounding. INITIAL_KEYS large enough to allow
    // proportional 1-key removals without rounding to zero.
    uint256 internal constant INITIAL_KEYS = 1_000;
    uint256 internal constant INITIAL_CREATOR_COIN = 1_000_000 ether;

    function _setupCommon() internal {
        vm.warp(100);
        MockFriendKey friendKeyImplementation = new MockFriendKey();
        vm.etch(BASE_FRIEND_KEY, address(friendKeyImplementation).code);
        friendKey = MockFriendKey(BASE_FRIEND_KEY);
        factory = new AlfaCreatorKeyLPFactory(owner);
        friendKey.createRoom(TOKEN_ID, creator, creator, 1);

        vm.startPrank(owner);
        factory.setPoolCreatorAllowed(lpCreator, true);
        vm.stopPrank();
    }
}

contract AlfaPoolDonationSecurityTest is AlfaPoolSecurityBase {
    VanillaCreatorCoin internal creatorCoin;

    function setUp() public {
        _setupCommon();
        creatorCoin = new VanillaCreatorCoin();
        vm.prank(owner);
        factory.setPairAllowed(address(creatorCoin), TOKEN_ID, true);

        friendKey.mintKeys(lpCreator, TOKEN_ID, 5_000);
        friendKey.mintKeys(victim, TOKEN_ID, 1_000);
        friendKey.mintKeys(attacker, TOKEN_ID, 1_000);
        creatorCoin.mint(lpCreator, 100_000_000 ether);
        creatorCoin.mint(victim, 100_000_000 ether);
        creatorCoin.mint(attacker, 100_000_000 ether);
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

    /// @dev A direct creatorCoin donation to the pool before a victim addLiquidity()
    /// must not change the quote or the LP shares the victim receives.
    function testCreatorCoinDonationDoesNotDiluteVictimShares() public {
        AlfaCreatorKeyPool pool = _createPool();

        // Capture quote BEFORE attacker donation.
        (uint256 reqCreatorBefore, uint256 quotedSharesBefore) = pool.quoteAddLiquidity(10);

        // Attacker dumps a large unsolicited creatorCoin balance into the pool.
        vm.prank(attacker);
        creatorCoin.transfer(address(pool), 5_000_000 ether);

        (uint256 reqCreatorAfter, uint256 quotedSharesAfter) = pool.quoteAddLiquidity(10);
        assertEq(reqCreatorAfter, reqCreatorBefore, "donation must not change required creator coin");
        assertEq(quotedSharesAfter, quotedSharesBefore, "donation must not change minted shares");

        // Victim adds with strict slippage matching pre-donation expectations.
        vm.startPrank(victim);
        creatorCoin.approve(address(pool), type(uint256).max);
        friendKey.setApprovalForAll(address(pool), true);
        (uint256 paid, uint256 minted) = pool.addLiquidity(10, reqCreatorBefore, quotedSharesBefore, victim);
        vm.stopPrank();

        assertEq(paid, reqCreatorBefore);
        assertEq(minted, quotedSharesBefore);
    }

    /// @dev A direct friendKey (ERC1155) donation must not change the quote either.
    function testKeyDonationDoesNotDiluteVictimShares() public {
        AlfaCreatorKeyPool pool = _createPool();

        (uint256 reqCreatorBefore, uint256 quotedSharesBefore) = pool.quoteAddLiquidity(10);

        // The pool's onERC1155Received only accepts the configured friendKey/tokenId.
        // A real donation must therefore go through the legitimate transfer path —
        // emulate that by transferring keys to the pool from an existing holder.
        vm.prank(attacker);
        friendKey.safeTransferFrom(attacker, address(pool), TOKEN_ID, 500, "");

        (uint256 reqCreatorAfter, uint256 quotedSharesAfter) = pool.quoteAddLiquidity(10);
        assertEq(reqCreatorAfter, reqCreatorBefore, "key donation must not change required creator coin");
        assertEq(quotedSharesAfter, quotedSharesBefore, "key donation must not change minted shares");

        vm.startPrank(victim);
        creatorCoin.approve(address(pool), type(uint256).max);
        friendKey.setApprovalForAll(address(pool), true);
        (, uint256 minted) = pool.addLiquidity(10, reqCreatorBefore, quotedSharesBefore, victim);
        vm.stopPrank();
        assertEq(minted, quotedSharesBefore);
    }

    /// @dev Full inflation-via-donation exploit: attacker LPs first, donates, waits for
    /// victim addLiquidity(), then removeLiquidity() to capture victim deposit. After
    /// the fix, the attacker must not net more value than they put in (no profit).
    function testInflationViaDonationExploitIsUnprofitable() public {
        AlfaCreatorKeyPool pool = _createPool();

        // Attacker becomes a small LP first.
        vm.startPrank(attacker);
        creatorCoin.approve(address(pool), type(uint256).max);
        friendKey.setApprovalForAll(address(pool), true);
        (uint256 attackerCreatorIn, uint256 attackerShares) = pool.addLiquidity(20, type(uint256).max, 0, attacker);
        vm.stopPrank();
        // Attacker keys deposited (the addLiquidity pulled both creator coin and 20 keys).
        uint256 attackerKeysIn = 20;

        // Snapshot attacker's wallet so we can compare net P&L at the end.
        uint256 attackerCreatorAfterAdd = creatorCoin.balanceOf(attacker);
        uint256 attackerKeysAfterAdd = friendKey.balanceOf(attacker, TOKEN_ID);

        // Attacker donates a huge amount of creatorCoin directly to the pool, hoping
        // to inflate `getReserves()` and dilute the victim's share quote.
        uint256 donation = 10_000_000 ether;
        vm.prank(attacker);
        creatorCoin.transfer(address(pool), donation);

        // Victim adds liquidity with the same loose slippage parameters they would
        // accept in the buggy contract (max creator coin = pre-donation quote * 5).
        (uint256 quotedCreator, uint256 quotedShares) = pool.quoteAddLiquidity(50);
        vm.startPrank(victim);
        creatorCoin.approve(address(pool), type(uint256).max);
        friendKey.setApprovalForAll(address(pool), true);
        pool.addLiquidity(50, quotedCreator, quotedShares, victim);
        vm.stopPrank();

        // Attacker burns all their LP shares.
        vm.prank(attacker);
        (uint256 creatorOut, uint256 keysOut) = pool.removeLiquidity(attackerShares, 0, 0, attacker);

        // Net change for attacker: creator coin & keys returned vs. those put in
        // (donation + add deposit). Anything > 0 in either dimension would be profit.
        uint256 attackerFinalCreator = creatorCoin.balanceOf(attacker);
        uint256 attackerFinalKeys = friendKey.balanceOf(attacker, TOKEN_ID);

        // Sanity: removeLiquidity gave back at least the recorded amounts.
        assertEq(attackerFinalCreator, attackerCreatorAfterAdd - donation + creatorOut);
        assertEq(attackerFinalKeys, attackerKeysAfterAdd + keysOut);

        // Total spent by attacker = (creator-coin add) + donation; keys spent = 20.
        uint256 attackerCreatorSpent = attackerCreatorIn + donation;
        // The attacker must NOT net positive in creator coin (or keys) versus what
        // they deposited. This is the core no-profit assertion.
        assertLe(creatorOut, attackerCreatorSpent, "attacker should not extract more creator coin than they put in");
        assertLe(keysOut, attackerKeysIn, "attacker should not extract more keys than they put in");
    }
}

contract AlfaPoolFeeOnTransferSecurityTest is AlfaPoolSecurityBase {
    FeeOnTransferCreatorCoin internal creatorCoin;

    function setUp() public {
        _setupCommon();
        // 0% fee at construction so we can seed the pool through the factory's
        // normal flow (which uses _pullExactCreatorCoin via mintInitialLiquidity).
        creatorCoin = new FeeOnTransferCreatorCoin(0);
        vm.prank(owner);
        factory.setPairAllowed(address(creatorCoin), TOKEN_ID, true);

        friendKey.mintKeys(lpCreator, TOKEN_ID, 5_000);
        friendKey.mintKeys(trader, TOKEN_ID, 1_000);
        creatorCoin.mint(lpCreator, 100_000_000 ether);
        creatorCoin.mint(trader, 100_000_000 ether);
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

    /// @dev A creator coin that taxes outgoing transfers must cause sellKeys() to
    /// revert, not silently deliver less than the slippage-checked minimum.
    function testSellKeysRevertsOnFeeOnTransferOutgoing() public {
        AlfaCreatorKeyPool pool = _createPool();

        // Activate the burn fee AFTER the pool is initialised so seeding succeeded.
        creatorCoin.setFeeBps(500);

        uint256 quote = pool.quoteSellKeys(5);

        vm.startPrank(trader);
        friendKey.setApprovalForAll(address(pool), true);
        vm.expectRevert(AlfaCreatorKeyPool.FeeOnTransferUnsupported.selector);
        pool.sellKeys(5, quote, trader);
        vm.stopPrank();
    }

    /// @dev Same protection for removeLiquidity(): outgoing creator coin must
    /// revert when a tax would cause the recipient to receive less than expected.
    function testRemoveLiquidityRevertsOnFeeOnTransferOutgoing() public {
        AlfaCreatorKeyPool pool = _createPool();

        // Add enough liquidity for lpCreator to have shares; then activate fee.
        creatorCoin.setFeeBps(250);

        uint256 burnShares = pool.balanceOf(lpCreator) / 10;
        vm.prank(lpCreator);
        vm.expectRevert(AlfaCreatorKeyPool.FeeOnTransferUnsupported.selector);
        pool.removeLiquidity(burnShares, 0, 1, lpCreator);
    }
}

/// @notice Same protection but for the *sender-fee* flavour of fee-on-transfer:
/// the recipient still receives the full quoted amount, so a recipient-only
/// delta check would silently pass. The pool is debited `amount + fee` though,
/// which would otherwise leave stored reserves overstated and brick later
/// outflows. The fix asserts pool debit equals `amount` as well.
contract AlfaPoolSenderFeeSecurityTest is AlfaPoolSecurityBase {
    SenderFeeCreatorCoin internal creatorCoin;

    function setUp() public {
        _setupCommon();
        // Seed the pool with no fee, then activate the sender-side tax once the
        // pool exists (matches the recipient-fee test pattern).
        creatorCoin = new SenderFeeCreatorCoin(0);
        vm.prank(owner);
        factory.setPairAllowed(address(creatorCoin), TOKEN_ID, true);

        friendKey.mintKeys(lpCreator, TOKEN_ID, 5_000);
        friendKey.mintKeys(trader, TOKEN_ID, 1_000);
        creatorCoin.mint(lpCreator, 100_000_000 ether);
        creatorCoin.mint(trader, 100_000_000 ether);
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

    /// @dev sellKeys() must revert if the pool is debited more than the quoted
    /// amount, even though the recipient still receives that amount in full.
    function testSellKeysRevertsOnSenderFeeOutgoing() public {
        AlfaCreatorKeyPool pool = _createPool();

        // Sanity-check the mock: a 5% sender fee leaves recipient whole but
        // burns extra from the sender, so the pool's outflow > recipient credit.
        creatorCoin.setFeeBps(500);

        // Snapshot pool balance to confirm the contract reverts before any
        // creator coin actually leaves the pool.
        uint256 poolBefore = creatorCoin.balanceOf(address(pool));

        uint256 quote = pool.quoteSellKeys(5);
        vm.startPrank(trader);
        friendKey.setApprovalForAll(address(pool), true);
        vm.expectRevert(AlfaCreatorKeyPool.FeeOnTransferUnsupported.selector);
        pool.sellKeys(5, quote, trader);
        vm.stopPrank();

        // Stored reserves and the live pool balance must be untouched on revert.
        assertEq(creatorCoin.balanceOf(address(pool)), poolBefore);
        (uint256 cReserve,) = pool.getReserves();
        assertEq(cReserve, INITIAL_CREATOR_COIN);
    }

    /// @dev removeLiquidity() must revert under the same condition: recipient
    /// gets the quoted amount but the pool would lose more than that.
    function testRemoveLiquidityRevertsOnSenderFeeOutgoing() public {
        AlfaCreatorKeyPool pool = _createPool();
        creatorCoin.setFeeBps(250);

        uint256 burnShares = pool.balanceOf(lpCreator) / 10;
        uint256 poolCoinBefore = creatorCoin.balanceOf(address(pool));
        uint256 supplyBefore = pool.totalSupply();
        (uint256 cReserveBefore,) = pool.getReserves();

        vm.prank(lpCreator);
        vm.expectRevert(AlfaCreatorKeyPool.FeeOnTransferUnsupported.selector);
        pool.removeLiquidity(burnShares, 0, 1, lpCreator);

        // Revert must roll back the burn and the reserve update too — i.e.
        // none of the outflow path's earlier writes survive.
        assertEq(pool.totalSupply(), supplyBefore, "lp supply must not decrease on revert");
        assertEq(pool.balanceOf(lpCreator), supplyBefore, "lp shares must not be burnt");
        (uint256 cReserveAfter,) = pool.getReserves();
        assertEq(cReserveAfter, cReserveBefore, "stored reserve must not decrement on revert");
        assertEq(creatorCoin.balanceOf(address(pool)), poolCoinBefore, "pool balance must not move");
    }

    /// @dev Direct sanity: with the sender-fee active, the recipient really
    /// does see `amount` (so a recipient-only check would pass) — proving
    /// the fix is needed to catch the discrepancy.
    function testSenderFeeMockShape() public {
        creatorCoin.setFeeBps(500);
        uint256 amount = 1_000 ether;
        uint256 senderBefore = creatorCoin.balanceOf(lpCreator);
        uint256 recipientBefore = creatorCoin.balanceOf(trader);

        vm.prank(lpCreator);
        creatorCoin.transfer(trader, amount);

        uint256 senderDelta = senderBefore - creatorCoin.balanceOf(lpCreator);
        uint256 recipientDelta = creatorCoin.balanceOf(trader) - recipientBefore;
        assertEq(recipientDelta, amount, "recipient receives full amount");
        assertGt(senderDelta, amount, "sender debited extra fee");
    }
}

/// @notice Asserts the structural invariant the redesign cares about: the AMM
/// pair is exactly (creatorCoin, friendKey[tokenId]). LP shares are receipts —
/// never priced, never a paired reserve, never read by quote/swap math.
contract AlfaPoolPairModelTest is AlfaPoolSecurityBase {
    VanillaCreatorCoin internal creatorCoin;

    function setUp() public {
        _setupCommon();
        creatorCoin = new VanillaCreatorCoin();
        vm.prank(owner);
        factory.setPairAllowed(address(creatorCoin), TOKEN_ID, true);

        friendKey.mintKeys(lpCreator, TOKEN_ID, 5_000);
        friendKey.mintKeys(trader, TOKEN_ID, 1_000);
        creatorCoin.mint(lpCreator, 100_000_000 ether);
        creatorCoin.mint(trader, 100_000_000 ether);
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

    /// @dev `getReserves()` must report exactly the two pair-asset accounts and
    /// never include LP-share supply or LP shares held at the pool address.
    function testGetReservesReflectsOnlyPairAssets() public {
        AlfaCreatorKeyPool pool = _createPool();

        (uint256 cReserve, uint256 kReserve) = pool.getReserves();
        assertEq(cReserve, INITIAL_CREATOR_COIN);
        assertEq(kReserve, INITIAL_KEYS);

        // LP supply is non-zero but lives outside getReserves() entirely.
        assertGt(pool.totalSupply(), 0);
        // Pool does not hold its own LP shares.
        assertEq(pool.balanceOf(address(pool)), 0);
    }

    /// @dev Sending LP shares to the pool is a no-op for the priced pair: it
    /// must not change reserves or affect quotes. LP shares are not a reserve.
    function testLpShareDonationToPoolDoesNotChangeReserves() public {
        AlfaCreatorKeyPool pool = _createPool();

        (uint256 cBefore, uint256 kBefore) = pool.getReserves();
        (uint256 reqBefore, uint256 sharesBefore) = pool.quoteAddLiquidity(10);
        uint256 sellQuoteBefore = pool.quoteSellKeys(1);
        uint256 buyQuoteBefore = pool.quoteBuyKeys(1);

        // lpCreator dumps half their LP shares into the pool itself.
        uint256 dumped = pool.balanceOf(lpCreator) / 2;
        vm.prank(lpCreator);
        pool.transfer(address(pool), dumped);

        // Reserves and every quote are byte-identical to before.
        (uint256 cAfter, uint256 kAfter) = pool.getReserves();
        assertEq(cAfter, cBefore);
        assertEq(kAfter, kBefore);

        (uint256 reqAfter, uint256 sharesAfter) = pool.quoteAddLiquidity(10);
        assertEq(reqAfter, reqBefore);
        assertEq(sharesAfter, sharesBefore);
        assertEq(pool.quoteSellKeys(1), sellQuoteBefore);
        assertEq(pool.quoteBuyKeys(1), buyQuoteBefore);

        // The dumped shares are physically present at the pool address but
        // remain part of totalSupply — they're just stranded receipts.
        assertEq(pool.balanceOf(address(pool)), dumped);
    }

    /// @dev removeLiquidity payout is strictly pro-rata against pair reserves
    /// and LP supply, never against the pool's live ERC20/ERC1155 balances.
    /// Donations of either pair asset must be ignored by the payout.
    function testRemoveLiquidityIgnoresDonationsOfPairAssets() public {
        AlfaCreatorKeyPool pool = _createPool();

        // Donate creator coin and friend keys directly to the pool.
        uint256 coinDonation = 7_777_777 ether;
        uint256 keyDonation = 333;
        vm.prank(trader);
        creatorCoin.transfer(address(pool), coinDonation);
        vm.prank(lpCreator);
        friendKey.safeTransferFrom(lpCreator, address(pool), TOKEN_ID, keyDonation, "");

        // Compute the *expected* pro-rata claim using stored reserves only.
        uint256 burnShares = pool.balanceOf(lpCreator) / 4;
        (uint256 cReserve, uint256 kReserve) = pool.getReserves();
        uint256 supply = pool.totalSupply();
        uint256 expectedCoinOut = (cReserve * burnShares) / supply;
        uint256 expectedKeyOut = (kReserve * burnShares) / supply;

        vm.prank(lpCreator);
        (uint256 coinOut, uint256 keyOut) = pool.removeLiquidity(burnShares, 0, 1, lpCreator);

        assertEq(coinOut, expectedCoinOut, "coin payout must come from stored reserves");
        assertEq(keyOut, expectedKeyOut, "key payout must come from stored reserves");

        // Donated balances are stranded in the pool (live > stored after burn).
        (uint256 cAfter, uint256 kAfter) = pool.getReserves();
        uint256 liveCoin = creatorCoin.balanceOf(address(pool));
        uint256 liveKeys = friendKey.balanceOf(address(pool), TOKEN_ID);
        assertGe(liveCoin, cAfter + coinDonation - 1, "coin donation remains stranded");
        assertEq(liveKeys, kAfter + keyDonation, "key donation remains stranded");
    }

    /// @dev Buy/sell quotes must depend only on stored pair reserves, not on
    /// LP totalSupply or live balances.
    function testSwapQuotesIgnoreLpSupplyAndDonations() public {
        AlfaCreatorKeyPool pool = _createPool();

        uint256 buyBefore = pool.quoteBuyKeys(2);
        uint256 sellBefore = pool.quoteSellKeys(2);

        // Donate pair-asset and LP-share into the pool, simulating both axes
        // of "noise" that must not influence quote math.
        vm.prank(trader);
        creatorCoin.transfer(address(pool), 1_000_000 ether);

        uint256 lpDump = pool.balanceOf(lpCreator) / 3;
        vm.prank(lpCreator);
        pool.transfer(address(pool), lpDump);

        assertEq(pool.quoteBuyKeys(2), buyBefore, "buy quote must not see donations or LP transfer");
        assertEq(pool.quoteSellKeys(2), sellBefore, "sell quote must not see donations or LP transfer");
    }

    /// @dev k = creatorCoinReserve * keyReserve must strictly increase across a
    /// fee-bearing swap (constant-product invariant on the priced pair).
    function testConstantProductInvariantHoldsOnSwap() public {
        AlfaCreatorKeyPool pool = _createPool();
        (uint256 c0, uint256 k0) = pool.getReserves();
        uint256 kBefore = c0 * k0;

        uint256 buyAmount = 3;
        uint256 quote = pool.quoteBuyKeys(buyAmount);
        vm.startPrank(trader);
        creatorCoin.approve(address(pool), type(uint256).max);
        pool.buyKeys(buyAmount, quote, trader);
        vm.stopPrank();

        (uint256 c1, uint256 k1) = pool.getReserves();
        uint256 kAfter = c1 * k1;
        assertGt(kAfter, kBefore, "k must increase by the fee on a swap");
    }
}
