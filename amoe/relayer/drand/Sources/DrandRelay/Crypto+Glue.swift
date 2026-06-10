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

// Keccak-256 isn't in Apple's CryptoKit. zkMetal exposes a NEON-accelerated
// implementation as the C symbol `keccak256_hash_neon` in its `NeonFieldOps`
// target (see `Sources/NeonFieldOps/include/NeonFieldOps.h:251`), but that
// target is not re-exported as a SwiftPM product, so consumers of the
// `zkMetal` Swift module cannot reach it. Adding `NeonFieldOps` to
// `Package.swift`'s products would be the proper upstream fix; until then
// we fall back to a small pure-Swift implementation. Inputs are at most a
// few hundred bytes per drand round, so the cost is negligible.
//
// The previous version of this glue called `neon_keccak256` which never
// existed in any zkMetal release.
@inline(__always)
func import_keccak256(data: Data) -> Data {
    return Data(_KeccakF1600.hash256([UInt8](data)))
}

// MARK: - Pure-Swift Keccak-256 (FIPS 202 / Ethereum variant)
//
// Minimal Keccak-f[1600] implementation, hardcoded to rate=1088 bits / 32-byte
// digest with the original Keccak padding byte (0x01) used by Ethereum's
// keccak256. This is intentionally tiny (no SHA-3 support, no streaming) and
// is only used by the drand relayer for one short input per round.
enum _KeccakF1600 {
    private static let roundConstants: [UInt64] = [
        0x0000000000000001, 0x0000000000008082, 0x800000000000808A,
        0x8000000080008000, 0x000000000000808B, 0x0000000080000001,
        0x8000000080008081, 0x8000000000008009, 0x000000000000008A,
        0x0000000000000088, 0x0000000080008009, 0x000000008000000A,
        0x000000008000808B, 0x800000000000008B, 0x8000000000008089,
        0x8000000000008003, 0x8000000000008002, 0x8000000000000080,
        0x000000000000800A, 0x800000008000000A, 0x8000000080008081,
        0x8000000000008080, 0x0000000080000001, 0x8000000080008008,
    ]
    private static let rotations: [Int] = [
         0,  1, 62, 28, 27,
        36, 44,  6, 55, 20,
         3, 10, 43, 25, 39,
        41, 45, 15, 21,  8,
        18,  2, 61, 56, 14,
    ]

    static func hash256(_ message: [UInt8]) -> [UInt8] {
        var state = [UInt64](repeating: 0, count: 25)
        let rateBytes = 136 // 1088 bits

        // Absorb full blocks.
        var offset = 0
        while offset + rateBytes <= message.count {
            absorb(into: &state, block: message, offset: offset, length: rateBytes)
            permute(&state)
            offset += rateBytes
        }

        // Pad and absorb the final block.
        var lastBlock = [UInt8](repeating: 0, count: rateBytes)
        let remaining = message.count - offset
        for i in 0..<remaining { lastBlock[i] = message[offset + i] }
        lastBlock[remaining] = 0x01            // Ethereum / original Keccak pad
        lastBlock[rateBytes - 1] |= 0x80
        absorb(into: &state, block: lastBlock, offset: 0, length: rateBytes)
        permute(&state)

        // Squeeze 32 bytes (one rate-block worth is more than enough).
        var out = [UInt8](repeating: 0, count: 32)
        for i in 0..<32 {
            let lane = state[i / 8]
            out[i] = UInt8((lane >> UInt64(8 * (i % 8))) & 0xff)
        }
        return out
    }

    private static func absorb(into state: inout [UInt64], block: [UInt8], offset: Int, length: Int) {
        let lanes = length / 8
        for i in 0..<lanes {
            var lane: UInt64 = 0
            for b in 0..<8 {
                lane |= UInt64(block[offset + i * 8 + b]) << UInt64(8 * b)
            }
            state[i] ^= lane
        }
    }

    private static func permute(_ state: inout [UInt64]) {
        for round in 0..<24 {
            // Theta
            var c = [UInt64](repeating: 0, count: 5)
            for x in 0..<5 {
                c[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20]
            }
            var d = [UInt64](repeating: 0, count: 5)
            for x in 0..<5 {
                d[x] = c[(x + 4) % 5] ^ rotl(c[(x + 1) % 5], 1)
            }
            for x in 0..<5 {
                for y in 0..<5 {
                    state[x + 5 * y] ^= d[x]
                }
            }
            // Rho + Pi
            var b = [UInt64](repeating: 0, count: 25)
            for x in 0..<5 {
                for y in 0..<5 {
                    let nx = y
                    let ny = (2 * x + 3 * y) % 5
                    b[nx + 5 * ny] = rotl(state[x + 5 * y], rotations[x + 5 * y])
                }
            }
            // Chi
            for y in 0..<5 {
                for x in 0..<5 {
                    state[x + 5 * y] = b[x + 5 * y] ^ ((~b[((x + 1) % 5) + 5 * y]) & b[((x + 2) % 5) + 5 * y])
                }
            }
            // Iota
            state[0] ^= roundConstants[round]
        }
    }

    @inline(__always)
    private static func rotl(_ v: UInt64, _ n: Int) -> UInt64 {
        let s = UInt64(n & 63)
        return (v << s) | (v >> ((64 - s) & 63))
    }
}
