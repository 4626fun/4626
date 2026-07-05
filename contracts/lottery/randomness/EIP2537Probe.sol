// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title EIP2537Probe
/// @notice Deploy-time / runtime helper that detects whether the BLS12-381
///         precompiles introduced by EIP-2537 (Pectra) are live on the chain
///         the contract is being deployed to.
///
/// @dev    Per EIP-2537 the relevant precompile addresses are:
///           - 0x0b: BLS12_G1ADD       (input 256 bytes, output 128 bytes, 375 gas)
///           - 0x0c: BLS12_G1MSM
///           - 0x0d: BLS12_G2ADD       (input 512 bytes, output 256 bytes, 600 gas)
///           - 0x0e: BLS12_G2MSM
///           - 0x0f: BLS12_PAIRING_CHECK
///           - 0x10: BLS12_MAP_FP_TO_G1
///           - 0x11: BLS12_MAP_FP2_TO_G2
///         Note 0x10 is MAP_FP_TO_G1, **NOT** the pairing-check (a common
///         confusion because the older proposed numbering had pairing at 0x10).
///
///         To detect availability we probe G1ADD with two points-at-infinity
///         (256 bytes of zero), which is a valid encoding per EIP-2537 and
///         must return 128 bytes of zero (the point at infinity in G1).
///         On a chain without EIP-2537 the staticcall to 0x0b succeeds against
///         the empty account but `returndatasize` is 0 \u2014 we use that to
///         distinguish.
library EIP2537Probe {
    /// @notice BLS12-381 G1ADD precompile address per EIP-2537.
    address internal constant G1ADD = address(0x0b);

    /// @notice BLS12-381 pairing-check precompile address per EIP-2537.
    address internal constant PAIRING_CHECK = address(0x0f);

    /// @notice Probes G1ADD with two infinity points. Returns true iff the
    ///         precompile is live and returns 128 bytes (a single G1 point).
    function isAvailable() internal view returns (bool) {
        // 256 bytes of input: two G1 points at infinity (all zeros).
        bytes memory input = new bytes(256);
        bytes memory output = new bytes(128);

        bool ok;
        uint256 retSize;
        // Inline assembly cannot reference Solidity `address` constants (only
        // direct number constants), so we mirror the precompile address as a
        // local uint256. Keep this in sync with the `G1ADD` constant above.
        uint256 g1add = 0x0b;
        assembly {
            // EIP-2537 G1ADD: 375 gas. Allow ~10x for safety vs legacy chains
            // where staticcall into an empty account is also cheap.
            ok := staticcall(4000, g1add, add(input, 0x20), 256, add(output, 0x20), 128)
            retSize := returndatasize()
        }
        // On a chain without EIP-2537, staticcall to 0x0b succeeds (empty
        // account) but returndatasize is 0. On Pectra, returndatasize is 128.
        return ok && retSize == 128;
    }

    /// @notice Reverts unless EIP-2537 is live. Use this in deploy scripts:
    ///         `EIP2537Probe.requireAvailable();` before `new DrandRandomnessSource(...)`.
    function requireAvailable() internal view {
        require(isAvailable(), "EIP-2537 BLS12-381 precompiles unavailable on this chain");
    }
}
