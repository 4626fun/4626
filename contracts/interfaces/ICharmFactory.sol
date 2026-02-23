// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ICharmFactory
 * @notice Interface for Charm Finance's Alpha Vault Factory
 * @dev Base: 0x5B7B8b487D05F77977b7ABEec5F922925B9b2aFa
 *      Vaults created via this factory appear on alpha.charm.fi UI
 */
interface ICharmFactory {
    /**
     * @notice Create a new Alpha Vault
     * @param pool Uniswap V3 pool address
     * @param manager Address that will manage the vault (rebalancing)
     * @param maxTotalSupply Maximum total supply of vault shares (use type(uint256).max for unlimited)
     * @param baseThreshold Threshold for base position in ticks
     * @param limitThreshold Threshold for limit position in ticks
     * @param fullRangeWeight Weight for full range position (0-10000 basis points)
     * @param period Rebalance period in seconds
     * @param name ERC20 name for vault shares
     * @param symbol ERC20 symbol for vault shares
     * @return vault Address of the created vault
     */
    function createVault(
        address pool,
        address manager,
        uint256 maxTotalSupply,
        int24 baseThreshold,
        int24 limitThreshold,
        uint24 fullRangeWeight,
        uint32 period,
        string memory name,
        string memory symbol
    ) external returns (address vault);

    /// @notice Get vault by index
    function allVaults(uint256 index) external view returns (address);

    /// @notice Total number of vaults created
    function allVaultsLength() external view returns (uint256);

    /// @notice Charm governance address
    function governance() external view returns (address);
}
