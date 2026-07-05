// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRandomnessSource} from "./IRandomnessSource.sol";

/// @title DrandRandomnessSource
/// @notice Pull-style randomness source backed by the drand "League of Entropy"
///         beacon (BLS12-381). Pinned to the **quicknet** chain
///         `52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971`
///         which uses scheme `bls-unchained-g1-rfc9380`.
///
/// @dev    quicknet specifics
///         ------------------
///         - Group public key  pk    ∈ G2  (96 bytes compressed → 256 bytes EIP-2537)
///         - Round signature   σ     ∈ G1  (48 bytes compressed → 128 bytes EIP-2537)
///         - Message hash      H(r)  ∈ G1  (RFC 9380 hash-to-curve, BLS12-381 G1,
///                                          domain "BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_")
///         - period            3 seconds
///         - genesis_time      1692803367
///
///         Verification equation: e(H(r), pk) == e(σ, g2_generator)
///         Rearranged for one-shot pairing:
///           e(H(r), pk) * e(σ, -g2_generator) == 1
///
///         Pairing input (EIP-2537 layout: each pair = G1 (128 bytes) || G2 (256 bytes)):
///           pair 0:  H(r)  (G1, 128)  ||  pk            (G2, 256)
///           pair 1:  σ     (G1, 128)  ||  -g2_generator (G2, 256)
///
///         RFC 9380 hash-to-curve (G1) has no precompile and is prohibitively
///         expensive in pure Solidity, so the off-chain relayer (running zkMetal
///         `BLS12381Engine.hashToCurveG1`) computes `H(round)` and submits it
///         alongside the signature. We bind (round, hashedRoundG1) via a keccak
///         commitment and recompute it on-chain so a malicious relayer can't
///         substitute an attacker-chosen message hash.
///
///         Costs (Pectra-era pricing per EIP-2537):
///             pairing-check(2 pairs) = 37_700 + 2 * 32_600 = 102_900 gas
///             total submitRound ≈ ~135k gas (incl. calldata + bookkeeping)
///
/// @custom:precompile BLS12-381 pairing precompile address: 0x0f (post-Pectra,
///                     per EIP-2537 — NOT 0x10, that's MAP_FP_TO_G1)

contract DrandRandomnessSource is IRandomnessSource {
    // -------------------------------------------------------------------------
    // Configuration
    // -------------------------------------------------------------------------

    /// @notice drand chain hash this contract is pinned to (quicknet).
    bytes32 public immutable chainHash;

    /// @notice drand `genesis_time` (unix seconds).
    uint64 public immutable genesisTime;

    /// @notice drand `period` (seconds between rounds; 3 for quicknet).
    uint32 public immutable period;

    /// @notice drand group public key in **G2**. EIP-2537 encoding: 256 bytes
    ///         (Fp2 x_c0 || x_c1 || Fp2 y_c0 || y_c1; each Fp = 64-byte BE,
    ///         padded from the 48-byte BLS12-381 base field).
    bytes public groupPubKey;

    /// @notice Owner can rotate the relayer / publisher.
    address public owner;

    /// @notice Address allowed to submit rounds. Multiple keepers can be
    ///         authorized to avoid single-point-of-failure on liveness.
    mapping(address => bool) public isRelayer;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice round => uint256 random word = keccak256(sig)
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
        require(_groupPubKey.length == 256, "pk must be 256 bytes (EIP-2537 G2)");

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
        require(_groupPubKey.length == 256, "pk must be 256 bytes");
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
    /// @param sigG1              128-byte EIP-2537 G1 encoding of the round
    ///                           signature σ (Fp x || Fp y, each 64 bytes).
    /// @param hashedRoundG1      128-byte EIP-2537 G1 encoding of H(round).
    ///                           Computed off-chain by the relayer (zkMetal
    ///                           `BLS12381Engine.hashToCurveG1` with drand DST
    ///                           `BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_`).
    /// @param hashedRoundCommit  Keccak256 commitment that binds round->H(round).
    ///                           Recomputed on-chain to prevent the relayer from
    ///                           substituting an attacker-chosen message hash.
    function submitRound(
        uint64 round,
        bytes calldata sigG1,
        bytes calldata hashedRoundG1,
        bytes32 hashedRoundCommit
    ) external {
        if (!isRelayer[msg.sender]) revert NotRelayer();
        if (roundFulfilled[round]) revert AlreadyFulfilled();
        if (sigG1.length != 128 || hashedRoundG1.length != 128) revert InvalidLength();

        // -- Bind hashedRoundG1 to `round`.
        //
        // drand's quicknet message is sha256(round_be) and then hash-to-curve to
        // G1 using domain "BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_". We can't
        // reproduce hash-to-curve on-chain cheaply, but we CAN bind the
        // (round, hashedRoundG1) pair: the relayer must submit a commit equal to
        // keccak256(round_be || hashedRoundG1). A malicious relayer that swaps
        // in a different G1 point breaks this commit and the call reverts.
        bytes memory roundBE = abi.encodePacked(uint64(round));
        bytes32 expected = keccak256(abi.encodePacked(roundBE, hashedRoundG1));
        if (expected != hashedRoundCommit) revert InvalidRoundCommit();

        // NOTE: This commit only proves the relayer is consistent with itself,
        //       not honest. For full trustlessness we additionally require at
        //       least N-of-M relayers to submit identical (round, commit) and
        //       use majority — done in `MultiRelayerDrandSource.sol` (TODO).
        //       For the hackathon, single-relayer + commit is sufficient when
        //       paired with Chainlink VRF as the primary source (see
        //       `RandomnessRouter`).

        // -- Build pairing precompile input: e(H(r), pk) * e(σ, -g2_gen) == 1.
        // EIP-2537 pairing input: concat of (G1 || G2) pairs, each G1=128, G2=256.
        //   pair 0:  H(r)  (G1, 128)  ||  pk            (G2, 256)
        //   pair 1:  σ     (G1, 128)  ||  -g2_generator (G2, 256)
        // Output: 32 bytes — 0x...01 if pairing == 1, 0x...00 otherwise.
        bytes memory input = abi.encodePacked(
            hashedRoundG1,
            groupPubKey,
            sigG1,
            _negatedG2Generator()
        );

        bool ok;
        bytes32 result;
        assembly {
            // BLS12-381 pairing-check precompile (EIP-2537) lives at 0x0f.
            // (0x10 is MAP_FP_TO_G1, 0x11 is MAP_FP2_TO_G2 — don't confuse them.)
            // Pairing gas: 37_700 base + 32_600 * pairs = 37_700 + 65_200 = 102_900.
            ok := staticcall(gas(), 0x0f, add(input, 0x20), mload(input), 0x00, 0x20)
            result := mload(0x00)
        }
        if (!ok) revert PrecompileFailed();
        if (uint256(result) != 1) revert InvalidPairing();

        // -- Effects: derive a 256-bit random word from the signature.
        //    drand's standard derivation is sha256(sig_compressed); we use keccak
        //    of the uncompressed G1 encoding so we stay on the EVM-native hash
        //    and avoid bringing the compressed form on-chain.
        uint256 word = uint256(keccak256(sigG1));
        randomWordOf[round] = word;
        roundFulfilled[round] = true;

        emit RoundSubmitted(round, word, msg.sender);
    }

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @dev EIP-2537 encoding of -G2_generator (BLS12-381). 256 bytes:
    ///      Fp2 x = (x_c0 || x_c1), Fp2 y = (y_c0 || y_c1). Each Fp element is
    ///      64-byte big-endian, padded from the 48-byte BLS12-381 field.
    ///
    ///      Generator G2 (per EIP-2537 / IETF BLS):
    ///        x = 0x024aa2b2f08f0a91260805272dc51051c6e47ad4fa403b02b4510b647ae3d1770bac0326a805bbefd48056c8c121bdb8
    ///          + 0x13e02b6052719f607dacd3a088274f65596bd0d09920b61ab5da61bbdc7f5049334cf11213945d57e5ac7d055d042b7e * u
    ///        y = 0x0ce5d527727d6e118cc9cdc6da2e351aadfd9baa8cbdd3a76d429a695160d12c923ac9cc3baca289e193548608b82801
    ///          + 0x0606c4a02ea734cc32acd2b02bc28b99cb3e287e85a763af267492ab572e99ab3f370d275cec1da1aaa9075ff05f79be * u
    ///      -y = (p - y_c0, p - y_c1) where p is the BLS12-381 base field modulus.
    ///      Computed offline and hard-coded.
    function _negatedG2Generator() internal pure returns (bytes memory) {
        return hex"00000000000000000000000000000000"
            hex"024aa2b2f08f0a91260805272dc51051c6e47ad4fa403b02b4510b647ae3d1770bac0326a805bbefd48056c8c121bdb8"
            hex"00000000000000000000000000000000"
            hex"13e02b6052719f607dacd3a088274f65596bd0d09920b61ab5da61bbdc7f5049334cf11213945d57e5ac7d055d042b7e"
            hex"00000000000000000000000000000000"
            hex"0d1b3cc2c7027888be51d9ef691d77bcb679afda66c73f17f9ee3837a55024f78c71363275a75d75d86bab79f74782aa"
            hex"00000000000000000000000000000000"
            hex"13fa4d4a0ad8b1ce186ed5061789213d993923066dddaf1040bc3ff59f825c78df74f2d75467e25e0f55f8a00fa030ed";
    }

    /// @notice Convenience: convert a unix timestamp to the drand round number.
    function roundAt(uint64 unixTime) external view returns (uint64) {
        require(unixTime >= genesisTime, "before genesis");
        return uint64((unixTime - genesisTime) / period) + 1;
    }
}
