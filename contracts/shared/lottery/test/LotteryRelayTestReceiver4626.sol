// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {OAppCore} from "@layerzerolabs/oapp-evm/contracts/oapp/OAppCore.sol";
import {OAppReceiver, Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OAppReceiver.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Isolated Base Sepolia receipt sink for the Solana B2 transport rehearsal.
/// @dev This contract is deliberately receive-only and must never be deployed or
///      wired on Base mainnet. It verifies the same Solana V3 payload invariants
///      as the production lottery lane, records an idempotent receipt keyed by
///      (srcEid, sender, sourceEventId), and has no lottery, VRF, or token logic.
contract LotteryRelayTestReceiver4626 is OAppReceiver {
    uint32 public constant SOLANA_DEVNET_EID = 40_168;
    uint256 public constant LOTTERY_ENTRY_MESSAGE_TYPE = 3;
    uint256 public constant LOTTERY_ENTRY_MESSAGE_LENGTH = 224;

    enum RejectionReason {
        UNAUTHORIZED_REMOTE,
        MALFORMED_PAYLOAD,
        ZERO_BUYER,
        ZERO_TOKEN,
        ZERO_AMOUNT,
        NONZERO_COVERAGE,
        ZERO_SOURCE_EVENT
    }

    struct Receipt {
        address buyer;
        address tokenIn;
        uint256 amount;
        uint32 sourceChainId;
        bytes32 guid;
    }

    /// @notice Mirrors the production receiver authorization check, separate
    /// from the LayerZero peer binding enforced by OAppReceiver.
    mapping(uint32 srcEid => mapping(bytes32 sender => bool authorized)) public authorizedRemoteOFTs;
    mapping(bytes32 receiptKey => Receipt receipt) public receipts;
    mapping(bytes32 receiptKey => bool receivedSourceEvents) public receivedSourceEvents;
    uint256 public receivedCount;
    uint256 public duplicateCount;
    uint256 public rejectedCount;

    error InvalidTestRouteEid(uint32 eid);
    error InvalidRemoteSender();

    event RemoteOFTAuthorized(uint32 indexed srcEid, bytes32 indexed sender, bool authorized);
    event LotteryEntryReceived(
        bytes32 indexed receiptKey,
        bytes32 indexed sourceEventId,
        bytes32 indexed guid,
        address buyer,
        address tokenIn,
        uint256 amount,
        uint32 sourceChainId
    );
    event LotteryEntryDuplicate(bytes32 indexed receiptKey, bytes32 indexed sourceEventId, bytes32 indexed guid);
    event LotteryEntryRejected(
        uint32 indexed srcEid, bytes32 indexed sender, bytes32 indexed guid, RejectionReason reason
    );

    constructor(address endpoint_, address owner_) OAppCore(endpoint_, owner_) Ownable(owner_) {}

    /// @notice The rehearsal receiver accepts precisely one source route.
    ///         Setting zero removes the peer as its rollback control.
    function setPeer(uint32 eid, bytes32 peer) public override onlyOwner {
        if (eid != SOLANA_DEVNET_EID) revert InvalidTestRouteEid(eid);
        super.setPeer(eid, peer);
    }

    function setAuthorizedRemoteOFT(uint32 srcEid, bytes32 sender, bool authorized) external onlyOwner {
        if (srcEid != SOLANA_DEVNET_EID) revert InvalidTestRouteEid(srcEid);
        if (sender == bytes32(0)) revert InvalidRemoteSender();
        authorizedRemoteOFTs[srcEid][sender] = authorized;
        emit RemoteOFTAuthorized(srcEid, sender, authorized);
    }

    function receiptKey(uint32 srcEid, bytes32 sender, bytes32 sourceEventId) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(srcEid, sender, sourceEventId));
    }

    function _lzReceive(Origin calldata origin, bytes32 guid, bytes calldata payload, address, bytes calldata)
        internal
        override
    {
        if (!authorizedRemoteOFTs[origin.srcEid][origin.sender]) {
            _reject(origin, guid, RejectionReason.UNAUTHORIZED_REMOTE);
            return;
        }

        (
            bool valid,
            RejectionReason reason,
            address buyer,
            address tokenIn,
            uint256 amount,
            uint32 sourceChainId,
            bytes32 sourceEventId
        ) = _decodeSolanaV3(payload);
        if (!valid) {
            _reject(origin, guid, reason);
            return;
        }

        bytes32 key = receiptKey(origin.srcEid, origin.sender, sourceEventId);
        if (receivedSourceEvents[key]) {
            duplicateCount += 1;
            emit LotteryEntryDuplicate(key, sourceEventId, guid);
            return;
        }

        receivedSourceEvents[key] = true;
        receipts[key] =
            Receipt({buyer: buyer, tokenIn: tokenIn, amount: amount, sourceChainId: sourceChainId, guid: guid});
        receivedCount += 1;
        emit LotteryEntryReceived(key, sourceEventId, guid, buyer, tokenIn, amount, sourceChainId);
    }

    function _reject(Origin calldata origin, bytes32 guid, RejectionReason reason) private {
        rejectedCount += 1;
        emit LotteryEntryRejected(origin.srcEid, origin.sender, guid, reason);
    }

    function _decodeSolanaV3(bytes calldata payload)
        private
        pure
        returns (
            bool valid,
            RejectionReason reason,
            address buyer,
            address tokenIn,
            uint256 amount,
            uint32 sourceChainId,
            bytes32 sourceEventId
        )
    {
        if (payload.length != LOTTERY_ENTRY_MESSAGE_LENGTH) {
            return (false, RejectionReason.MALFORMED_PAYLOAD, address(0), address(0), 0, 0, bytes32(0));
        }

        uint256 messageType;
        uint256 buyerWord;
        uint256 tokenWord;
        uint256 sourceChainIdWord;
        uint256 coverage;
        assembly {
            let ptr := payload.offset
            messageType := calldataload(ptr)
            buyerWord := calldataload(add(ptr, 32))
            tokenWord := calldataload(add(ptr, 64))
            amount := calldataload(add(ptr, 96))
            sourceChainIdWord := calldataload(add(ptr, 128))
            coverage := calldataload(add(ptr, 160))
            sourceEventId := calldataload(add(ptr, 192))
        }
        if (
            messageType != LOTTERY_ENTRY_MESSAGE_TYPE || buyerWord >> 160 != 0 || tokenWord >> 160 != 0
                || sourceChainIdWord >> 32 != 0
        ) {
            return (false, RejectionReason.MALFORMED_PAYLOAD, address(0), address(0), 0, 0, bytes32(0));
        }

        // forge-lint: disable-next-line(unsafe-typecast)
        buyer = address(uint160(buyerWord)); // Safe: buyerWord >> 160 is checked above.
        // forge-lint: disable-next-line(unsafe-typecast)
        tokenIn = address(uint160(tokenWord)); // Safe: tokenWord >> 160 is checked above.
        // forge-lint: disable-next-line(unsafe-typecast)
        sourceChainId = uint32(sourceChainIdWord); // Safe: sourceChainIdWord >> 32 is checked above.
        if (buyer == address(0)) {
            return (false, RejectionReason.ZERO_BUYER, buyer, tokenIn, amount, sourceChainId, sourceEventId);
        }
        if (tokenIn == address(0)) {
            return (false, RejectionReason.ZERO_TOKEN, buyer, tokenIn, amount, sourceChainId, sourceEventId);
        }
        if (amount == 0) {
            return (false, RejectionReason.ZERO_AMOUNT, buyer, tokenIn, amount, sourceChainId, sourceEventId);
        }
        if (coverage != 0) {
            return (false, RejectionReason.NONZERO_COVERAGE, buyer, tokenIn, amount, sourceChainId, sourceEventId);
        }
        if (sourceEventId == bytes32(0)) {
            return (false, RejectionReason.ZERO_SOURCE_EVENT, buyer, tokenIn, amount, sourceChainId, sourceEventId);
        }
        return (true, RejectionReason.MALFORMED_PAYLOAD, buyer, tokenIn, amount, sourceChainId, sourceEventId);
    }
}
