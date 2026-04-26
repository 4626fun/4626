// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IAmoeGroth16Verifier
/// @notice Minimal verifier interface matching the contract emitted by either
///         snarkjs `zkey export solidityverifier` or zkMetal's
///         `generateSolidityVerifier(vk:)`. The shape is identical between the
///         two emitters (they both target snarkjs JSON), which is intentional —
///         we want to be able to swap provers without redeploying the verifier.
///
/// The 5 public inputs map 1:1 to AmoeEligibility's `public [...]` declaration:
///   input[0] = walletAddrCommit
///   input[1] = creatorCoinAddr
///   input[2] = nonceCommit
///   input[3] = epoch
///   input[4] = allowlistRoot
interface IAmoeGroth16Verifier {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[5] calldata input
    ) external view returns (bool);
}
