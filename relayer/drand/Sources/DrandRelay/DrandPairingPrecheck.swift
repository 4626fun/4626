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
//
// ─────────────────────────────────────────────────────────────────────────
// UPSTREAM GAP (tracked in `wenakita/4626#389`):
//
//   zkMetal's `GPUBLSSignatureEngine` is hardcoded to the *classic* BLS
//   scheme: pubkey ∈ G1, signature ∈ G2, hash-to-curve only into G2. Its
//   `verify(message:signature:publicKey:)` therefore takes
//   `signature: G2Affine381` / `publicKey: G1Affine381` — the *opposite*
//   group assignment from drand quicknet. There is also no public
//   `decompressG2PublicKey` / `decompressG1Signature` on the engine; only
//   the free function `bls12381G1Decompress(_:) -> G1Projective381?` in
//   `Sources/zkMetal/Serialization/ProofSerializer.swift` exists, and there
//   is no symmetrical G2 helper.
//
//   This means a faithful drand quicknet pairing precheck cannot be
//   implemented today against the upstream surface without (a) a G1
//   hash-to-curve, (b) a G2 decompressor, and (c) a verify variant that
//   accepts (signature ∈ G1, publicKey ∈ G2). The previous version of this
//   file referenced `BLS12_381_G2` / `BLS12_381_G1` types and
//   `decompressG2PublicKey` / `decompressG1Signature` methods that have
//   never existed in any zkMetal release.
//
//   We keep this file in the build so the rest of the relayer can compile
//   against the real zkMetal API surface. `verify(...)` returns `false` and
//   `init(...)` throws `Error.upstreamUnsupported` so callers cannot
//   accidentally treat a missing precheck as "verified". When the upstream
//   additions land, replace the stubs with real calls and delete this
//   header note.
// ─────────────────────────────────────────────────────────────────────────

import Foundation
import zkMetal

public final class DrandPairingPrecheck {
    public enum Error: Swift.Error, CustomStringConvertible {
        case engineInit(String)
        case decode(String)
        case pairingFailed
        /// drand quicknet uses scheme `bls-unchained-g1-rfc9380` (sig ∈ G1,
        /// pk ∈ G2). zkMetal currently exposes only the classic scheme
        /// (sig ∈ G2, pk ∈ G1) plus G2 hash-to-curve. Tracked in
        /// `wenakita/4626#389`.
        case upstreamUnsupported

        public var description: String {
            switch self {
            case .engineInit(let m):     return "BLS engine init failed: \(m)"
            case .decode(let m):         return "BLS point decode failed: \(m)"
            case .pairingFailed:         return "drand pairing pre-check failed"
            case .upstreamUnsupported:
                return "drand quicknet pairing precheck requires zkMetal G1 " +
                       "hash-to-curve, G2 decompression, and a (sig∈G1, pk∈G2) " +
                       "verify path; tracked in wenakita/4626#389"
            }
        }
    }

    /// Pinned 96-byte compressed quicknet pubkey, kept verbatim until zkMetal
    /// can decompress it into a `G2Affine381`. Stored so the relayer's call
    /// sites can be wired up today and exercised against golden vectors as
    /// soon as the upstream support lands.
    private let pubkeyG2Compressed: Data
    private let bls: GPUBLSSignatureEngine

    /// `pubkeyCompressed` is the 96-byte compressed G2 pubkey from
    /// `https://api.drand.sh/<chain-hash>/info`.
    public init(pubkeyCompressed: Data) throws {
        guard pubkeyCompressed.count == 96 else {
            throw Error.decode("pubkey must be 96 bytes (compressed G2), got \(pubkeyCompressed.count)")
        }
        do {
            self.bls = try GPUBLSSignatureEngine()
        } catch {
            throw Error.engineInit(String(describing: error))
        }
        self.pubkeyG2Compressed = pubkeyCompressed
        // TODO(#389): decompress to G2Affine381 once a `decompressG2(...)`
        // helper exists. Until then we cannot evaluate the pairing locally.
    }

    /// Returns true iff the (round, signature) pair verifies under the pinned
    /// quicknet group pubkey.
    ///
    /// Currently always returns `false` (and is therefore a conservative
    /// reject) because zkMetal cannot evaluate the (sig ∈ G1, pk ∈ G2)
    /// pairing required by drand quicknet — see the file header. Callers
    /// that depend on the precheck for safety must continue to treat a
    /// `false` return as "do not broadcast" until #389 lands.
    public func verify(
        round: UInt64,
        signatureCompressed: Data
    ) throws -> Bool {
        guard signatureCompressed.count == 48 else {
            throw Error.decode("signature must be 48 bytes (compressed G1), got \(signatureCompressed.count)")
        }

        // Sanity-check that the bytes parse as a G1 point. We don't use the
        // result yet (no G1 hash-to-curve / G2 decompressor available for
        // the pairing), but parsing rules out trivially-malformed input.
        let sigBytes = [UInt8](signatureCompressed)
        guard bls12381G1Decompress(sigBytes) != nil else {
            throw Error.decode("sig: bls12381G1Decompress returned nil")
        }

        // 8-byte big-endian round encoding, matching the on-chain
        // hash-to-curve input. Retained so this code path stays exercised
        // for warm-cache / round-bookkeeping diagnostics.
        var roundBE = [UInt8](repeating: 0, count: 8)
        for i in 0..<8 {
            roundBE[i] = UInt8((round >> (56 - 8 * i)) & 0xff)
        }
        _ = roundBE
        _ = self.bls
        _ = self.pubkeyG2Compressed

        // TODO(#389): once zkMetal exposes G1 hash-to-curve, G2 decompress,
        // and a (sig∈G1, pk∈G2) verify path, implement:
        //
        //   let pkG2 = try bls.decompressG2(pubkeyG2Compressed)
        //   let sigG1 = try bls.decompressG1(signatureCompressed)
        //   let hG1 = bls.hashToCurveG1(message: roundBE,
        //       dst: Array("BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_".utf8))
        //   return bls.pairingCheck(g1: [hG1, sigG1], g2: [pkG2, -g2Gen])
        //
        // Until then we conservatively reject. This is intentionally a
        // hard `false` rather than a "skip the precheck" so an upstream
        // change that re-enables `verify` cannot silently degrade to "no
        // precheck, broadcast everything".
        throw Error.upstreamUnsupported
    }
}
