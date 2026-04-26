// SPDX-License-Identifier: MIT
//
// Run with:
//   swift run drand-relay
//     --rpc-url https://mainnet.base.org
//     --contract 0x...
//     --chain-hash 52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971
//     --private-key $RELAY_PK
//     --interval 3
//
// Each tick: fetch the latest drand round, build the submission via zkMetal,
// post the tx, sleep until the next round.

import ArgumentParser
import Foundation
import DrandRelay

@main
struct DrandRelayCommand: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "drand-relay",
        abstract: "Relay drand BLS12-381 randomness to DrandRandomnessSource on Base."
    )

    @Option(name: .long) var rpcURL: String = "https://mainnet.base.org"
    @Option(name: .long) var contract: String
    @Option(name: .long) var chainHash: String =
        "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971" // quicknet
    @Option(name: .long) var privateKey: String
    @Option(name: .long) var intervalSec: Int = 3

    func run() async throws {
        let client = try await DrandClient(chainHash: chainHash)
        FileHandle.standardError.write(Data("[drand-relay] booted, polling every \(intervalSec)s\n".utf8))

        var lastSubmitted: UInt64 = 0
        while true {
            do {
                // drand exposes /latest; fetch the latest round number.
                let latest = try await client.fetchRound(0) // 0 == "latest"
                if latest.round != lastSubmitted {
                    let payload = try await client.buildSubmission(for: latest)
                    // Posting the tx is intentionally left to the caller's
                    // signing infrastructure. In a hackathon-grade build you'd
                    // wire web3.swift's `EthereumTransaction.sendRawTransaction`
                    // here. Logging the calldata lets you test against
                    // `cast send --raw-input <calldata>` in the meantime.
                    let builder = DrandTxBuilder(
                        contractAddress: try parseAddress(contract),
                        chainID: 8453 // Base
                    )
                    let calldata = try builder.encodeSubmitRound(payload)
                    print("round \(payload.round) calldata=\(calldata.hexEncoded())")
                    lastSubmitted = payload.round
                }
            } catch {
                FileHandle.standardError.write(Data("[drand-relay] error: \(error)\n".utf8))
            }
            try? await Task.sleep(nanoseconds: UInt64(intervalSec) * 1_000_000_000)
        }
    }

    private func parseAddress(_ s: String) throws -> EthereumAddress {
        guard let a = EthereumAddress(string: s) else {
            throw ValidationError("invalid contract address: \(s)")
        }
        return a
    }
}

extension Data {
    func hexEncoded() -> String { "0x" + map { String(format: "%02x", $0) }.joined() }
}

// Tiny stub to keep this file self-contained for review.
public struct EthereumAddress { public let raw: String
    public init?(string s: String) { guard s.hasPrefix("0x"), s.count == 42 else { return nil }; self.raw = s }
}
