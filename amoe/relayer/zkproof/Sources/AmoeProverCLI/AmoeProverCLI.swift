// SPDX-License-Identifier: MIT
//
// amoe-prover — CLI driver for `AmoeProver`. Replaces the snarkjs invocation
// in production. Reads JSON public + witness inputs, writes a snarkjs-shaped
// proof.json + public.json. Same on-disk format as snarkjs, so any downstream
// tooling (verifier, indexer) keeps working unchanged.

import ArgumentParser
import AmoeProver
import Foundation
import zkMetal

@main
struct AmoeProverCLI: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "amoe-prover",
        abstract: "GPU-accelerated Groth16 prover for the AMOE eligibility circuit.",
        subcommands: [Prove.self, BuildRoot.self, EmitVerifier.self]
    )
}

// MARK: - prove

struct Prove: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "prove",
        abstract: "Prove AMOE eligibility, snarkjs-compatible JSON output."
    )

    @Option(help: "Path to amoe_final.zkey")
    var zkey: String

    @Option(help: "Path to amoe_eligibility.r1cs")
    var r1cs: String

    @Option(help: "Path to input.json (public + private signals)")
    var input: String

    @Option(help: "Path to write proof.json")
    var proofOut: String

    @Option(help: "Path to write public.json")
    var publicOut: String

    @Flag(help: "Print per-stage timings to stderr")
    var profile: Bool = false

    func run() throws {
        let prover = try AmoeProver(
            zkeyURL: URL(fileURLWithPath: zkey),
            r1csURL: URL(fileURLWithPath: r1cs)
        )
        prover.profile = profile

        let inputJSON = try Data(contentsOf: URL(fileURLWithPath: input))
        let parsed = try JSONDecoder().decode(InputJSON.self, from: inputJSON)
        let pub = try parsed.publicInputs()
        let wit = try parsed.privateWitness()

        let (proof, publicSignals) = try prover.prove(
            publicInputs: pub,
            witness: wit
        )

        // snarkjs JSON: { pi_a: [..], pi_b: [[..],[..]], pi_c: [..], protocol: "groth16", curve: "bn128" }
        // zkMetal exposes this directly on `Groth16Proof` as
        // `toSnarkjsJSON(prettyPrint:) -> Data?`. Earlier versions of this
        // CLI assumed a `Groth16Solidity` namespace which never existed.
        guard let proofData = proof.toSnarkjsJSON(prettyPrint: true) else {
            throw ValidationError("failed to encode proof as snarkjs JSON")
        }
        try proofData.write(to: URL(fileURLWithPath: proofOut))

        // public.json is just an array of decimal strings, same as snarkjs.
        // `frToDecimal(_:)` is a free function in zkMetal's Serialization
        // module — there is no `Fr.decimalString` property.
        let pubArray = publicSignals.map { frToDecimal($0) }
        let pubData = try JSONSerialization.data(
            withJSONObject: pubArray,
            options: [.prettyPrinted]
        )
        try pubData.write(to: URL(fileURLWithPath: publicOut))

        let okMsg = "amoe-prover: ok\n"
        FileHandle.standardError.write(Data(okMsg.utf8))
    }
}

// MARK: - build-root

struct BuildRoot: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "build-root",
        abstract: "Build a depth-20 Poseidon Merkle root from a leaf list."
    )

    @Option(help: "Path to leaves.json — array of decimal Fr strings")
    var leaves: String

    @Option(help: "Path to write root.txt (decimal)")
    var rootOut: String

    func run() throws {
        let data = try Data(contentsOf: URL(fileURLWithPath: leaves))
        guard let arr = try JSONSerialization.jsonObject(with: data) as? [String] else {
            throw ValidationError("leaves.json must be a JSON array of decimal strings")
        }
        let tree = try AmoeAllowlist()
        for s in arr {
            guard let v = frFromDecimal(s) else {
                throw ValidationError("not a decimal Fr: \(s)")
            }
            try tree.insert(leaf: v)
        }
        try frToDecimal(tree.root).write(
            to: URL(fileURLWithPath: rootOut),
            atomically: true,
            encoding: .utf8
        )
    }
}

// MARK: - input.json
//
// Field names match the circom `signal input` declarations in
// `amoe/circuits/amoe_eligibility.circom` *exactly*. This is the same JSON
// shape that `snarkjs groth16 fullprove input.json …` consumes today, so any
// existing fixture (e.g. `amoe/circuits/build/input.json`) Just Works.

private struct InputJSON: Decodable {
    // Public signals
    let walletAddrCommit: String
    let creatorCoinAddr: String
    let nonceCommit: String
    let epoch: String
    let allowlistRoot: String

    // Private signals
    let wallet: String
    let nonce: String
    let twitterCreditNullifier: String
    let pathElements: [String]
    let pathIndices: [String]

    func publicInputs() throws -> AmoePublicInputs {
        AmoePublicInputs(
            walletAddrCommit: try fr(walletAddrCommit, "walletAddrCommit"),
            creatorCoinAddr:  try fr(creatorCoinAddr,  "creatorCoinAddr"),
            nonceCommit:      try fr(nonceCommit,      "nonceCommit"),
            epoch:            try fr(epoch,            "epoch"),
            allowlistRoot:    try fr(allowlistRoot,    "allowlistRoot")
        )
    }

    func privateWitness() throws -> AmoePrivateWitness {
        AmoePrivateWitness(
            wallet:                 try fr(wallet, "wallet"),
            nonce:                  try fr(nonce, "nonce"),
            twitterCreditNullifier: try fr(twitterCreditNullifier, "twitterCreditNullifier"),
            pathElements: try pathElements.enumerated().map {
                try fr($1, "pathElements[\($0)]")
            },
            pathIndices: try pathIndices.enumerated().map { i, b in
                guard b == "0" || b == "1" else {
                    throw ValidationError("pathIndices[\(i)] must be 0 or 1, got \(b)")
                }
                return b == "1" ? Fr.one : Fr.zero
            }
        )
    }
}

private func fr(_ s: String, _ name: String) throws -> Fr {
    // zkMetal exposes decimal-string parsing as a free function
    // `frFromDecimal(_:) -> Fr?` (Sources/zkMetal/Serialization/SnarkjsSerialization.swift).
    // The previous `Fr(decimalString:)` initializer never existed.
    guard let v = frFromDecimal(s) else {
        throw ValidationError("\(name) is not a decimal Fr: \(s)")
    }
    return v
}
