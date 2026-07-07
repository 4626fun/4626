// SPDX-License-Identifier: MIT
//
// AmoeInputs — strongly-typed view of the 9 public inputs and the private
// witness fields required by `amoe/circuits/amoe_eligibility.circom` (v3).
//
// IMPORTANT: field names and ordering here MUST track the circuit literally.
// See `amoe/circuits/amoe_eligibility.circom`:
//
// Public inputs (circuit v3 — 9 signals):
//   0  walletAddrCommit   Poseidon(wallet, twitterCreditNullifier)
//   1  creatorCoinAddr    address of the creator coin (uint160 packed in Fr)
//   2  nonceCommit        Poseidon(nonce, wallet, creatorCoin)
//   3  epoch              current AMOE epoch id (uint64 packed in Fr)
//   4  allowlistRoot      Poseidon Merkle root of the daily wallet allowlist
//   5  pointsBurnedAsUSD  uint64 — value bound into the proof
//   6  pointsLedgerRoot   Merkle root of the points-burn ledger
//   7  pointsBurnNullifier Poseidon(signupIdHash, spendRefIdHash, pointsBurnedAsUSD, epoch)
//   8  walletAddr         proven wallet (uint160) — v3 buyer binding
//
// Private inputs (witness only, in circom declaration order):
//   wallet                 EOA / smart-wallet address (uint160)
//   nonce                  server-issued nonce
//   twitterCreditNullifier Poseidon(twitterUserId, epoch, secretSalt)
//   pathElements[20]       Poseidon Merkle sibling hashes
//   pathIndices[20]        0/1 left/right bits per level
//   signupIdHash, spendRefIdHash, pointsLedgerPathElements/Indices[20]
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
    public let pointsBurnedAsUSD: Fr
    public let pointsLedgerRoot: Fr
    public let pointsBurnNullifier: Fr
    public let walletAddr: Fr

    public init(
        walletAddrCommit: Fr,
        creatorCoinAddr: Fr,
        nonceCommit: Fr,
        epoch: Fr,
        allowlistRoot: Fr,
        pointsBurnedAsUSD: Fr,
        pointsLedgerRoot: Fr,
        pointsBurnNullifier: Fr,
        walletAddr: Fr
    ) {
        self.walletAddrCommit = walletAddrCommit
        self.creatorCoinAddr = creatorCoinAddr
        self.nonceCommit = nonceCommit
        self.epoch = epoch
        self.allowlistRoot = allowlistRoot
        self.pointsBurnedAsUSD = pointsBurnedAsUSD
        self.pointsLedgerRoot = pointsLedgerRoot
        self.pointsBurnNullifier = pointsBurnNullifier
        self.walletAddr = walletAddr
    }

    /// Order matters — must match the circuit `public []` declaration and
    /// `AmoePlonkVerifier` public-input indices 0..8.
    public var asArray: [Fr] {
        [
            walletAddrCommit,
            creatorCoinAddr,
            nonceCommit,
            epoch,
            allowlistRoot,
            pointsBurnedAsUSD,
            pointsLedgerRoot,
            pointsBurnNullifier,
            walletAddr,
        ]
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
