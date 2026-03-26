// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ICCALaunchStrategy
 * @author 0xakita.eth
 * @notice Interface for configuring CCALaunchStrategy.
 * @dev Used by deployment and admin tooling.
 */
interface ICCALaunchStrategy {
    function setApprovedLauncher(address launcher, bool approved) external;
    function setRecipients(address _fundsRecipient, address _tokensRecipient) external;
    function setBackingVault(address _backingVault) external;
    function setLaunchDiscountBps(uint16 _discountBps) external;
    function setLaunchTickSpacingBps(uint16 _tickSpacingBps) external;
    function setLaunchBlockTimeSeconds(uint64 _secondsPerBlock) external;
    function setMigrationConfig(
        address _positionManager,
        address _positionRecipient,
        address _operator,
        uint64 _migrationDelayBlocks,
        uint64 _sweepDelayBlocks
    ) external;
    function launchAuctionWithReserve(
        uint256 amount,
        uint256 lpReserveAmount,
        uint256 floorPrice,
        uint128 requiredRaise,
        bytes calldata auctionSteps
    ) external returns (address auction);
    function previewLaunchPricing()
        external
        view
        returns (uint256 floorPriceQ96, uint256 tickSpacingQ96, uint256 creatorUsdPrice, uint256 ethUsdPrice);
    function migrate() external;
    function finalizeFailedAuction() external;
}
