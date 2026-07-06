// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title OFTBootstrapRegistry
 * @author 0xakita.eth
 * @notice Minimal registry for CreatorShareOFT construction.
 * @dev Used only during OFT deployment to resolve the LayerZero endpoint.
 *      Most EVM chains share the canonical LZ v2 EndpointV2 CREATE2 address;
 *      Robinhood Chain uses an alternate endpoint family.
 *      No mutable state is permitted — write-free to eliminate endpoint poisoning.
 *
 * @dev Bootstrap is deployed at salt `keccak256("4626:OFTBootstrapRegistry:v1")` via
 *      `UniversalCreate2DeployerFromStore` on every chain. Same bytecode + salt + deployer
 *      ⇒ same bootstrap address cross-chain (required for ShareOFT CREATE2 parity).
 */
contract OFTBootstrapRegistry {
    /// @dev LayerZero v2 EndpointV2 — common address on most EVM chains.
    address public constant LZ_COMMON_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    /// @dev Alternate EndpointV2 family (Robinhood Chain).
    address public constant LZ_ALT_ENDPOINT = 0x6F475642a6e85809B1c36Fa62763669b1b48DD5B;
    /// @dev Base mainnet chain id.
    uint256 public constant BASE_CHAIN_ID = 8453;
    /// @dev Robinhood Chain mainnet chain id.
    uint256 public constant ROBINHOOD_CHAIN_ID = 4663;
    /// @dev LayerZero EID for Base mainnet.
    uint32 public constant BASE_EID = 30184;
    /// @dev LayerZero EID for Robinhood Chain mainnet.
    uint32 public constant ROBINHOOD_EID = 30416;

    /// @notice Return the LayerZero endpoint for the provided chain.
    function getLayerZeroEndpoint(uint256 chainId) external pure returns (address) {
        if (chainId == ROBINHOOD_CHAIN_ID) return LZ_ALT_ENDPOINT;
        return LZ_COMMON_ENDPOINT;
    }

    /// @notice Return the LayerZero EID for the provided chain id.
    function getEidForChainId(uint256 chainId) external pure returns (uint32) {
        if (chainId == BASE_CHAIN_ID) return BASE_EID;
        if (chainId == ROBINHOOD_CHAIN_ID) return ROBINHOOD_EID;
        return 0;
    }
}
