// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IAmoeGroth16Verifier (v2)
/// @notice Minimal verifier interface matching the contract emitted by either
///         snarkjs `zkey export solidityverifier` or zkMetal's
///         `generateSolidityVerifier(vk:)`. The shape is identical between the
///         two emitters (they both target snarkjs JSON), which is intentional —
///         we want to be able to swap provers without redeploying the verifier.
///
/// The 8 public inputs map 1:1 to AmoeEligibility v2's `public [...]` declaration:
///   input[0] = walletAddrCommit
///   input[1] = creatorCoinAddr
///   input[2] = nonceCommit
///   input[3] = epoch
///   input[4] = allowlistRoot
///   input[5] = pointsBurnedAsUSD       (v2 — uint64 USDC-1e6 value)
///   input[6] = pointsLedgerRoot        (v2 — daily Merkle root of points-burn ledger)
///   input[7] = pointsBurnNullifier     (v2 — global replay guard handle)
///
/// See `circuits/amoe/CEREMONY.md § Circuit versions` for the v1 → v2
/// migration plan and `docs/security/amoe-pr4-handoff.md` for the trust-gap
/// closure rationale.
interface IAmoeGroth16Verifier {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[8] calldata input
    ) external view returns (bool);
}
