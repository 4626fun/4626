// SPDX-License-Identifier: MIT
//
// AmoeInputs — strongly-typed view of the 5 public inputs and the private
// witness fields required by `circuits/amoe/amoe_eligibility.circom`.
//
// IMPORTANT: field names and ordering here MUST track the circuit literally.
// See `circuits/amoe/amoe_eligibility.circom`:
//
//   component main {
//     public [walletAddrCommit, creatorCoinAddr, nonceCommit, epoch, allowlistRoot]
//   } = AmoeEligibility(20);
//
// Public inputs (this is the order the verifier and `public.json` expect —
// snarkjs / Groth16Verifier.IC indices 1..5):
//   0  walletAddrCommit   Poseidon(wallet, twitterCreditNullifier)
//   1  creatorCoinAddr    address of the creator coin (uint160 packed in Fr)
//   2  nonceCommit        Poseidon(nonce, wallet, creatorCoin)
//   3  epoch              current AMOE epoch id (uint64 packed in Fr)
//   4  allowlistRoot      Poseidon Merkle root of the daily wallet allowlist
//
// Private inputs (witness only, in circom declaration order):
//   wallet                 EOA / smart-wallet address (uint160)
//   nonce                  server-issued nonce
//   twitterCreditNullifier Poseidon(twitterUserId, epoch, secretSalt)
//   pathElements[20]       Poseidon Merkle sibling hashes
//   pathIndices[20]        0/1 left/right bits per level
//
// We deliberately keep this struct dependency-light (only Foundation + the few
// zkMetal field types we need to encode). The CLI layer is responsible for
// reading user-facing JSON and converting it to this struct.

import Foundation
import zkMetal

public struct AmoePublicInputs: Sendable, Equatable {
    public let walletAddrCommit: Fr
    public let creatorCoinAddr: Fr
    public let nonceCommit: Fr
    public let epoch: Fr
    public let allowlistRoot: Fr

    public init(
        walletAddrCommit: Fr,
        creatorCoinAddr: Fr,
        nonceCommit: Fr,
        epoch: Fr,
        allowlistRoot: Fr
    ) {
        self.walletAddrCommit = walletAddrCommit
        self.creatorCoinAddr = creatorCoinAddr
        self.nonceCommit = nonceCommit
        self.epoch = epoch
        self.allowlistRoot = allowlistRoot
    }

    /// Order matters — must match `Groth16Verifier.IC` indices 1..5 and the
    /// `public []` declaration in `amoe_eligibility.circom`.
    public var asArray: [Fr] {
        [walletAddrCommit, creatorCoinAddr, nonceCommit, epoch, allowlistRoot]
    }
}

public struct AmoePrivateWitness: Sendable {
    /// Length of `pathElements` / `pathIndices` must equal `AmoeProver.merkleDepth` (20).
    public let wallet: Fr
    public let nonce: Fr
    public let twitterCreditNullifier: Fr
    public let pathElements: [Fr]
    /// 0 / 1 per level, packed as Fr for snarkjs compatibility.
    public let pathIndices: [Fr]

    public init(
        wallet: Fr,
        nonce: Fr,
        twitterCreditNullifier: Fr,
        pathElements: [Fr],
        pathIndices: [Fr]
    ) {
        self.wallet = wallet
        self.nonce = nonce
        self.twitterCreditNullifier = twitterCreditNullifier
        self.pathElements = pathElements
        self.pathIndices = pathIndices
    }
}

public enum AmoeInputsError: Error, CustomStringConvertible {
    case wrongMerkleDepth(have: Int, need: Int)
    case nonBinaryPathBit(index: Int, value: String)

    public var description: String {
        switch self {
        case .wrongMerkleDepth(let have, let need):
            return "AMOE merkle depth mismatch: have \(have), need \(need)"
        case .nonBinaryPathBit(let index, let value):
            return "AMOE merkle path bit at \(index) is not 0/1: \(value)"
        }
    }
}
