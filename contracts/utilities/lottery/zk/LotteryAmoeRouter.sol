// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IAmoePlonkVerifier} from "./IAmoePlonkVerifier.sol";

/// @title LotteryAmoeRouter (v2)
/// @notice On-chain settlement layer for 4626.fun AMOE lottery entries.
///         v2 closes the trust gap that allowed `authorizedAmoeRelayer` to
///         assert an arbitrary `pointsBurnedAsUSD` for any allowlisted
///         wallet — the value is now bound into a PLONK proof, replay-
///         guarded by a global nullifier mapping, and anchored by a daily
///         Merkle root of the off-chain points-burn ledger.
///
///         The verifier was migrated from Groth16 v2 to PLONK in PR #409
///         (no trusted setup needed beyond the universal Powers-of-Tau
///         transcript). See `docs/security/amoe-plonk-migration.md` for
///         the full rationale, gas/bytecode tradeoffs, and the
///         security divergence from stock snarkjs output (explicit
///         `checkField` on all 8 public inputs).
///
///         When PR 4b is rolled out, `CreatorLotteryManager.authorizedAmoeRelayer`
///         is set to this router's address so `processAmoeEntry` is only ever
///         called with a cryptographically-bound value.
///
/// @dev    Two entry paths:
///           submitAmoeEntry      v1 ECDSA / EIP-1271 (compat path)
///           submitAmoeEntryZK    v2 PLONK-backed   (audit-grade path)
///
///         Both produce the same `AmoeEntryRecorded` event so downstream
///         consumers don't need to branch.
interface ILotteryAmoeConsumer {
    /// @notice Legacy ZK-path consumer hook. Kept for backward compatibility
    ///         with deployments that wired the router as an event-only
    ///         broadcaster. Production deployments should set the manager
    ///         (see `IAmoeManager` + `setManager`) to fan out with the proven
    ///         `pointsBurnedAsUSD`.
    function recordAmoeEntry(
        address buyer,
        address creatorCoin,
        uint64 epoch,
        uint256 entryId
    ) external;
}

/// @notice Manager-facing fan-out interface. The router calls this with the
///         `pointsBurnedAsUSD` value taken straight from the PLONK public
///         inputs, so the manager no longer trusts an off-chain relayer's
///         claim about points accounting.
///
///         Matches `CreatorLotteryManager.processAmoeEntry`'s exact signature
///         — when the rollout op `setAuthorizedAmoeRelayer(<router>)` runs,
///         the manager treats this router as the relayer.
interface IAmoeManager {
    function processAmoeEntry(
        address buyer,
        address creatorCoin,
        uint256 pointsBurnedAsUSD
    ) external returns (uint256 entryId);
}

contract LotteryAmoeRouter {
    // -------------------------------------------------------------------------
    // Roles & config
    // -------------------------------------------------------------------------

    /// @notice Owner can update verifier address, allowlist roots, and consumer.
    address public owner;

    /// @notice Address allowed to publish daily allowlist roots (server signer).
    address public allowlistPublisher;

    /// @notice Address allowed to publish daily points-burn ledger roots.
    /// @dev    Mirrors `allowlistPublisher` but for the v2 points-burn anchor.
    ///         Same KMS-protected scoped key class.
    address public pointsLedgerPublisher;

    /// @notice PLONK verifier for the AMOE eligibility circuit (v2).
    /// @dev    Migrated from per-circuit Groth16 → PLONK to avoid the
    ///         per-circuit trusted-setup ceremony. PLONK uses the universal
    ///         Hermez powersOfTau (pot17) SRS. Public-input layout is
    ///         unchanged; the on-chain proof shape is now a flat
    ///         `uint256[24]` instead of `(a,b,c)`. See `IAmoePlonkVerifier`.
    IAmoePlonkVerifier public verifier;

    /// @notice Optional downstream legacy consumer (event broadcaster).
    /// @dev    Receives the truncated `(buyer, coin, epoch, entryId)` shape.
    ///         Production should prefer `manager` for points-bound fan-out.
    ILotteryAmoeConsumer public consumer;

    /// @notice CreatorLotteryManager-shaped fan-out target. When non-zero, the
    ///         router calls `manager.processAmoeEntry(buyer, coin,
    ///         pointsBurnedAsUSD)` after a successful ZK submission, with the
    ///         value taken directly from `pubInputs[5]`.
    IAmoeManager public manager;

    /// @notice Daily allowlist roots, keyed by epoch.
    mapping(uint64 => bytes32) public allowlistRootOf;

    /// @notice Daily points-burn ledger roots, keyed by epoch (one-shot).
    mapping(uint64 => bytes32) public pointsLedgerRootOf;

    /// @notice Replay guard: nonce commitments already consumed.
    mapping(bytes32 => bool) public usedNonceCommit;

    /// @notice Replay guard: walletAddrCommits already consumed in an epoch.
    /// @dev walletAddrCommit binds (wallet, twitterCreditNullifier), so a single
    ///      twitter credit can only be used once per epoch even if the wallet
    ///      reuses different nonces.
    mapping(uint64 => mapping(bytes32 => bool)) public usedWalletCommit;

    /// @notice GLOBAL replay guard for points-burn nullifiers. Once a spend
    ///         row is consumed by an AMOE entry, it can never back another
    ///         entry, in any epoch, ever. This matches the off-chain semantic
    ///         that one `(signup_id, source='amoe_entry_spend', source_id)`
    ///         points row backs exactly one AMOE entry.
    mapping(bytes32 => bool) public usedPointsBurnNullifier;

    /// @notice Monotonic entry id counter.
    uint256 public nextEntryId;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event OwnerUpdated(address indexed previous, address indexed current);
    event AllowlistPublisherUpdated(address indexed previous, address indexed current);
    event PointsLedgerPublisherUpdated(address indexed previous, address indexed current);
    event VerifierUpdated(address indexed previous, address indexed current);
    event ConsumerUpdated(address indexed previous, address indexed current);
    event ManagerUpdated(address indexed previous, address indexed current);
    event AllowlistRootSet(uint64 indexed epoch, bytes32 root);
    event PointsLedgerRootSet(uint64 indexed epoch, bytes32 root);

    event AmoeEntryRecorded(
        uint256 indexed entryId,
        address indexed buyer,
        address indexed creatorCoin,
        uint64 epoch,
        bytes32 nonceCommit,
        bytes32 walletAddrCommit,
        EntryPath path
    );

    /// @notice Emitted when the router successfully fans out a ZK entry to the
    ///         lottery manager. `pointsBurnedAsUSD` is the value bound into
    ///         the PLONK proof; `managerEntryId` is the VRF id returned by
    ///         the manager (0 if the manager silently skipped).
    event AmoeEntrySettled(
        uint256 indexed entryId,
        bytes32 indexed pointsBurnNullifier,
        uint256 pointsBurnedAsUSD,
        uint256 managerEntryId
    );

    enum EntryPath { ECDSA, ZK }

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error NotOwner();
    error NotPublisher();
    error NotPointsLedgerPublisher();
    error ZeroAddress();
    error VerifierNotSet();
    error UnknownEpoch();
    error RootMismatch();
    error InvalidProof();
    error NonceReplayed();
    error WalletCreditReplayed();
    error PointsBurnReplayed();
    error PointsLedgerEpochNotPublished();
    error PointsLedgerRootMismatch();
    error PointsLedgerEpochAlreadyPublished();
    error PointsValueOutOfRange();
    error EpochAlreadyPublished();
    error ZeroRoot();
    error ManagerDeclinedEntry();
    error DeadlineExpired();
    error DeadlineTooSoon();

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @notice Minimum buffer (in seconds) between `block.timestamp` and a
    ///         relayer-supplied `deadline` for `submitAmoeEntry`.
    ///
    /// @dev    Why this floor exists (audit §4.2, finding `timestamp`):
    ///         Solidity's `block.timestamp` can be drifted by miners by up
    ///         to ~15 seconds without violating consensus. AMOE deadlines
    ///         are denominated in minutes / hours, not seconds, so any
    ///         legitimately-issued entry will have a deadline far in the
    ///         future relative to that drift. The 60s floor below rejects
    ///         relayer-supplied deadlines that fall inside the miner-drift
    ///         tolerance window, so a benign timestamp jiggle can never
    ///         turn a valid entry into a `DeadlineExpired` revert at the
    ///         block boundary. Sixty seconds is well above worst-case
    ///         observed L1 / L2 timestamp slack.
    uint256 public constant MIN_DEADLINE_BUFFER = 60;

    /// @notice Defense-in-depth ceiling on `pointsBurnedAsUSD`. AMOE max is
    ///         1_000_000 points × 10_000 = 10^10 1e6 units = $10,000. A
    ///         buggy server or a malformed proof witness that produces a
    ///         value above this cap is rejected before it can reach the
    ///         manager. The circuit independently range-checks the value to
    ///         uint64; this ceiling is a tighter, semantic limit.
    uint256 public constant MAX_POINTS_AS_USD = 10_000 * 1_000_000;

    // -------------------------------------------------------------------------
    // Construction
    // -------------------------------------------------------------------------

    constructor(address _owner, address _allowlistPublisher, address _verifier) {
        if (_owner == address(0) || _allowlistPublisher == address(0)) revert ZeroAddress();
        owner = _owner;
        allowlistPublisher = _allowlistPublisher;
        verifier = IAmoePlonkVerifier(_verifier); // may be 0 at deploy; set later
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

    /// @notice Set the publisher key for the points-burn ledger Merkle root.
    ///         Mirrors `setAllowlistPublisher`. Same scoped-KMS class.
    function setPointsLedgerPublisher(address _publisher) external onlyOwner {
        if (_publisher == address(0)) revert ZeroAddress();
        emit PointsLedgerPublisherUpdated(pointsLedgerPublisher, _publisher);
        pointsLedgerPublisher = _publisher;
    }

    function setVerifier(address _verifier) external onlyOwner {
        emit VerifierUpdated(address(verifier), _verifier);
        verifier = IAmoePlonkVerifier(_verifier);
    }

    function setConsumer(address _consumer) external onlyOwner {
        emit ConsumerUpdated(address(consumer), _consumer);
        consumer = ILotteryAmoeConsumer(_consumer);
    }

    /// @notice Set the lottery-manager fan-out target. When non-zero, the
    ///         router calls `manager.processAmoeEntry(buyer, coin,
    ///         pointsBurnedAsUSD)` after each successful ZK entry.
    /// @dev    The manager must be configured to accept this router as its
    ///         `authorizedAmoeRelayer` for the call to succeed. That is a
    ///         one-way ops handoff (see `docs/security/amoe-pr4-handoff.md`).
    function setManager(address _manager) external onlyOwner {
        emit ManagerUpdated(address(manager), _manager);
        manager = IAmoeManager(_manager);
    }

    /// @notice Publish the allowlist Merkle root for an epoch. One-shot per
    ///         epoch — re-publishing reverts. The publisher is expected to be
    ///         the same off-chain key that today signs AMOE messages in
    ///         `lotteryAmoe.ts`.
    function setAllowlistRoot(uint64 epoch, bytes32 root) external {
        if (msg.sender != allowlistPublisher) revert NotPublisher();
        if (allowlistRootOf[epoch] != bytes32(0)) revert EpochAlreadyPublished();
        // Reject zero — `submitAmoeEntryZK` reads a stored zero as
        // "epoch not yet published", so allowing zero here would brick the
        // epoch under the one-shot constraint (`PointsLedgerEpochAlreadyPublished`
        // / `EpochAlreadyPublished` blocks any correction).
        if (root == bytes32(0)) revert ZeroRoot();
        allowlistRootOf[epoch] = root;
        emit AllowlistRootSet(epoch, root);
    }

    /// @notice Publish the points-burn ledger Merkle root for an epoch.
    ///         One-shot per epoch — re-publishing reverts. Mirrors the
    ///         allowlist publisher pattern.
    function setPointsLedgerRoot(uint64 epoch, bytes32 root) external {
        if (msg.sender != pointsLedgerPublisher) revert NotPointsLedgerPublisher();
        if (pointsLedgerRootOf[epoch] != bytes32(0)) revert PointsLedgerEpochAlreadyPublished();
        // Reject zero — `submitAmoeEntryZK` reads a stored zero as
        // "epoch not yet published" and reverts with
        // `PointsLedgerEpochNotPublished`. Combined with the one-shot guard
        // above, an accidentally-published zero root would permanently brick
        // the epoch (no correction path). Rejecting zero at publish time is
        // the cheapest fix.
        if (root == bytes32(0)) revert ZeroRoot();
        pointsLedgerRootOf[epoch] = root;
        emit PointsLedgerRootSet(epoch, root);
    }

    // -------------------------------------------------------------------------
    // ZK entry path (v2)
    // -------------------------------------------------------------------------

    /// @notice Submit an AMOE entry backed by a PLONK proof.
    /// @dev    `pubInputs` MUST be in the same order as the v2 circuit's
    ///         `public [...]` declaration:
    ///           [0] walletAddrCommit
    ///           [1] creatorCoinAddr (uint160 cast)
    ///           [2] nonceCommit
    ///           [3] epoch
    ///           [4] allowlistRoot
    ///           [5] pointsBurnedAsUSD       (v2)
    ///           [6] pointsLedgerRoot        (v2)
    ///           [7] pointsBurnNullifier     (v2)
    ///         `proof` is the flat 24-element PLONK proof emitted by
    ///         `snarkjs zkey export soliditycalldata`.
    function submitAmoeEntryZK(
        address buyer,
        address creatorCoin,
        uint64 epoch,
        uint256[24] calldata proof,
        uint256[8] calldata pubInputs
    ) external returns (uint256 entryId) {
        if (address(verifier) == address(0)) revert VerifierNotSet();

        // 1. Bind public inputs to the calldata-asserted (creatorCoin, epoch)
        //    so the proof can't be re-used against a different on-chain entry.
        if (uint256(uint160(creatorCoin)) != pubInputs[1]) revert InvalidProof();
        if (uint256(epoch) != pubInputs[3]) revert InvalidProof();

        // 2. Allowlist root pinning. The root must match the value the
        //    publisher posted for this epoch.
        bytes32 allowRoot = allowlistRootOf[epoch];
        if (allowRoot == bytes32(0)) revert UnknownEpoch();
        if (uint256(allowRoot) != pubInputs[4]) revert RootMismatch();

        // 3. Points-burn ledger root pinning (v2). Same one-shot pattern as
        //    allowlist root, separate publisher key.
        bytes32 ledgerRoot = pointsLedgerRootOf[epoch];
        if (ledgerRoot == bytes32(0)) revert PointsLedgerEpochNotPublished();
        if (uint256(ledgerRoot) != pubInputs[6]) revert PointsLedgerRootMismatch();

        // 4. Defense-in-depth: bound the proven `pointsBurnedAsUSD` by the
        //    AMOE protocol cap. The circuit already range-checks the value
        //    fits a uint64; this ceiling is the tighter semantic limit.
        uint256 pointsBurnedAsUSD = pubInputs[5];
        if (pointsBurnedAsUSD == 0 || pointsBurnedAsUSD > MAX_POINTS_AS_USD) {
            revert PointsValueOutOfRange();
        }

        // 5. Replay guards.
        bytes32 nonceCommit = bytes32(pubInputs[2]);
        if (usedNonceCommit[nonceCommit]) revert NonceReplayed();
        bytes32 walletCommit = bytes32(pubInputs[0]);
        if (usedWalletCommit[epoch][walletCommit]) revert WalletCreditReplayed();
        bytes32 pointsBurnNullifier = bytes32(pubInputs[7]);
        if (usedPointsBurnNullifier[pointsBurnNullifier]) revert PointsBurnReplayed();

        // 6. Verify the PLONK proof.
        if (!verifier.verifyProof(proof, pubInputs)) revert InvalidProof();

        // 7. Effects.
        usedNonceCommit[nonceCommit] = true;
        usedWalletCommit[epoch][walletCommit] = true;
        usedPointsBurnNullifier[pointsBurnNullifier] = true;
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

        // 8. Fan-out.
        //    Manager fan-out is the production path: the router calls
        //    `processAmoeEntry` directly with the proven points value, so the
        //    manager-side `authorizedAmoeRelayer` gate now only ever admits
        //    cryptographically-bound values.
        //
        //    `CreatorLotteryManager.processAmoeEntry` returns 0 on several
        //    "silent skip" branches (inactive coin, sub-`minSwapAmount` value,
        //    lottery currently inactive). Because step 7 above has already
        //    burned the nonce / wallet / points-burn nullifiers, a 0 return
        //    would lose the user's entry permanently with no replay path.
        //    Revert in that case so the proof + nullifiers stay un-consumed
        //    (state is rolled back atomically) and the user can resubmit
        //    when conditions become favorable.
        uint256 managerEntryId = 0;
        if (address(manager) != address(0)) {
            managerEntryId = manager.processAmoeEntry(buyer, creatorCoin, pointsBurnedAsUSD);
            if (managerEntryId == 0) revert ManagerDeclinedEntry();
        }

        //    Legacy event-only consumer hook (optional, kept for compat with
        //    deployments that wired the router as a passive broadcaster).
        if (address(consumer) != address(0)) {
            consumer.recordAmoeEntry(buyer, creatorCoin, epoch, entryId);
        }

        emit AmoeEntrySettled(entryId, pointsBurnNullifier, pointsBurnedAsUSD, managerEntryId);
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
        // Reject deadlines that have already passed.
        if (block.timestamp > deadline) revert DeadlineExpired();
        // Reject deadlines that are too close to `now` to be safe under
        // miner timestamp drift (see MIN_DEADLINE_BUFFER above). Using
        // unchecked subtraction is safe because we just verified that
        // `deadline >= block.timestamp`.
        unchecked {
            if (deadline - block.timestamp < MIN_DEADLINE_BUFFER) {
                revert DeadlineTooSoon();
            }
        }

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
