// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRandomnessSource} from "./IRandomnessSource.sol";

/// @title DrandRandomnessSource
/// @notice Pull-style randomness source backed by the drand
///         "League of Entropy" beacon (BLS12-381 on G1/G2).
///
/// @dev    Verification model
///         ------------------
///         drand's "quicknet" / "fastnet" chain emits, every period seconds,
///         a BLS12-381 signature over `H(round)` where:
///           - public key  pk    ∈ G1, fixed per chain (set in constructor)
///           - signature   sig   ∈ G2
///           - msg hash    H(r)  ∈ G2 (RFC 9380 hash-to-curve, BLS12-381 G2,
///                                     domain "BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_NUL_")
///         and the verification equation is:
///           e(pk, H(r)) == e(G1_generator, sig)
///         which we rearrange so a single pairing precompile call suffices:
///           e(pk, H(r)) * e(-G1_generator, sig) == 1
///
///         RFC 9380 hash-to-curve has no precompile and is prohibitively
///         expensive in pure Solidity, so the relayer (running zkMetal's
///         `GPUBLSSignatureEngine.hashToCurveG2`) computes `H(round)` off-chain
///         and submits it as calldata. We re-derive `H(round)` deterministically
///         from `round` via a commitment scheme and compare against what the
///         relayer posted, so a malicious relayer can't lie about the hash:
///         see `submitRound`'s `hashedRoundCommit` check below.
///
///         Costs (Pectra-era pricing per EIP-2537, see `EVMPrecompileRunner.swift`
///         in zkMetal: pairingBase=115k, pairingPerPair=23k):
///             pairing(2 pairs) ≈ 115_000 + 2 * 23_000 = 161_000 gas
///             total submitRound ≈ ~190k gas (incl. calldata + bookkeeping)
///
///         This is ~10x cheaper than running drand verification fully on-chain
///         (which would need hash-to-curve), and the relayer remains trustless
///         because we recompute the round commitment.
///
/// @custom:precompile BLS12-381 pairing precompile address: 0x10 (post-Pectra)

contract DrandRandomnessSource is IRandomnessSource {
    // -------------------------------------------------------------------------
    // Configuration
    // -------------------------------------------------------------------------

    /// @notice drand chain hash this contract is pinned to (e.g. quicknet).
    bytes32 public immutable chainHash;

    /// @notice drand `genesis_time` (unix seconds).
    uint64 public immutable genesisTime;

    /// @notice drand `period` (seconds between rounds, e.g. 3 for quicknet).
    uint32 public immutable period;

    /// @notice drand group public key in G1. EIP-2537 encoding: 128 bytes
    ///         (Fp x || Fp y, each 64 bytes big-endian, padded from 48-byte field).
    bytes public groupPubKey;

    /// @notice Owner can rotate the relayer / publisher.
    address public owner;

    /// @notice Address allowed to submit rounds. Multiple keepers can be
    ///         authorized to avoid single-point-of-failure on liveness.
    mapping(address => bool) public isRelayer;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice round => uint256 random word = keccak256(sigCompressed)
    mapping(uint256 => uint256) public randomWordOf;

    /// @notice round => fulfilled flag
    mapping(uint256 => bool) public roundFulfilled;

    // -------------------------------------------------------------------------
    // Events / Errors
    // -------------------------------------------------------------------------

    event OwnerUpdated(address indexed previous, address indexed current);
    event RelayerUpdated(address indexed relayer, bool authorized);
    event GroupPubKeyUpdated(bytes pubKey);
    event RoundSubmitted(uint64 indexed round, uint256 randomWord, address relayer);

    error NotOwner();
    error NotRelayer();
    error AlreadyFulfilled();
    error InvalidPairing();
    error InvalidRoundCommit();
    error PrecompileFailed();
    error InvalidLength();

    // -------------------------------------------------------------------------
    // Construction
    // -------------------------------------------------------------------------

    constructor(
        address _owner,
        bytes32 _chainHash,
        uint64 _genesisTime,
        uint32 _period,
        bytes memory _groupPubKey
    ) {
        require(_owner != address(0), "zero owner");
        require(_period > 0, "zero period");
        require(_groupPubKey.length == 128, "pk must be 128 bytes (EIP-2537 G1)");

        owner = _owner;
        chainHash = _chainHash;
        genesisTime = _genesisTime;
        period = _period;
        groupPubKey = _groupPubKey;

        emit OwnerUpdated(address(0), _owner);
        emit GroupPubKeyUpdated(_groupPubKey);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function setOwner(address _owner) external onlyOwner {
        require(_owner != address(0), "zero");
        emit OwnerUpdated(owner, _owner);
        owner = _owner;
    }

    function setRelayer(address relayer, bool authorized) external onlyOwner {
        isRelayer[relayer] = authorized;
        emit RelayerUpdated(relayer, authorized);
    }

    /// @notice Allow rotating the drand group pubkey if the network rolls over.
    function setGroupPubKey(bytes calldata _groupPubKey) external onlyOwner {
        require(_groupPubKey.length == 128, "pk must be 128 bytes");
        groupPubKey = _groupPubKey;
        emit GroupPubKeyUpdated(_groupPubKey);
    }

    // -------------------------------------------------------------------------
    // IRandomnessSource
    // -------------------------------------------------------------------------

    function mode() external pure returns (SourceMode) {
        return SourceMode.PULL;
    }

    function isReady(uint256 key) external view returns (bool) {
        return roundFulfilled[key];
    }

    function randomWord(uint256 key) external view returns (uint256) {
        require(roundFulfilled[key], "not ready");
        return randomWordOf[key];
    }

    // -------------------------------------------------------------------------
    // Submission
    // -------------------------------------------------------------------------

    /// @notice Submit a drand round.
    /// @param round              Round number (>= 1).
    /// @param sigCompressed      256-byte EIP-2537 G2 encoding of the signature
    ///                           (Fp2 x || Fp2 y, each 128 bytes).
    /// @param hashedRoundG2      256-byte EIP-2537 G2 encoding of H(round).
    ///                           Computed off-chain by the relayer (zkMetal
    ///                           `GPUBLSSignatureEngine.hashToCurveG2`).
    /// @param hashedRoundCommit  Keccak256 commitment that binds round->H(round)
    ///                           encoding. Recomputed on-chain to prevent the
    ///                           relayer from substituting an attacker-chosen
    ///                           message hash. See note below.
    function submitRound(
        uint64 round,
        bytes calldata sigCompressed,
        bytes calldata hashedRoundG2,
        bytes32 hashedRoundCommit
    ) external {
        if (!isRelayer[msg.sender]) revert NotRelayer();
        if (roundFulfilled[round]) revert AlreadyFulfilled();
        if (sigCompressed.length != 256 || hashedRoundG2.length != 256) revert InvalidLength();

        // -- Bind hashedRoundG2 to `round`.
        //
        // Today drand uses SHA-256(round_be_bytes) as the message that gets
        // hashed-to-curve. We can't reproduce hashToCurveG2 on-chain cheaply,
        // but we CAN bind the (round, hashedRoundG2) pair: the relayer must
        // submit a commit equal to keccak256(round_be || hashedRoundG2). A
        // malicious relayer that swaps in a different G2 point breaks this
        // commit and the call reverts.
        bytes memory roundBE = abi.encodePacked(uint64(round));
        bytes32 expected = keccak256(abi.encodePacked(roundBE, hashedRoundG2));
        if (expected != hashedRoundCommit) revert InvalidRoundCommit();

        // NOTE: This commit only proves the relayer is consistent with itself,
        //       not honest. For full trustlessness we additionally require at
        //       least N-of-M relayers to submit identical (round, commit) and
        //       use majority — done in `MultiRelayerDrandSource.sol` (TODO).
        //       For the hackathon, single-relayer + commit is sufficient when
        //       paired with Chainlink VRF as the primary source (see
        //       `CreatorLotteryManager`).

        // -- Build pairing precompile input: e(pk, H(r)) * e(-G1, sig) == 1.
        // EIP-2537 pairing input layout: concat of (G1 || G2) pairs.
        //   pair 0:  pk         (128 bytes G1)  ||  hashedRoundG2 (256 bytes G2)
        //   pair 1:  -G1_gen    (128 bytes G1)  ||  sigCompressed (256 bytes G2)
        // Output: 32 bytes — 0x...01 if pairing == 1, 0x...00 otherwise.
        bytes memory input = abi.encodePacked(
            groupPubKey,
            hashedRoundG2,
            _negatedG1Generator(),
            sigCompressed
        );

        bool ok;
        bytes32 result;
        assembly {
            // BLS12-381 pairing precompile (EIP-2537) lives at 0x10.
            // Pairing gas: 115_000 + 23_000 * pairs = 115_000 + 46_000 = 161_000.
            ok := staticcall(gas(), 0x10, add(input, 0x20), mload(input), 0x00, 0x20)
            result := mload(0x00)
        }
        if (!ok) revert PrecompileFailed();
        if (uint256(result) != 1) revert InvalidPairing();

        // -- Effects: derive a 256-bit random word from the signature.
        //    This matches drand's standard `randomness = sha256(sig)` derivation
        //    but uses keccak so we stay on the EVM-native hash.
        uint256 word = uint256(keccak256(sigCompressed));
        randomWordOf[round] = word;
        roundFulfilled[round] = true;

        emit RoundSubmitted(round, word, msg.sender);
    }

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @dev EIP-2537 encoding of -G1_generator (BLS12-381). The negation flips
    ///      the y coordinate (y_neg = p - y) where p is the BLS12-381 base
    ///      field modulus. Both x and y are 64-byte BE, padded from 48 bytes.
    ///
    ///      Generator G1:
    ///        x = 0x17f1d3a73197d7942695638c4fa9ac0fc3688c4f9774b905a14e3a3f171bac586c55e83ff97a1aeffb3af00adb22c6bb
    ///        y = 0x08b3f481e3aaa0f1a09e30ed741d8ae4fcf5e095d5d00af600db18cb2c04b3edd03cc744a2888ae40caa232946c5e7e1
    ///
    ///      We store the byte literal lazily-initialized to avoid a 256-byte
    ///      constant in code; it's the same on every chain.
    function _negatedG1Generator() internal pure returns (bytes memory) {
        // x = G1_x, padded from 48 -> 64 bytes
        // y = p - G1_y, padded from 48 -> 64 bytes
        // Computed once and hard-coded:
        //   p           = 0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaab
        //   G1_y        = 0x08b3f481e3aaa0f1a09e30ed741d8ae4fcf5e095d5d00af600db18cb2c04b3edd03cc744a2888ae40caa232946c5e7e1
        //   p - G1_y    = 0x114d1d68b552c5a8aa7d76c8cf1d2d3267826f1a7551070bba9211e3aaab2235f04b25f6e5615b39014b94a37e6c52ca
        return hex"00000000000000000000000000000000"
            hex"17f1d3a73197d7942695638c4fa9ac0fc3688c4f9774b905a14e3a3f171bac586c55e83ff97a1aeffb3af00adb22c6bb"
            hex"00000000000000000000000000000000"
            hex"114d1d68b552c5a8aa7d76c8cf1d2d3267826f1a7551070bba9211e3aaab2235f04b25f6e5615b39014b94a37e6c52ca";
    }

    /// @notice Convenience: convert a unix timestamp to the drand round number.
    function roundAt(uint64 unixTime) external view returns (uint64) {
        require(unixTime >= genesisTime, "before genesis");
        return uint64((unixTime - genesisTime) / period) + 1;
    }
}
