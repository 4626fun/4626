// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IOVault4626
 * @notice Lane-neutral vault wiring surface shared by CreatorOVault and AgentOVault.
 * @dev Asset-specific getters remain outside this interface. Shared consumers
 *      (DeploymentBatcher, ShareOFT view helpers) should type against this ABI.
 */
interface IOVault4626 {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function setModulesOnce(address coreModule, address strategiesModule, address adminModule) external;
    function setGaugeController(address controller_) external;
    function setCcaLaunchArm(address ccaLaunchArm_) external;
    function setWhitelist(address account, bool status) external;
    function setProtocolRescue(address rescue) external;
    function transferOwnership(address newOwner) external;
    function convertToAssets(uint256 shares) external view returns (uint256);
}
