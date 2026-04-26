// SPDX-License-Identifier: MIT
import XCTest
@testable import DrandRelay

final class DrandClientTests: XCTestCase {
    func testHexRoundTrip() {
        let bytes: [UInt8] = [0xde, 0xad, 0xbe, 0xef]
        let hex = "0xdeadbeef"
        XCTAssertEqual(Data(hexString: hex), Data(bytes))
    }

    // The full round verification test requires a running zkMetal install
    // (Apple Silicon + Metal) and a drand HTTP endpoint. CI runs it as a
    // smoke test only on macOS-arm64 runners; on other platforms it's skipped.
    func testBuildSubmissionShape() async throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["DRAND_RELAY_E2E"] == "1")
        let client = try await DrandClient(
            chainHash: "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971"
        )
        let env = try await client.fetchRound(0)
        let payload = try await client.buildSubmission(for: env)
        // quicknet: signature ∈ G1 (128 bytes EIP-2537), H(round) ∈ G1 (128 bytes)
        XCTAssertEqual(payload.signatureUncompressed.count, 128)
        XCTAssertEqual(payload.hashedRoundG1.count, 128)
        XCTAssertEqual(payload.hashedRoundCommit.count, 32)
    }
}
