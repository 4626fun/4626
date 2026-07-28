// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IStrategyValuation
 * @author 0xakita.eth
 * @notice Optional strategy extension for valuation readiness checks.
 * @dev Vaults can use this to gate ERC-4626 deposits/mints when a strategy cannot
 *      produce a reliable valuation (e.g., oracle unavailable) to prevent share dilution.
 */
interface IStrategyValuation {
    /**
     * @notice Whether this strategy's valuation inputs are currently healthy.
     * @dev MUST NOT revert. Return false when valuation is unavailable/unreliable.
     */
    function isValuationReady() external view returns (bool);
}

