// SPDX-License-Identifier: MIT
//
// AmoeAllowlist — depth-20 Poseidon Merkle tree over the AMOE allowlist,
// backed by zkMetal's `IncrementalMerkleTree` engine.
//
// Why this exists:
//   The AMOE circuit pins `merkleDepth = 20` and uses Poseidon2 over BN254 as
//   the hash. Building the tree off-band in Python (as we did initially) is
//   slow for large allowlists and forces us to maintain a second Poseidon
//   implementation that has to stay bit-identical to the in-circuit one.
//   zkMetal already ships the exact same Poseidon2-BN254 instantiation that
//   `circomlib`'s `Poseidon` template uses, so the on-chain root and the
//   in-circuit root agree by construction.
//
// Production usage:
//   1. The relayer maintains an `AmoeAllowlist` in memory keyed by epoch.
//   2. For each new claimant address it calls `insert(leaf:)`. The new
//      Merkle root is published on-chain via the existing AMOE allowlist
//      publisher.
//   3. When a claimant proves eligibility, we hand them the path with
//      `proof(forIndex:)` and they feed it into `AmoeProver`.

import Foundation
import zkMetal

public final class AmoeAllowlist {
    public static let depth = 20
    public static let zeroLeaf: Fr = .zero

    private let tree: IncrementalMerkleTree

    /// Number of leaves currently inserted (next free slot).
    public private(set) var count: Int = 0

    public init() throws {
        // zkMetal's IncrementalMerkleTree currently exposes only `init(depth:)`
        // and `init(depth:engine:)` -- the hasher is fixed to Poseidon2 over
        // BN254 internally and the empty-leaf is zero. That happens to be
        // exactly what the AMOE circuit pins, so the on-chain root and the
        // in-circuit root agree by construction. If zkMetal ever pluralises
        // the hasher this is the constructor to update.
        do {
            self.tree = try IncrementalMerkleTree(depth: AmoeAllowlist.depth)
        } catch {
            throw AmoeAllowlistError.engineInit(String(describing: error))
        }
    }

    /// Append a leaf. Returns the leaf index it was placed at.
    @discardableResult
    public func insert(leaf: Fr) throws -> Int {
        guard count < (1 << AmoeAllowlist.depth) else {
            throw AmoeAllowlistError.full
        }
        do {
            // zkMetal's API is `append(leaf:)`, not `insert(leaf:)`. We keep
            // our public method name as `insert` because that's what the rest
            // of the relayer says.
            try tree.append(leaf: leaf)
            let i = count
            count += 1
            return i
        } catch {
            throw AmoeAllowlistError.insertFailed(String(describing: error))
        }
    }

    /// Current root. Identical to the value the AMOE circuit will compute.
    public var root: Fr { tree.root }

    /// Build the witness path for a leaf at `index`.
    /// `siblings.count == depth`, `bits.count == depth`. Bits are Fr-packed
    /// (0 or 1) to match snarkjs witness convention.
    public func proof(forIndex index: Int) throws -> (siblings: [Fr], bits: [Fr]) {
        guard index >= 0 && index < count else {
            throw AmoeAllowlistError.indexOutOfRange(index: index, count: count)
        }
        // zkMetal's `proof(index:)` is total -- it returns a `MerkleProof`
        // with `.siblings: [Fr]` and `.pathBits: [Bool]`.
        let p = tree.proof(index: index)
        let bits = p.pathBits.map { $0 ? Fr.one : Fr.zero }
        return (p.siblings, bits)
    }
}

public enum AmoeAllowlistError: Error, CustomStringConvertible {
    case engineInit(String)
    case full
    case insertFailed(String)
    case indexOutOfRange(index: Int, count: Int)
    case pathFailed(String)

    public var description: String {
        switch self {
        case .engineInit(let m):  return "IncrementalMerkleTree init failed: \(m)"
        case .full:               return "AMOE allowlist is full (2^\(AmoeAllowlist.depth) leaves)"
        case .insertFailed(let m): return "leaf insert failed: \(m)"
        case .indexOutOfRange(let i, let c):
            return "leaf index \(i) out of range (count=\(c))"
        case .pathFailed(let m):  return "path query failed: \(m)"
        }
    }
}
