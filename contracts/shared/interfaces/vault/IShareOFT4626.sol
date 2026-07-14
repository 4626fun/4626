// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IShareOFT4626
 * @notice Lane-neutral integration surface for 4626 ShareOFT mesh tokens.
 * @dev CreatorShareOFT and AgentShareOFT expose this common configuration,
 *      trade-fee, and lottery-coverage ABI. Lane-specific normalization and
 *      wrapper cooldown behavior intentionally remain outside this interface.
 */
interface IShareOFT4626 {
    function registry() external view returns (address);
    function vault() external view returns (address);
    function wrapper() external view returns (address);
    function gaugeController() external view returns (address);
    function tradeFeeCollector() external view returns (address);

    function setRegistry(address registry_) external;
    function setVault(address vault_) external;
    function setWrapper(address wrapper_) external;
    function setGaugeController(address gaugeController_) external;
    function setHubConfig(bool isHub_, uint32 hubEid_, address hubToken_) external;
    function setAddressType(address account, uint8 operationType) external;
    function setAddressTypes(address[] calldata accounts, uint8 operationType) external;

    function flushPendingFeesToGauge() external;
    function balanceEligibleForLotteryCoverage(address account) external view returns (uint256);
}
