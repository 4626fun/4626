// SPDX-License-Identifier: MIT
//
// Hash glue. Kept tiny on purpose — zkMetal's batch hashing wins big when you
// have hundreds of inputs to push to the GPU; a single 32-byte hash per drand
// round is faster on CPU.

import CryptoKit
import Foundation

@inline(__always)
func import_CryptoKit_SHA256(data: Data) -> [UInt8] {
    let digest = CryptoKit.SHA256.hash(data: data)
    return Array(digest)
}

// Keccak-256 isn't in Apple's CryptoKit. We re-export from zkMetal's
// NeonFieldOps Keccak primitive. If someone is allergic to that dependency
// they can swap in CryptoSwift's Keccak — the relayer is the only consumer.
@inline(__always)
func import_keccak256(data: Data) -> Data {
    var out = Data(count: 32)
    out.withUnsafeMutableBytes { outBuf in
        data.withUnsafeBytes { inBuf in
            // zkMetal ships `neon_keccak256` in NeonFieldOps (Sources/NeonFieldOps).
            // Header is auto-bridged via Package.swift's C target.
            neon_keccak256(
                inBuf.baseAddress?.assumingMemoryBound(to: UInt8.self),
                inBuf.count,
                outBuf.baseAddress?.assumingMemoryBound(to: UInt8.self)
            )
        }
    }
    return out
}
