// swift-tools-version: 5.9
// AmoeProver — zkMetal-backed Groth16 prover for the AMOE eligibility circuit.
// Apple Silicon only (Metal). Linux is not a target.
import PackageDescription

let package = Package(
    name: "AmoeProver",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "amoe-prover", targets: ["AmoeProverCLI"]),
        .library(name: "AmoeProver", targets: ["AmoeProver"]),
    ],
    dependencies: [
        // zkMetal — local checkout. In a real deployment this would be a tagged release.
        .package(path: "../../../zkmetal"),
        .package(url: "https://github.com/apple/swift-argument-parser.git", from: "1.3.0"),
    ],
    targets: [
        .target(
            name: "AmoeProver",
            dependencies: [
                .product(name: "zkMetal", package: "zkmetal"),
            ]
        ),
        .executableTarget(
            name: "AmoeProverCLI",
            dependencies: [
                "AmoeProver",
                .product(name: "ArgumentParser", package: "swift-argument-parser"),
            ]
        ),
        .testTarget(
            name: "AmoeProverTests",
            dependencies: ["AmoeProver"]
        ),
    ]
)
