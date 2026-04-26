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
        XCTAssertEqual(payload.signatureUncompressed.count, 256)
        XCTAssertEqual(payload.hashedRoundG2.count, 256)
        XCTAssertEqual(payload.hashedRoundCommit.count, 32)
    }
}
