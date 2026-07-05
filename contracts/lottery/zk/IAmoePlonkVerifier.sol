// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IAmoePlonkVerifier
/// @notice Minimal verifier interface matching the contract emitted by
///         `snarkjs zkey export solidityverifier` for a PLONK zkey. The shape
///         is fixed: a flat 24-element proof array followed by an 8-element
///         public-input array. PLONK avoids per-circuit ceremonies by using a
///         universal SRS (Hermez powersOfTau pot17 in our case).
///
/// The 8 public inputs are unchanged from the prior Groth16 v2 layout:
///   input[0] = walletAddrCommit       Poseidon(wallet, twitterCreditNullifier)
///   input[1] = creatorCoinAddr        160-bit
///   input[2] = nonceCommit            Poseidon(nonce, wallet, creatorCoin)
///   input[3] = epoch                  uint64
///   input[4] = allowlistRoot          Merkle root depth 20
///   input[5] = pointsBurnedAsUSD      uint64 USDC-1e6
///   input[6] = pointsLedgerRoot       Merkle root depth 20
///   input[7] = pointsBurnNullifier    Poseidon(signupIdHash, spendRefIdHash, pointsBurnedAsUSD, epoch)
///
/// See `amoe/circuits/CEREMONY.md` for the rationale on choosing PLONK over
/// per-circuit Groth16 (no trusted-setup ceremony required) and
/// `docs/security/amoe-pr4-handoff.md` for the public-input layout contract.
interface IAmoePlonkVerifier {
    function verifyProof(
        uint256[24] calldata proof,
        uint256[8] calldata input
    ) external view returns (bool);
}
