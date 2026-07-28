// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";

interface ILiveAlfaFriendKey {
    function creatorByTokenId(uint256 tokenId) external view returns (address);
    function roomTypes(uint256 tokenId) external view returns (uint8);
    function roomTiers(uint256 tokenId) external view returns (uint8);
    function totalSupply(uint256 tokenId) external view returns (uint256);
    function bondingToken() external view returns (address);
    function getBuyPriceAfterFee(uint256 tokenId, uint256 amount) external view returns (uint256);
    function getSellPriceAfterFee(uint256 tokenId, uint256 amount) external view returns (uint256);
}

interface ILiveCreatorCoin {
    function decimals() external view returns (uint8);
    function payoutRecipient() external view returns (address);
}

contract AlfaCreatorKeyLPBaseForkTest is Test {
    address internal constant FRIEND_KEY = 0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F;
    address internal constant ROOM_CREATOR = 0x64c3Fb828bD2A8cDe9Cde14d0295D34916bb94e9;
    address internal constant BONDING_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address internal constant AKITA = 0x5b674196812451B7cEC024FE9d22D2c0b172fa75;
    uint256 internal constant TOKEN_ID = 1659;

    bool internal forkConfigured;

    function setUp() public {
        string memory rpcUrl = vm.envOr("BASE_RPC_URL", string(""));
        if (bytes(rpcUrl).length == 0) return;
        vm.createSelectFork(rpcUrl);
        forkConfigured = true;
    }

    function testRoom1659ProductionPairHasExpectedInterfaceAndIdentity() public view {
        if (!forkConfigured) return;

        ILiveAlfaFriendKey friendKey = ILiveAlfaFriendKey(FRIEND_KEY);
        assertEq(friendKey.creatorByTokenId(TOKEN_ID), ROOM_CREATOR);
        assertEq(friendKey.roomTypes(TOKEN_ID), 0, "room 1659 must remain Trading");
        assertEq(friendKey.roomTiers(TOKEN_ID), 1, "room 1659 must remain Club tier");
        assertGt(friendKey.totalSupply(TOKEN_ID), 0);
        assertEq(friendKey.bondingToken(), BONDING_USDC);
        assertGt(friendKey.getBuyPriceAfterFee(TOKEN_ID, 1), 0);
        assertGt(friendKey.getSellPriceAfterFee(TOKEN_ID, 1), 0);

        assertGt(AKITA.code.length, 0);
        assertEq(ILiveCreatorCoin(AKITA).decimals(), 18);
        // Live payout recipient can rotate with creator ops; require a configured recipient.
        assertTrue(ILiveCreatorCoin(AKITA).payoutRecipient() != address(0));
    }
}
