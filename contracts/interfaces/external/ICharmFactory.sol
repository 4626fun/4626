// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ICharmFactory
 * @notice Interface for Charm Finance's Alpha Vault Factory
 * @dev Base: 0x5B7B8b487D05F77977b7ABEec5F922925B9b2aFa
 *      Vaults created via this factory appear on alpha.charm.fi UI
 */
interface ICharmFactory {
    struct VaultParams {
        address pool;
        address manager;
        uint24 managerFee;
        address rebalanceDelegate;
        uint256 maxTotalSupply;
        int24 baseThreshold;
        int24 limitThreshold;
        uint24 fullRangeWeight;
        uint32 period;
        int24 minTickMove;
        int24 maxTwapDeviation;
        uint32 twapDuration;
        string name;
        string symbol;
    }

    /**
     * @notice Create a new Alpha Vault
     * @param params Vault initialization parameters
     * @return vault Address of the created vault
     */
    function createVault(VaultParams calldata params) external returns (address vault);

    /// @notice Get vault by index
    function vaults(uint256 index) external view returns (address);

    /// @notice Total number of vaults created
    function numVaults() external view returns (uint256);

    /// @notice Charm governance address
    function governance() external view returns (address);

    /// @notice Factory-level protocol fee (1e6 precision)
    function protocolFee() external view returns (uint24);
}
