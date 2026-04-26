// SPDX-License-Identifier: MIT
//
// DrandTxBuilder — wraps a DrandSubmissionPayload into a `submitRound(...)`
// transaction targeting `DrandRandomnessSource` on Base (or any EIP-2537 chain).
//
// We do NOT broadcast here; the caller does, so this stays unit-testable
// without a forked node.

import Foundation
import web3

public struct DrandTxBuilder {
    public let contractAddress: EthereumAddress
    public let chainID: Int

    public init(contractAddress: EthereumAddress, chainID: Int) {
        self.contractAddress = contractAddress
        self.chainID = chainID
    }

    /// ABI-encodes:
    ///   submitRound(uint64 round, bytes sigCompressed, bytes hashedRoundG2, bytes32 hashedRoundCommit)
    public func encodeSubmitRound(_ payload: DrandSubmissionPayload) throws -> Data {
        // function selector = first 4 bytes of keccak256("submitRound(uint64,bytes,bytes,bytes32)")
        let selector = Data([0x9c, 0x2a, 0x05, 0x4f]) // placeholder; recompute via ABIEncoder in real build

        // The real implementation should call:
        //   ABIEncoder.encodeRaw("submitRound(uint64,bytes,bytes,bytes32)",
        //                        arguments: [.uint(payload.round), .bytes(payload.signatureUncompressed), ...])
        // We sketch the layout to keep this file focused on protocol logic;
        // the test target verifies golden bytes against the real encoder.

        var calldata = selector
        calldata.append(encodeUint256(UInt256(payload.round)))
        calldata.append(encodeUint256(0x80))                                  // offset to sig
        calldata.append(encodeUint256(0x80 + 32 + UInt256(payload.signatureUncompressed.count)))
        calldata.append(payload.hashedRoundCommit)
        calldata.append(encodeUint256(UInt256(payload.signatureUncompressed.count)))
        calldata.append(payload.signatureUncompressed)
        calldata.append(encodeUint256(UInt256(payload.hashedRoundG2.count)))
        calldata.append(payload.hashedRoundG2)
        return calldata
    }

    private func encodeUint256(_ v: UInt256) -> Data {
        var data = Data(count: 32)
        var x = v
        for i in stride(from: 31, through: 0, by: -1) {
            data[i] = UInt8(x & 0xff)
            x >>= 8
        }
        return data
    }
}

// MARK: - Tiny UInt256 stub (real build pulls from web3.swift's BigInt)

public struct UInt256 {
    var lo: UInt64
    var hi: UInt64
    public init(_ v: UInt64) { self.lo = v; self.hi = 0 }
    public init(_ v: Int) { self.lo = UInt64(v); self.hi = 0 }
    static func &(_ x: UInt256, _ m: UInt8) -> UInt8 { UInt8(x.lo & UInt64(m)) }
    static func >>= (_ x: inout UInt256, _ k: Int) {
        for _ in 0..<k {
            x.lo = (x.lo >> 1) | ((x.hi & 1) << 63)
            x.hi >>= 1
        }
    }
}
