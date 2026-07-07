// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IAmoePlonkVerifier
/// @notice Minimal verifier interface matching the contract emitted by
///         `snarkjs zkey export solidityverifier` for a PLONK zkey. The shape
///         is fixed: a flat 24-element proof array followed by an 8-element
///         public-input array. PLONK avoids per-circuit ceremonies by using a
///         universal SRS (Hermez powersOfTau pot17 in our case).
///
/// The 9 public inputs match circuit v3:
///   input[0] = walletAddrCommit       Poseidon(wallet, twitterCreditNullifier)
///   input[1] = creatorCoinAddr        160-bit
///   input[2] = nonceCommit            Poseidon(nonce, wallet, creatorCoin)
///   input[3] = epoch                  uint64
///   input[4] = allowlistRoot          Merkle root depth 20
///   input[5] = pointsBurnedAsUSD      uint64 USDC-1e6
///   input[6] = pointsLedgerRoot       Merkle root depth 20
///   input[7] = pointsBurnNullifier    Poseidon(signupIdHash, spendRefIdHash, pointsBurnedAsUSD, epoch)
///   input[8] = walletAddr             160-bit proven wallet (v3 buyer binding)
interface IAmoePlonkVerifier {
    function verifyProof(
        uint256[24] calldata proof,
        uint256[9] calldata input
    ) external view returns (bool);
}
