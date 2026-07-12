// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRewardWeightSource
 * @notice Thin weight adapter for epoch-scoped voter rewards (Design A streams).
 * @dev Implemented by `ve4626GaugeVoting` (or a facade). Streams must use finalized
 *      epoch weights only — never live ve power — to avoid claim-time vote sniping.
 */
interface IRewardWeightSource {
    function currentEpoch() external view returns (uint256);

    function getVaultWeightAtEpoch(uint256 epoch, address vault) external view returns (uint256);

    function getUserVoteWeightAtEpoch(uint256 epoch, address user, address vault) external view returns (uint256);

    function canReceiveVotes(address vault) external view returns (bool);

    /// @notice Partner stream eligibility (surface registry streams flag when wired; else vault whitelist).
    function canReceiveStreams(address vault) external view returns (bool);
}
