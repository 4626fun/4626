// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "forge-std/Test.sol";

import {Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OAppReceiver.sol";
import {IOAppCore} from "@layerzerolabs/oapp-evm/contracts/oapp/interfaces/IOAppCore.sol";
import {LotteryRelayTestReceiver4626} from "@4626/shared/lottery/test/LotteryRelayTestReceiver4626.sol";

contract LotteryRelayTestReceiver4626Test is Test {
    address internal constant ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    address internal constant OWNER = address(0xA11CE);
    uint32 internal constant SOLANA_DEVNET_EID = 40_168;
    bytes32 internal constant SOLANA_STORE = bytes32(uint256(0x51));
    address internal constant BUYER = address(0xBEEF);
    address internal constant TOKEN = address(0xCAFE);

    LotteryRelayTestReceiver4626 internal receiver;

    function setUp() public {
        vm.mockCall(ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        receiver = new LotteryRelayTestReceiver4626(ENDPOINT, OWNER);
        vm.startPrank(OWNER);
        receiver.setPeer(SOLANA_DEVNET_EID, SOLANA_STORE);
        receiver.setAuthorizedRemoteOFT(SOLANA_DEVNET_EID, SOLANA_STORE, true);
        vm.stopPrank();
    }

    function test_acceptsOneCanonicalV3EntryAndRecordsReceipt() public {
        bytes32 sourceEventId = keccak256("source-event-1");
        bytes32 guid = keccak256("guid-1");
        _deliver(_origin(), guid, _payload(sourceEventId));

        bytes32 key = receiver.receiptKey(SOLANA_DEVNET_EID, SOLANA_STORE, sourceEventId);
        (address buyer, address tokenIn, uint256 amount, uint32 sourceChainId, bytes32 savedGuid) =
            receiver.receipts(key);
        assertTrue(receiver.receivedSourceEvents(key));
        assertEq(receiver.receivedCount(), 1);
        assertEq(buyer, BUYER);
        assertEq(tokenIn, TOKEN);
        assertEq(amount, 42 ether);
        assertEq(sourceChainId, 0);
        assertEq(savedGuid, guid);
    }

    function test_duplicateSourceEventIsIdempotentAndDoesNotOverwriteReceipt() public {
        bytes32 sourceEventId = keccak256("source-event-duplicate");
        _deliver(_origin(), keccak256("guid-first"), _payload(sourceEventId));
        _deliver(_origin(), keccak256("guid-redelivery"), _payload(sourceEventId));

        bytes32 key = receiver.receiptKey(SOLANA_DEVNET_EID, SOLANA_STORE, sourceEventId);
        (,,,, bytes32 savedGuid) = receiver.receipts(key);
        assertEq(receiver.receivedCount(), 1);
        assertEq(receiver.duplicateCount(), 1);
        assertEq(savedGuid, keccak256("guid-first"));
    }

    function test_rejectsNonzeroCoverageWithoutCreatingReceipt() public {
        bytes32 sourceEventId = keccak256("source-event-coverage");
        bytes memory payload = _payload(sourceEventId);
        assembly {
            mstore(add(payload, 192), 1)
        }
        _deliver(_origin(), keccak256("guid-coverage"), payload);

        bytes32 key = receiver.receiptKey(SOLANA_DEVNET_EID, SOLANA_STORE, sourceEventId);
        assertFalse(receiver.receivedSourceEvents(key));
        assertEq(receiver.receivedCount(), 0);
        assertEq(receiver.rejectedCount(), 1);
    }

    function test_rejectsMalformedAddressWordWithoutCreatingReceipt() public {
        bytes32 sourceEventId = keccak256("source-event-malformed");
        bytes memory payload = _payload(sourceEventId);
        payload[32] = bytes1(0x01);
        _deliver(_origin(), keccak256("guid-malformed"), payload);

        bytes32 key = receiver.receiptKey(SOLANA_DEVNET_EID, SOLANA_STORE, sourceEventId);
        assertFalse(receiver.receivedSourceEvents(key));
        assertEq(receiver.receivedCount(), 0);
        assertEq(receiver.rejectedCount(), 1);
    }

    function test_requiresExactSolanaDevnetPeerBeforeReceiptLogic() public {
        Origin memory wrongPeer = Origin({srcEid: SOLANA_DEVNET_EID, sender: bytes32(uint256(0x52)), nonce: 1});
        vm.expectRevert(abi.encodeWithSelector(IOAppCore.OnlyPeer.selector, SOLANA_DEVNET_EID, wrongPeer.sender));
        _deliver(wrongPeer, keccak256("guid-wrong-peer"), _payload(keccak256("source-event-peer")));
        assertEq(receiver.receivedCount(), 0);
        assertEq(receiver.rejectedCount(), 0);
    }

    function test_ownerCanOnlyConfigureTheSolanaDevnetRoute() public {
        vm.prank(OWNER);
        vm.expectRevert(abi.encodeWithSelector(LotteryRelayTestReceiver4626.InvalidTestRouteEid.selector, 30_168));
        receiver.setPeer(30_168, SOLANA_STORE);

        vm.prank(OWNER);
        vm.expectRevert(abi.encodeWithSelector(LotteryRelayTestReceiver4626.InvalidTestRouteEid.selector, 30_168));
        receiver.setAuthorizedRemoteOFT(30_168, SOLANA_STORE, true);
    }

    function _origin() internal pure returns (Origin memory) {
        return Origin({srcEid: SOLANA_DEVNET_EID, sender: SOLANA_STORE, nonce: 1});
    }

    function _payload(bytes32 sourceEventId) internal pure returns (bytes memory) {
        return abi.encode(uint16(3), BUYER, TOKEN, 42 ether, uint32(0), uint256(0), sourceEventId);
    }

    function _deliver(Origin memory origin, bytes32 guid, bytes memory payload) internal {
        vm.prank(ENDPOINT);
        receiver.lzReceive(origin, guid, payload, address(0), "");
    }
}
