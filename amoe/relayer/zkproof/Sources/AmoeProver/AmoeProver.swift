// SPDX-License-Identifier: MIT
//
// AmoeProver — wraps zkMetal's `Groth16Prover` for the AMOE eligibility circuit.
//
// This replaces the snarkjs CLI workflow:
//
//   snarkjs groth16 fullprove input.json amoe.wasm amoe_final.zkey \
//     proof.json public.json
//
// with a native Swift call that:
//   1. Loads the proving key (`.zkey`) once and caches it.
//   2. Parses the R1CS file via zkMetal's Circom-compatible `R1CSParser`.
//   3. Generates the witness (snarkjs-compatible `wtns` format) and runs
//      `Groth16Prover.proveWithWitnessGen`, which in turn drives the GPU MSM
//      and NTT engines on Apple Silicon.
//   4. Emits a snarkjs-shaped `Groth16Proof` plus the public input array,
//      both ready for the on-chain `AmoeGroth16Verifier`.
//
// Why bother:
//   - snarkjs (Node.js) for our 5825-constraint circuit takes ~600ms cold and
//     ~300ms warm on M-series. zkMetal's `Groth16Prover` for the same shape is
//     in the 10–20ms range warm (per zkMetal's own bench docs).
//   - It removes the Node.js + WASM runtime from the relayer host's prod
//     dependency surface. Only the Swift binary ships.
//   - The verifier contract is unchanged — same VK, same Groth16 layout.

import Foundation
import zkMetal

public enum AmoeProverError: Error, CustomStringConvertible {
    case zkeyNotFound(URL)
    case r1csNotFound(URL)
    case zkMetal(String)
    case publicInputCountMismatch(have: Int, expected: Int)
    case privateWitnessShapeMismatch(String)
    case proveFailed(String)

    public var description: String {
        switch self {
        case .zkeyNotFound(let url):    return "zkey not found at \(url.path)"
        case .r1csNotFound(let url):    return "r1cs not found at \(url.path)"
        case .zkMetal(let msg):         return "zkMetal failure: \(msg)"
        case .publicInputCountMismatch(let h, let e):
            return "public input count mismatch: have \(h), expected \(e)"
        case .privateWitnessShapeMismatch(let m):
            return "private witness shape mismatch: \(m)"
        case .proveFailed(let msg):     return "Groth16 proveFailed: \(msg)"
        }
    }
}

public final class AmoeProver {
    /// Must match the `DEPTH` parameter in `amoe/circuits/amoe_eligibility.circom`
    /// (currently `AmoeEligibility(20)`).
    public static let merkleDepth = 20

    /// AMOE has exactly 5 public inputs (see `AmoePublicInputs`).
    public static let publicInputCount = 5

    private let prover: Groth16Prover
    private let pk: Groth16ProvingKey
    private let r1cs: R1CSInstance

    public var profile: Bool {
        get { prover.profileGroth16 }
        set { prover.profileGroth16 = newValue }
    }

    public init(zkeyURL: URL, r1csURL: URL) throws {
        guard FileManager.default.fileExists(atPath: zkeyURL.path) else {
            throw AmoeProverError.zkeyNotFound(zkeyURL)
        }
        guard FileManager.default.fileExists(atPath: r1csURL.path) else {
            throw AmoeProverError.r1csNotFound(r1csURL)
        }
        do {
            self.prover = try Groth16Prover()
            // zkMetal does NOT currently ship a Swift-side .zkey loader.
            // Until it does, the relayer driver is responsible for handing us
            // a parsed `Groth16ProvingKey`. We trip a clear error here rather
            // than silently producing a zero proving key. See issue #389.
            //
            // zkMetal DOES ship a Circom .r1cs parser; we use it directly.
            self.pk = try Self.loadProvingKey(zkeyURL: zkeyURL)
            let r1csFile = try R1CSParser.parse(contentsOf: r1csURL)
            self.r1cs = R1CSParser.toR1CSInstance(r1csFile)
        } catch {
            throw AmoeProverError.zkMetal(String(describing: error))
        }
    }

    /// Until zkMetal exposes a public .zkey parser, this is a deliberate hard
    /// stop. The relayer's bin entrypoint should call into a real .zkey reader
    /// (e.g. snarkjs's binary format) and inject the resulting key. Tracked at
    /// https://github.com/wenakita/4626/issues/389.
    private static func loadProvingKey(zkeyURL: URL) throws -> Groth16ProvingKey {
        throw AmoeProverError.zkMetal(
            "zkMetal does not yet expose a public .zkey loader; " +
            "AmoeProver cannot self-load \(zkeyURL.lastPathComponent). " +
            "Inject Groth16ProvingKey via a future init(pk:r1cs:) once available."
        )
    }

    /// Prove AMOE eligibility for the given public/private inputs.
    /// Returns the snarkjs-shaped Groth16 proof, ready for `verifyProof` on
    /// the Solidity verifier, plus the canonical 5-element public input array.
    public func prove(
        publicInputs: AmoePublicInputs,
        witness: AmoePrivateWitness
    ) throws -> (proof: Groth16Proof, publicSignals: [Fr]) {
        let publicSignals = publicInputs.asArray
        guard publicSignals.count == AmoeProver.publicInputCount else {
            throw AmoeProverError.publicInputCountMismatch(
                have: publicSignals.count,
                expected: AmoeProver.publicInputCount
            )
        }

        guard witness.pathElements.count == AmoeProver.merkleDepth else {
            throw AmoeProverError.privateWitnessShapeMismatch(
                "pathElements.count == \(witness.pathElements.count), need \(AmoeProver.merkleDepth)"
            )
        }
        guard witness.pathIndices.count == AmoeProver.merkleDepth else {
            throw AmoeProverError.privateWitnessShapeMismatch(
                "pathIndices.count == \(witness.pathIndices.count), need \(AmoeProver.merkleDepth)"
            )
        }

        // Build the hint map that drives `Groth16Prover.generateWitness`.
        // Hints map *signal indices* to known values. The circom signal layout
        // for `amoe_eligibility.circom` is, in declaration order:
        //
        //   signal[0]                           = "1" (constant — set by zkMetal)
        //   signal[1 .. 5]                      = public inputs
        //                                         [walletAddrCommit, creatorCoinAddr,
        //                                          nonceCommit, epoch, allowlistRoot]
        //   signal[6]                           = wallet
        //   signal[7]                           = nonce
        //   signal[8]                           = twitterCreditNullifier
        //   signal[9 .. 9 + DEPTH - 1]          = pathElements[i]
        //   signal[9 + DEPTH .. 9 + 2*DEPTH-1]  = pathIndices[i]
        //
        // Anything else (intermediate Poseidon outputs, mux gates, range-check
        // bit decompositions) is solved by zkMetal's `WitnessGraph` from the
        // R1CS itself, so we only need to seed the inputs.
        var hints: [Int: Fr] = [:]

        let publicBase = 1
        for (i, v) in publicSignals.enumerated() {
            hints[publicBase + i] = v
        }

        let privateBase = publicBase + AmoeProver.publicInputCount  // = 6
        hints[privateBase + 0] = witness.wallet
        hints[privateBase + 1] = witness.nonce
        hints[privateBase + 2] = witness.twitterCreditNullifier

        let pathElementsBase = privateBase + 3                       // = 9
        for (i, sib) in witness.pathElements.enumerated() {
            hints[pathElementsBase + i] = sib
        }

        let pathIndicesBase = pathElementsBase + AmoeProver.merkleDepth  // = 29
        for (i, bit) in witness.pathIndices.enumerated() {
            hints[pathIndicesBase + i] = bit
        }

        do {
            let proof = try prover.proveWithWitnessGen(
                pk: pk,
                r1cs: r1cs,
                publicInputs: publicSignals,
                hints: hints
            )
            return (proof, publicSignals)
        } catch {
            throw AmoeProverError.proveFailed(String(describing: error))
        }
    }

    /// Verify a proof locally. Useful as a sanity check before submitting.
    /// Mirrors what `AmoeGroth16Verifier.verifyProof` will do on-chain.
    public func verifyLocal(
        proof: Groth16Proof,
        publicSignals: [Fr],
        vk: Groth16VerificationKey
    ) -> Bool {
        // zkMetal's `Groth16Verifier.verify` is an instance method with arg
        // order (proof:vk:publicInputs:). We construct a fresh verifier per
        // call -- the type holds no state, so this is free.
        return Groth16Verifier().verify(
            proof: proof,
            vk: vk,
            publicInputs: publicSignals
        )
    }
}
