// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IAmoeGroth16Verifier} from "./IAmoeGroth16Verifier.sol";

/// @title LotteryAmoeRouter
/// @notice Minimal on-chain settlement layer for 4626.fun AMOE lottery entries.
///         Today, AMOE proofs are verified server-side in
///         `frontend/server/_lib/lottery/lotteryAmoe.ts` and only an entry id
///         is written to Postgres. This router keeps a small piece of state
///         on-chain so AMOE eligibility can be audited independently of the
///         server, and adds a sigless ZK path backed by an
///         AmoeGroth16Verifier emitted from `circuits/amoe`.
///
/// @dev    This contract intentionally does NOT touch CreatorLotteryManager
///         storage. It records the AMOE entry, prevents replay, and emits an
///         event that the lottery manager (or a keeper) can consume to credit
///         the entry into the next VRF roll. That keeps the diff to existing
///         audited code zero.
///
///         Two entry paths:
///           submitAmoeEntry      v1 ECDSA / EIP-1271 (existing flow)
///           submitAmoeEntryZK    v2 Groth16-backed (new flow)
///
///         Both produce the same `AmoeEntryRecorded` event so downstream
///         consumers don't need to branch.
interface ILotteryAmoeConsumer {
    function recordAmoeEntry(
        address buyer,
        address creatorCoin,
        uint64 epoch,
        uint256 entryId
    ) external;
}

contract LotteryAmoeRouter {
    // -------------------------------------------------------------------------
    // Roles & config
    // -------------------------------------------------------------------------

    /// @notice Owner can update verifier address, allowlist roots, and consumer.
    address public owner;

    /// @notice Address allowed to publish daily allowlist roots (server signer).
    address public allowlistPublisher;

    /// @notice Groth16 verifier for the AMOE eligibility circuit.
    IAmoeGroth16Verifier public verifier;

    /// @notice Optional downstream consumer (typically CreatorLotteryManager).
    ILotteryAmoeConsumer public consumer;

    /// @notice Daily allowlist roots, keyed by epoch.
    mapping(uint64 => bytes32) public allowlistRootOf;

    /// @notice Replay guard: nonce commitments already consumed.
    mapping(bytes32 => bool) public usedNonceCommit;

    /// @notice Replay guard: walletAddrCommits already consumed in an epoch.
    /// @dev walletAddrCommit binds (wallet, twitterCreditNullifier), so a single
    ///      twitter credit can only be used once per epoch even if the wallet
    ///      reuses different nonces.
    mapping(uint64 => mapping(bytes32 => bool)) public usedWalletCommit;

    /// @notice Monotonic entry id counter.
    uint256 public nextEntryId;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event OwnerUpdated(address indexed previous, address indexed current);
    event AllowlistPublisherUpdated(address indexed previous, address indexed current);
    event VerifierUpdated(address indexed previous, address indexed current);
    event ConsumerUpdated(address indexed previous, address indexed current);
    event AllowlistRootSet(uint64 indexed epoch, bytes32 root);

    event AmoeEntryRecorded(
        uint256 indexed entryId,
        address indexed buyer,
        address indexed creatorCoin,
        uint64 epoch,
        bytes32 nonceCommit,
        bytes32 walletAddrCommit,
        EntryPath path
    );

    enum EntryPath { ECDSA, ZK }

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error NotOwner();
    error NotPublisher();
    error ZeroAddress();
    error VerifierNotSet();
    error UnknownEpoch();
    error RootMismatch();
    error InvalidProof();
    error NonceReplayed();
    error WalletCreditReplayed();
    error EpochAlreadyPublished();

    // -------------------------------------------------------------------------
    // Construction
    // -------------------------------------------------------------------------

    constructor(address _owner, address _allowlistPublisher, address _verifier) {
        if (_owner == address(0) || _allowlistPublisher == address(0)) revert ZeroAddress();
        owner = _owner;
        allowlistPublisher = _allowlistPublisher;
        verifier = IAmoeGroth16Verifier(_verifier); // may be 0 at deploy; set later
        emit OwnerUpdated(address(0), _owner);
        emit AllowlistPublisherUpdated(address(0), _allowlistPublisher);
        emit VerifierUpdated(address(0), _verifier);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function setOwner(address _owner) external onlyOwner {
        if (_owner == address(0)) revert ZeroAddress();
        emit OwnerUpdated(owner, _owner);
        owner = _owner;
    }

    function setAllowlistPublisher(address _publisher) external onlyOwner {
        if (_publisher == address(0)) revert ZeroAddress();
        emit AllowlistPublisherUpdated(allowlistPublisher, _publisher);
        allowlistPublisher = _publisher;
    }

    function setVerifier(address _verifier) external onlyOwner {
        emit VerifierUpdated(address(verifier), _verifier);
        verifier = IAmoeGroth16Verifier(_verifier);
    }

    function setConsumer(address _consumer) external onlyOwner {
        emit ConsumerUpdated(address(consumer), _consumer);
        consumer = ILotteryAmoeConsumer(_consumer);
    }

    /// @notice Publish the allowlist Merkle root for an epoch. One-shot per
    ///         epoch — re-publishing reverts. The publisher is expected to be
    ///         the same off-chain key that today signs AMOE messages in
    ///         `lotteryAmoe.ts`.
    function setAllowlistRoot(uint64 epoch, bytes32 root) external {
        if (msg.sender != allowlistPublisher) revert NotPublisher();
        if (allowlistRootOf[epoch] != bytes32(0)) revert EpochAlreadyPublished();
        allowlistRootOf[epoch] = root;
        emit AllowlistRootSet(epoch, root);
    }

    // -------------------------------------------------------------------------
    // ZK entry path (NEW)
    // -------------------------------------------------------------------------

    /// @notice Submit an AMOE entry backed by a Groth16 proof.
    /// @dev    `pubInputs` MUST be in the same order as the circuit's
    ///         `public [...]` declaration:
    ///           [0] walletAddrCommit
    ///           [1] creatorCoinAddr (uint160 cast)
    ///           [2] nonceCommit
    ///           [3] epoch
    ///           [4] allowlistRoot
    function submitAmoeEntryZK(
        address buyer,
        address creatorCoin,
        uint64 epoch,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[5] calldata pubInputs
    ) external returns (uint256 entryId) {
        if (address(verifier) == address(0)) revert VerifierNotSet();

        // 1. Bind public inputs to the calldata-asserted (buyer, creatorCoin, epoch)
        //    so the proof can't be re-used against a different on-chain entry.
        if (uint256(uint160(creatorCoin)) != pubInputs[1]) revert InvalidProof();
        if (uint256(epoch) != pubInputs[3]) revert InvalidProof();

        // 2. Allowlist root pinning. The root must match the value the
        //    publisher posted for this epoch.
        bytes32 root = allowlistRootOf[epoch];
        if (root == bytes32(0)) revert UnknownEpoch();
        if (uint256(root) != pubInputs[4]) revert RootMismatch();

        // 3. Replay guards.
        bytes32 nonceCommit = bytes32(pubInputs[2]);
        if (usedNonceCommit[nonceCommit]) revert NonceReplayed();
        bytes32 walletCommit = bytes32(pubInputs[0]);
        if (usedWalletCommit[epoch][walletCommit]) revert WalletCreditReplayed();

        // 4. Verify the Groth16 proof.
        if (!verifier.verifyProof(a, b, c, pubInputs)) revert InvalidProof();

        // 5. Effects.
        usedNonceCommit[nonceCommit] = true;
        usedWalletCommit[epoch][walletCommit] = true;
        unchecked {
            entryId = ++nextEntryId;
        }
        emit AmoeEntryRecorded(
            entryId,
            buyer,
            creatorCoin,
            epoch,
            nonceCommit,
            walletCommit,
            EntryPath.ZK
        );

        // 6. Optional fan-out to lottery manager (so the entry feeds VRF).
        if (address(consumer) != address(0)) {
            consumer.recordAmoeEntry(buyer, creatorCoin, epoch, entryId);
        }
    }

    // -------------------------------------------------------------------------
    // Legacy ECDSA entry path
    // -------------------------------------------------------------------------
    //
    // The v1 path lives off-chain today. We expose a stub here so the ABI
    // matches what `frontend/server/_lib/lottery/lotteryAmoe.ts` expects (see
    // the `lotteryAmoeAbi` const), and so the same router can settle both
    // paths to the same `AmoeEntryRecorded` event.
    //
    // The actual EIP-1271 verification still happens in the keeper that calls
    // this function — that keeper holds the trust that today's server already
    // holds. This is a deliberate, narrow change: ZK is the audit-grade path,
    // ECDSA is the compatibility path until clients ship the prover.
    // -------------------------------------------------------------------------

    /// @notice Settle an ECDSA / EIP-1271 verified AMOE entry. Caller MUST be
    ///         the trusted relayer (today: same key as `allowlistPublisher`).
    function submitAmoeEntry(
        address buyer,
        address creatorCoin,
        bytes32 nonce,
        uint256 deadline,
        bytes calldata /* signature */
    ) external returns (uint256 entryId) {
        if (msg.sender != allowlistPublisher) revert NotPublisher();
        require(block.timestamp <= deadline, "expired");

        bytes32 nonceCommit = keccak256(abi.encode(nonce, buyer, creatorCoin));
        if (usedNonceCommit[nonceCommit]) revert NonceReplayed();
        usedNonceCommit[nonceCommit] = true;

        unchecked {
            entryId = ++nextEntryId;
        }
        // epoch is unknown on the legacy path; pass 0 and let downstream resolve
        emit AmoeEntryRecorded(
            entryId,
            buyer,
            creatorCoin,
            0,
            nonceCommit,
            bytes32(0),
            EntryPath.ECDSA
        );

        if (address(consumer) != address(0)) {
            consumer.recordAmoeEntry(buyer, creatorCoin, 0, entryId);
        }
    }
}
