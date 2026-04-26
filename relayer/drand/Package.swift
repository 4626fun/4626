// swift-tools-version: 5.9
// Apple Silicon only (Metal). Linux is not a target.
import PackageDescription

let package = Package(
    name: "DrandRelay",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "drand-relay", targets: ["DrandRelayCLI"]),
        .library(name: "DrandRelay", targets: ["DrandRelay"]),
    ],
    dependencies: [
        // zkMetal — local checkout. In a real deployment you'd point to a tag.
        .package(path: "../../../zkmetal"),
        .package(url: "https://github.com/argentlabs/web3.swift.git", from: "1.6.0"),
        .package(url: "https://github.com/apple/swift-argument-parser.git", from: "1.3.0"),
    ],
    targets: [
        .target(
            name: "DrandRelay",
            dependencies: [
                .product(name: "zkMetal", package: "zkmetal"),
                .product(name: "web3.swift", package: "web3.swift"),
            ]
        ),
        .executableTarget(
            name: "DrandRelayCLI",
            dependencies: [
                "DrandRelay",
                .product(name: "ArgumentParser", package: "swift-argument-parser"),
            ]
        ),
        .testTarget(
            name: "DrandRelayTests",
            dependencies: ["DrandRelay"]
        ),
    ]
)
