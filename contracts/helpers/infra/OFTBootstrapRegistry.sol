// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title OFTBootstrapRegistry
 * @author 0xakita.eth
 * @notice Minimal registry for CreatorShareOFT construction.
 * @dev Used only during OFT deployment to resolve the LayerZero endpoint.
 *      The endpoint is the canonical LZ v2 EndpointV2, deployed at the same
 *      address on all EVM chains via CREATE2. No mutable state is needed or
 *      permitted — this contract is intentionally write-free to eliminate the
 *      endpoint poisoning attack surface.
 */
contract OFTBootstrapRegistry {
    /// @dev LayerZero v2 EndpointV2 — identical address on all EVM chains.
    address public constant LZ_COMMON_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    /// @notice Return the LayerZero endpoint for any chain.
    /// @dev FIX: F-23 — Always returns LZ_COMMON_ENDPOINT regardless of chainId.
    ///      The chainId parameter is retained solely for ICreatorRegistry interface
    ///      compatibility. LZ v2 EndpointV2 shares a single CREATE2 address across
    ///      all EVM chains, so per-chain resolution is unnecessary.
    function getLayerZeroEndpoint(uint256 /* chainId — intentionally unused */) external pure returns (address) {
        return LZ_COMMON_ENDPOINT;
    }
}
