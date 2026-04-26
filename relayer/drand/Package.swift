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
        // Pin secp256k1.swift below 0.20.0. web3.swift declares
        // `.upToNextMajor(from: "0.6.0")` and references the
        // `secp256k1` product, but GigaBitcoin/secp256k1.swift renamed
        // that product to `libsecp256k1` in v0.20.0. Without this pin,
        // SwiftPM resolves the latest 0.x and dependency resolution
        // fails with:
        //   error: 'web3.swift': product 'secp256k1' required by
        //   package 'web3.swift' target 'web3' not found in package
        //   'secp256k1.swift'. Did you mean 'libsecp256k1'?
        // Removing this pin requires either a web3.swift release that
        // adopts the renamed product, or a fork of web3.swift.
        .package(url: "https://github.com/GigaBitcoin/secp256k1.swift.git", "0.6.0"..<"0.20.0"),
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
