// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {CreatorShareOFT} from "../contracts/utilities/messaging/CreatorShareOFT.sol";
import {Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";

contract MockRegistryForShareOFTLzReceive {
    address public immutable endpoint;

    constructor(address _endpoint) {
        endpoint = _endpoint;
    }

    // CreatorShareOFT constructor only needs this.
    function getLayerZeroEndpoint(uint256) external view returns (address) {
        return endpoint;
    }

    // Unused in these tests but present on the real registry.
    function getLotteryManager(uint256) external pure returns (address) {
        return address(0);
    }
}

contract CreatorShareOFTLzReceiveWinnerCallbackCollisionTest is Test {
    // Same address used across existing tests in this repo.
    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    // Arbitrary EIDs for testing lzReceive peer gating.
    uint32 internal constant SRC_EID_OFT = 11111;
    uint32 internal constant SRC_EID_HUB = 22222;

    address internal owner = address(0xA11CE);

    bytes32 internal constant SRC_PEER_OFT = bytes32(uint256(uint160(address(0xBEEF))));
    bytes32 internal constant HUB_LOTTERY_PEER = bytes32(uint256(uint160(address(0xCAFE))));

    // Ends in 0x0004 so low 16 bits == 4 (MSG_TYPE_WINNER_CALLBACK).
    address internal constant RECIPIENT_ENDS_WITH_0004 = address(0x1111111111111111111111111111111111110004);

    CreatorShareOFT internal shareOFT;

    event LotteryWinnerNotification(
        address indexed winner, address indexed creatorCoin, uint256 totalSharesPaid, uint32 indexed sourceHubEid
    );

    function setUp() public {
        // OAppCore constructor calls endpoint.setDelegate(delegate); mock to avoid any surprises.
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());

        MockRegistryForShareOFTLzReceive registry = new MockRegistryForShareOFTLzReceive(LZ_ENDPOINT);

        vm.prank(owner);
        shareOFT = new CreatorShareOFT("Test Share", "sTEST", address(registry), owner);

        vm.startPrank(owner);
        // Accept OFT messages from SRC_EID_OFT/SRC_PEER_OFT.
        shareOFT.setPeer(SRC_EID_OFT, SRC_PEER_OFT);

        // Configure hub lottery peer to a distinct sender so misclassification reverts InvalidCallback().
        shareOFT.setHubLotteryPeer(SRC_EID_HUB, HUB_LOTTERY_PEER);
        // Allow hub lottery peer messages for the positive control callback test.
        shareOFT.setPeer(SRC_EID_HUB, HUB_LOTTERY_PEER);
        vm.stopPrank();
    }

    function _addressToBytes32(address a) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(a)));
    }

    function _packedComposedOftMsg(address recipient, uint64 amountSD, address composedCaller, bytes memory composeMsg)
        internal
        pure
        returns (bytes memory)
    {
        // Mirrors OFTMsgCodec.encode packed format:
        // abi.encodePacked(sendTo, amountSD, addressToBytes32(msg.sender), composeMsg)
        return abi.encodePacked(_addressToBytes32(recipient), amountSD, _addressToBytes32(composedCaller), composeMsg);
    }

    function test_LzReceive_ComposedOFT_ToRecipientEnding0004_CreditsAndDoesNotRevert() public {
        uint64 amountSD = 1_000_000; // 1 token in shared decimals (6) when local decimals are 18
        uint256 expectedAmountLD = uint256(amountSD) * shareOFT.decimalConversionRate();

        bytes memory message = _packedComposedOftMsg(
            RECIPIENT_ENDS_WITH_0004,
            amountSD,
            address(0xD00D),
            hex"01" // non-empty compose payload => SEND_AND_CALL packed payload
        );

        Origin memory origin = Origin({srcEid: SRC_EID_OFT, sender: SRC_PEER_OFT, nonce: 1});

        vm.prank(LZ_ENDPOINT);
        shareOFT.lzReceive(origin, bytes32(uint256(1)), message, address(0), "");

        assertEq(shareOFT.balanceOf(RECIPIENT_ENDS_WITH_0004), expectedAmountLD, "dst credit");
    }

    function test_LzReceive_ComposedOFT_Length128_ToRecipientEnding0004_CreditsAndDoesNotRevert() public {
        // Compose payload length 56 => packed composed OFT msg length is 72 + 56 = 128.
        bytes memory composeMsg = new bytes(56);

        uint64 amountSD = 2_000_000;
        uint256 expectedAmountLD = uint256(amountSD) * shareOFT.decimalConversionRate();

        bytes memory message = _packedComposedOftMsg(RECIPIENT_ENDS_WITH_0004, amountSD, address(0xD00D), composeMsg);
        assertEq(message.length, 128, "sanity: packed msg length");

        Origin memory origin = Origin({srcEid: SRC_EID_OFT, sender: SRC_PEER_OFT, nonce: 2});

        vm.prank(LZ_ENDPOINT);
        shareOFT.lzReceive(origin, bytes32(uint256(2)), message, address(0), "");

        assertEq(shareOFT.balanceOf(RECIPIENT_ENDS_WITH_0004), expectedAmountLD, "dst credit");
    }

    function test_LzReceive_ValidWinnerCallback_EmitsNotification_AndDoesNotCreditTokens() public {
        address winner = address(0x1111111111111111111111111111111111111111);
        address creatorCoin = address(0x2222222222222222222222222222222222222222);
        uint256 totalSharesPaid = 123e18;

        bytes memory message =
            abi.encode(uint16(shareOFT.MSG_TYPE_WINNER_CALLBACK()), winner, creatorCoin, totalSharesPaid);
        assertEq(message.length, 128, "sanity: abi payload length");

        Origin memory origin = Origin({srcEid: SRC_EID_HUB, sender: HUB_LOTTERY_PEER, nonce: 3});

        vm.expectEmit(true, true, true, true, address(shareOFT));
        emit LotteryWinnerNotification(winner, creatorCoin, totalSharesPaid, SRC_EID_HUB);

        uint256 winnerBalBefore = shareOFT.balanceOf(winner);

        vm.prank(LZ_ENDPOINT);
        shareOFT.lzReceive(origin, bytes32(uint256(3)), message, address(0), "");

        assertEq(shareOFT.balanceOf(winner), winnerBalBefore, "winner callback should not credit OFT tokens");
    }
}

