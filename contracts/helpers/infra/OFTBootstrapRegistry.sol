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
    /// @dev Base mainnet chain id.
    uint256 public constant BASE_CHAIN_ID = 8453;
    /// @dev LayerZero EID for Base mainnet.
    uint32 public constant BASE_EID = 30184;

    /// @notice Return the LayerZero endpoint for any chain.
    /// @dev FIX: F-23 — Always returns LZ_COMMON_ENDPOINT regardless of chainId.
    ///      The chainId parameter is retained solely for ICreatorRegistry interface
    ///      compatibility. LZ v2 EndpointV2 shares a single CREATE2 address across
    ///      all EVM chains, so per-chain resolution is unnecessary.
    function getLayerZeroEndpoint(uint256 /* chainId — intentionally unused */) external pure returns (address) {
        return LZ_COMMON_ENDPOINT;
    }

    /// @notice Return the LayerZero EID for the provided chain id.
    /// @dev The deployment lane currently targets Base only; returning 0 for
    ///      unknown chain IDs preserves CreatorShareOFT's constructor guard.
    function getEidForChainId(uint256 chainId) external pure returns (uint32) {
        if (chainId == BASE_CHAIN_ID) return BASE_EID;
        return 0;
    }
}
