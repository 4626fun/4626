// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRewardStream4626
 * @notice Vault-scoped multi-token partner reward stream (epoch bag, Design A).
 * @dev Parallel to `BribeDepot4626` (one-shot bribes) and `ve4626VoterRewardsDistributor`
 *      (protocol fee ShareOFT). Does not mint emissions; only distributes pre-funded ERC-20s.
 */
interface IRewardStream4626 {
    // ================================
    // EVENTS
    // ================================

    event RewardTokenAdded(address indexed token);
    event RewardTokenRemoved(address indexed token);
    event Funded(address indexed funder, address indexed token, uint256 amount, uint256 indexed epoch);
    event Claimed(address indexed user, address indexed token, uint256 amount, uint256 indexed epoch);
    event StreamRolledOver(address indexed token, uint256 indexed fromEpoch, uint256 indexed toEpoch, uint256 amount);
    event RolloverGraceEpochsUpdated(uint256 oldGrace, uint256 newGrace);

    // ================================
    // ERRORS
    // ================================

    error ZeroAddress();
    error ZeroAmount();
    error TokenNotAllowed(address token);
    error TokenAlreadyAllowed(address token);
    error AlreadyClaimed();
    error NoUserVotes();
    error EpochNotEnded();
    error EpochClosed();
    error RolloverNotAllowedYet();
    error NotZeroVoteEpoch();
    error VaultNotWhitelisted();
    error GraceBelowMinimum(uint256 provided, uint256 minimum);

    // ================================
    // VIEWS
    // ================================

    function vault() external view returns (address);

    function gaugeVoting() external view returns (address);

    function isRewardToken(address token) external view returns (bool);

    function epochTokenRewards(uint256 epoch, address token) external view returns (uint256);

    function hasClaimed(uint256 epoch, address token, address user) external view returns (bool);

    function previewClaim(address user, uint256 epoch, address token) external view returns (uint256 amount);

    // ================================
    // ADMIN
    // ================================

    function addRewardToken(address token) external;

    function removeRewardToken(address token) external;

    function setRolloverGraceEpochs(uint256 newGrace) external;

    // ================================
    // FUND / CLAIM
    // ================================

    /// @notice Fund the current epoch bag for an allowlisted token (FOT-safe credit).
    function fund(address token, uint256 amount) external;

    /// @notice Claim a finalized epoch for one token (pro-rata by vote weight).
    function claim(uint256 epoch, address token) external returns (uint256 amount);

    /// @notice Claim many tokens for one finalized epoch.
    function claimMany(uint256 epoch, address[] calldata tokens) external returns (uint256 totalAmount);

    /// @notice Permissionless: roll a zero-vote epoch bag into the current epoch (after 1 epoch).
    function rolloverZeroVoteEpoch(uint256 epoch, address token) external returns (uint256 rolled);

    /// @notice Owner: roll unclaimed leftovers after grace into the current epoch.
    function rolloverExpiredEpoch(uint256 epoch, address token) external returns (uint256 rolled);
}
