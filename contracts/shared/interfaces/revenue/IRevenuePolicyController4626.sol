// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRevenuePolicyController4626
 * @notice Common ownership surface for ecosystem-specific revenue policy controllers.
 * @dev Enforcement selectors and controlled-asset getters remain in lane extensions
 *      because external ecosystems expose different administrative ABIs.
 */
interface IRevenuePolicyController4626 {
    function owner() external view returns (address);
    function transferOwnership(address newOwner) external;
}
