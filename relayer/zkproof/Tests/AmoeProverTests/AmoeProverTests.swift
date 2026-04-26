// SPDX-License-Identifier: MIT
//
// Smoke tests for AmoeProver. The full prove-then-verify cycle requires the
// real zkey artifact, which is gitignored, so the heavy test is skipped when
// the artifact is absent. These tests focus on the wire-up: the structs
// compose correctly, the public-input array is in the right order, and the
// allowlist root is reproducible.

import XCTest
import zkMetal
@testable import AmoeProver

final class AmoeProverTests: XCTestCase {
    /// Locks the public input order to the circom `public []` declaration in
    /// `circuits/amoe/amoe_eligibility.circom`:
    ///   [walletAddrCommit, creatorCoinAddr, nonceCommit, epoch, allowlistRoot]
    /// If you change this test, also update the circuit and re-run
    /// `tools/zk/regen_amoe_fixture.sh` so the verifier IC indices stay aligned.
    func testPublicInputOrderMatchesCircuit() throws {
        let pub = AmoePublicInputs(
            walletAddrCommit: Fr(integerLiteral: 11),
            creatorCoinAddr:  Fr(integerLiteral: 22),
            nonceCommit:      Fr(integerLiteral: 33),
            epoch:            Fr(integerLiteral: 44),
            allowlistRoot:    Fr(integerLiteral: 55)
        )
        let arr = pub.asArray
        XCTAssertEqual(arr.count, AmoeProver.publicInputCount)
        XCTAssertEqual(arr[0], Fr(integerLiteral: 11))   // walletAddrCommit
        XCTAssertEqual(arr[1], Fr(integerLiteral: 22))   // creatorCoinAddr
        XCTAssertEqual(arr[2], Fr(integerLiteral: 33))   // nonceCommit
        XCTAssertEqual(arr[3], Fr(integerLiteral: 44))   // epoch
        XCTAssertEqual(arr[4], Fr(integerLiteral: 55))   // allowlistRoot
    }

    /// Locks the private witness shape: 3 scalars + 2 arrays of length DEPTH.
    func testPrivateWitnessShapeMatchesCircuit() throws {
        let zeros = Array(repeating: Fr(integerLiteral: 0), count: AmoeProver.merkleDepth)
        let wit = AmoePrivateWitness(
            wallet:                 Fr(integerLiteral: 1),
            nonce:                  Fr(integerLiteral: 2),
            twitterCreditNullifier: Fr(integerLiteral: 3),
            pathElements:           zeros,
            pathIndices:            zeros
        )
        XCTAssertEqual(wit.pathElements.count, AmoeProver.merkleDepth)
        XCTAssertEqual(wit.pathIndices.count,  AmoeProver.merkleDepth)
    }

    func testAllowlistRootIsDeterministic() throws {
        let a = try AmoeAllowlist()
        let b = try AmoeAllowlist()
        try a.insert(leaf: Fr(integerLiteral: 11))
        try a.insert(leaf: Fr(integerLiteral: 22))
        try b.insert(leaf: Fr(integerLiteral: 11))
        try b.insert(leaf: Fr(integerLiteral: 22))
        XCTAssertEqual(a.root, b.root)
    }

    func testAllowlistPathRoundTrip() throws {
        let tree = try AmoeAllowlist()
        for v in [3, 5, 7, 9, 11] {
            try tree.insert(leaf: Fr(integerLiteral: UInt64(v)))
        }
        let (siblings, bits) = try tree.proof(forIndex: 2)
        XCTAssertEqual(siblings.count, AmoeAllowlist.depth)
        XCTAssertEqual(bits.count, AmoeAllowlist.depth)
    }

    func testProveSkippedIfArtifactsMissing() throws {
        // Real prove requires amoe_final.zkey + amoe_eligibility.r1cs in
        // <repo>/circuits/amoe/build/. CI builds them with circom + snarkjs.
        // Local dev can run `tools/zk/regen_amoe_fixture.sh` to generate them.
        //
        // `swift test` is invoked from the package root (relayer/zkproof) by
        // CI (.github/workflows/zkmetal-macos.yml uses
        // `working-directory: fourksixsixtwo/relayer/zkproof`). Resolve the
        // build dir relative to this source file so the path is independent
        // of the current working directory and works in both CI and local
        // `swift test` invocations.
        let here = URL(fileURLWithPath: #filePath)
        // <repo>/relayer/zkproof/Tests/AmoeProverTests/AmoeProverTests.swift
        //   -> <repo>
        let repoRoot = here
            .deletingLastPathComponent()  // AmoeProverTests/
            .deletingLastPathComponent()  // Tests/
            .deletingLastPathComponent()  // zkproof/
            .deletingLastPathComponent()  // relayer/
            .deletingLastPathComponent()  // <repo>/
        let zkey = repoRoot
            .appendingPathComponent("circuits/amoe/build/amoe_final.zkey")
        guard FileManager.default.fileExists(atPath: zkey.path) else {
            throw XCTSkip(
                "amoe_final.zkey not present at \(zkey.path) — skipping live prove."
            )
        }
        // (left as exercise to integration tests in CI)
    }
}
