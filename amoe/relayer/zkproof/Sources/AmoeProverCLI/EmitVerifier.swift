// SPDX-License-Identifier: MIT
//
// emit-verifier subcommand — re-emits AmoeGroth16Verifier.sol from the AMOE
// verification key using zkMetal's `generateSolidityVerifier`.
//
// This replaces snarkjs's `zkey export solidityverifier`, which produces a
// GPL-3.0 contract. zkMetal's emitter is MIT-licensed and produces a
// functionally identical contract that uses the same EVM bn256 precompiles
// (ecAdd 0x06, ecMul 0x07, ecPairing 0x08).
//
// Usage:
//   amoe-prover emit-verifier \
//     --vk amoe/circuits/build/verification_key.json \
//     --out contracts/utilities/lottery/zk/AmoeGroth16Verifier.sol \
//     --name AmoeGroth16Verifier

import ArgumentParser
import Foundation
import zkMetal

struct EmitVerifier: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "emit-verifier",
        abstract: "Emit MIT-licensed AmoeGroth16Verifier.sol from the AMOE VK."
    )

    @Option(help: "Path to verification_key.json (snarkjs format)")
    var vk: String

    @Option(help: "Path to write the Solidity verifier")
    var out: String

    @Option(help: "Solidity contract name")
    var name: String = "AmoeGroth16Verifier"

    func run() throws {
        let vkData = try Data(contentsOf: URL(fileURLWithPath: vk))
        // zkMetal's `fromSnarkjsJSON(_:)` returns `Groth16VerificationKey?`
        // (it's a non-throwing failable parser). Surface a clear error if
        // the snarkjs file can't be decoded.
        guard let parsed = Groth16VerificationKey.fromSnarkjsJSON(vkData) else {
            throw ValidationError("failed to parse verification_key.json: \(vk)")
        }
        var src = generateSolidityVerifier(vk: parsed)

        // zkMetal's emitter outputs `contract Groth16Verifier { ... }`. The
        // 4626 codebase needs a stable name (`AmoeGroth16Verifier`) so it
        // matches deploy scripts and tests. Rename in-place.
        src = src.replacingOccurrences(
            of: "contract Groth16Verifier",
            with: "contract \(name)"
        )

        // Pin SPDX-License-Identifier to MIT and add a stable header so diffs
        // between regenerations are minimal.
        let header = """
        // SPDX-License-Identifier: MIT
        // \(name) — Groth16 verifier emitted by zkMetal.generateSolidityVerifier.
        // Do not hand-edit; re-run `amoe-prover emit-verifier` to regenerate.

        """
        // Strip any pre-existing SPDX line zkMetal emits to avoid duplicates.
        src = stripLeadingSPDX(src)
        src = header + src

        try src.write(
            to: URL(fileURLWithPath: out),
            atomically: true,
            encoding: .utf8
        )
        let msg = "emit-verifier: wrote \(out)\n"
        FileHandle.standardError.write(Data(msg.utf8))
    }

    private func stripLeadingSPDX(_ s: String) -> String {
        var lines = s.split(separator: "\n", omittingEmptySubsequences: false)
        while let first = lines.first,
              first.contains("SPDX-License-Identifier") {
            lines.removeFirst()
        }
        return lines.joined(separator: "\n")
    }
}
