// SPDX-License-Identifier: MIT
//
// DrandPairingPrecheck — off-chain BLS12-381 pairing check that mirrors what
// `DrandRandomnessSource.submitRound` will do on-chain. The relayer runs this
// before paying gas; if the pairing fails locally, we never broadcast.
//
// Why this exists:
//   The on-chain pairing precompile call at EIP-2537 0x0f is cheap by L2
//   standards (~135k gas total for submitRound) but it's not free, and a
//   reverted tx still costs gas. drand rounds are public, so any malformed
//   round broadcast by an attacker (or a transient HTTP error) shouldn't
//   make us submit. This check is the same equation, run on the GPU via
//   zkMetal's `GPUBLSSignatureEngine`.
//
// Equation (drand quicknet, scheme `bls-unchained-g1-rfc9380`):
//   pubkey ∈ G2, signature ∈ G1, H(round) ∈ G1.
//   On-chain we check: e(H(round), pk) * e(σ, -g2_gen) == 1.
//   Equivalently:       e(H(round), pk) == e(σ, g2_gen).
//   `GPUBLSSignatureEngine.verifyBatch` runs the second form natively.
//
// This file is additive — DrandClient still produces the same submission
// payload. The relayer simply consults `DrandPairingPrecheck` first.

import Foundation
import zkMetal

public final class DrandPairingPrecheck {
    public enum Error: Swift.Error, CustomStringConvertible {
        case engineInit(String)
        case decode(String)
        case pairingFailed

        public var description: String {
            switch self {
            case .engineInit(let m): return "BLS engine init failed: \(m)"
            case .decode(let m):     return "BLS point decode failed: \(m)"
            case .pairingFailed:     return "drand pairing pre-check failed"
            }
        }
    }

    /// Pinned 96-byte compressed quicknet pubkey (decoded once at init).
    private let pubkeyG2: BLS12_381_G2
    private let bls: GPUBLSSignatureEngine

    /// `pubkeyCompressed` is the 96-byte compressed G2 pubkey from
    /// `https://api.drand.sh/<chain-hash>/info`.
    public init(pubkeyCompressed: Data) throws {
        do {
            self.bls = try GPUBLSSignatureEngine()
        } catch {
            throw Error.engineInit(String(describing: error))
        }
        do {
            self.pubkeyG2 = try bls.decompressG2PublicKey(pubkeyCompressed)
        } catch {
            throw Error.decode("pubkey: \(error)")
        }
    }

    /// Returns true iff the (round, signature) pair verifies under the pinned
    /// quicknet group pubkey. `signatureCompressed` is the 48-byte compressed
    /// G1 signature as fetched from drand. `roundMessage` is the 8-byte
    /// big-endian encoding of the round, exactly matching what the on-chain
    /// hash-to-curve consumes.
    public func verify(
        round: UInt64,
        signatureCompressed: Data
    ) throws -> Bool {
        let sigG1: BLS12_381_G1
        do {
            sigG1 = try bls.decompressG1Signature(signatureCompressed)
        } catch {
            throw Error.decode("sig: \(error)")
        }

        var roundBE = Data(count: 8)
        for i in 0..<8 {
            roundBE[i] = UInt8((round >> (56 - 8 * i)) & 0xff)
        }

        // drand quicknet hash-to-curve DST per RFC 9380.
        // Must match the on-chain code path exactly.
        let dst = "BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_"

        return bls.verify(
            publicKey: pubkeyG2,
            message: roundBE,
            signature: sigG1,
            domainSeparationTag: dst
        )
    }
}
