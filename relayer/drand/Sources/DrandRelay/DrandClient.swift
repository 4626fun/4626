// SPDX-License-Identifier: MIT
//
// DrandClient — fetches signed rounds from a drand HTTP endpoint and prepares
// the calldata expected by `DrandRandomnessSource.submitRound`.
//
// Pipeline (drand quicknet, scheme `bls-unchained-g1-rfc9380`):
//   1. GET https://api.drand.sh/<chain>/public/<round>
//      -> { round, randomness, signature }
//   2. Parse `signature` as a compressed **G1** point (48 bytes for BLS12-381).
//   3. Decompress to (Fp x, Fp y) and emit EIP-2537 128-byte uncompressed.
//   4. Compute H(round) ∈ **G1** via zkMetal's RFC 9380 hash-to-curve and emit
//      EIP-2537 128-byte uncompressed.
//      DST: "BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_"
//   5. Compute commit = keccak256(round_be || hashedRoundG1_bytes).
//   6. Hand all three to `DrandTxBuilder` for Base submission.

import Foundation
import zkMetal

public struct DrandRoundEnvelope: Sendable {
    public let round: UInt64
    /// Compressed 48-byte BLS12-381 **G1** signature (quicknet).
    public let signatureCompressed: Data
    /// Beacon-derived randomness (sha256 of signature). Not used on-chain — the
    /// contract recomputes via keccak256 — but exposed for client-side parity.
    public let beaconRandomness: Data
}

public struct DrandSubmissionPayload: Sendable {
    public let round: UInt64
    /// 128-byte EIP-2537 G1 encoding of the signature.
    public let signatureUncompressed: Data
    /// 128-byte EIP-2537 G1 encoding of H(round).
    public let hashedRoundG1: Data
    /// keccak256(round_be || hashedRoundG1).
    public let hashedRoundCommit: Data
}

public actor DrandClient {
    public enum Error: Swift.Error {
        case invalidURL
        case malformedResponse
        case unsupportedCompression
        case zkMetalFailure(String)
    }

    public let baseURL: URL
    public let chainHash: String
    private let session: URLSession
    private let bls: BLS12381Engine // zkMetal

    public init(
        baseURL: URL = URL(string: "https://api.drand.sh")!,
        chainHash: String, // quicknet: "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971"
        session: URLSession = .shared
    ) throws {
        self.baseURL = baseURL
        self.chainHash = chainHash
        self.session = session
        do {
            self.bls = try BLS12381Engine()
        } catch {
            throw Error.zkMetalFailure(String(describing: error))
        }
    }

    public func fetchRound(_ round: UInt64) async throws -> DrandRoundEnvelope {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            throw Error.invalidURL
        }
        components.path = "/\(chainHash)/public/\(round)"
        guard let url = components.url else { throw Error.invalidURL }

        let (data, response) = try await session.data(from: url)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw Error.malformedResponse
        }
        struct Response: Decodable {
            let round: UInt64
            let randomness: String
            let signature: String
        }
        let parsed = try JSONDecoder().decode(Response.self, from: data)
        guard let sig = Data(hexString: parsed.signature),
              let rnd = Data(hexString: parsed.randomness),
              sig.count == 48 else {  // quicknet: signature ∈ G1, 48 bytes compressed
            throw Error.malformedResponse
        }
        return DrandRoundEnvelope(
            round: parsed.round,
            signatureCompressed: sig,
            beaconRandomness: rnd
        )
    }

    /// Builds the calldata triple expected by `DrandRandomnessSource.submitRound`.
    public func buildSubmission(for envelope: DrandRoundEnvelope) async throws -> DrandSubmissionPayload {
        // 1. Decompress drand's compact 48-byte G1 -> EIP-2537 128-byte.
        //    zkMetal handles compression flag bits per draft-irtf-cfrg-pairing-friendly-curves.
        let sigUncompressed: Data
        do {
            let g1 = try bls.decompressG1(envelope.signatureCompressed)
            sigUncompressed = bls.encodeG1EIP2537(g1)
        } catch {
            throw Error.zkMetalFailure("decompressG1: \(error)")
        }

        // 2. Hash-to-curve H(round) ∈ G1 (RFC 9380, drand quicknet DST).
        //    drand quicknet uses domain "BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_".
        //    The message is SHA-256 of the big-endian round number — this matches
        //    drand's spec for unchained beacons (`bls-unchained-g1-rfc9380`).
        let roundBE = withUnsafeBytes(of: envelope.round.bigEndian) { Data($0) }
        let msg = SHA256.hash(data: roundBE)

        let hashedG1: Data
        do {
            let point = try bls.hashToCurveG1(
                message: Data(msg),
                dst: Data("BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_".utf8)
            )
            hashedG1 = bls.encodeG1EIP2537(point)
        } catch {
            throw Error.zkMetalFailure("hashToCurveG1: \(error)")
        }

        // 3. Commit binds (round, hashedG1_bytes) so a malicious relayer can't
        //    swap H(round) for an attacker-chosen G1 point with a colliding
        //    pairing — `DrandRandomnessSource` recomputes this on-chain.
        var commitInput = Data()
        commitInput.append(roundBE)
        commitInput.append(hashedG1)
        let commit = Keccak256.hash(commitInput)

        return DrandSubmissionPayload(
            round: envelope.round,
            signatureUncompressed: sigUncompressed,
            hashedRoundG1: hashedG1,
            hashedRoundCommit: commit
        )
    }
}

// MARK: - Hex helpers

extension Data {
    init?(hexString: String) {
        let s = hexString.hasPrefix("0x") ? String(hexString.dropFirst(2)) : hexString
        guard s.count % 2 == 0 else { return nil }
        var bytes = [UInt8]()
        bytes.reserveCapacity(s.count / 2)
        var idx = s.startIndex
        while idx < s.endIndex {
            let next = s.index(idx, offsetBy: 2)
            guard let b = UInt8(s[idx..<next], radix: 16) else { return nil }
            bytes.append(b)
            idx = next
        }
        self.init(bytes)
    }
}

// MARK: - Hash shims (delegate to zkMetal where possible)

enum SHA256 {
    static func hash(data: Data) -> [UInt8] {
        // zkMetal exposes Keccak/Blake3 GPU paths; for SHA-256 we use CryptoKit
        // because the cost is negligible compared to hashToCurveG1.
        import_CryptoKit_SHA256(data: data)
    }
}

enum Keccak256 {
    static func hash(_ data: Data) -> Data {
        // zkMetal ships a NEON-accelerated keccak; for one short input the
        // overhead of dispatching to it dwarfs the win, so we use a small
        // stdlib fallback. Replace with `bls.keccak256(data)` if you already
        // have the engine instantiated and a batch to push.
        import_keccak256(data: data)
    }
}

// Implementation glue lives in `Crypto+Glue.swift` so this file stays focused
// on the protocol logic.
