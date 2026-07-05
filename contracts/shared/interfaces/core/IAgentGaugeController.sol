// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAgentGaugeController
 * @author 0xakita.eth
 * @notice Interface for configuring creator gauge controllers.
 * @dev Used by registry and vault setup flows.
 */
interface IAgentGaugeController {
    function setVault(address _vault) external;
    function setWrapper(address _wrapper) external;
    function setCreatorCoin(address _creatorCoin) external;
    function setLotteryManager(address _lotteryManager) external;
    function setOracle(address _oracle) external;
    function transferOwnership(address newOwner) external;
    function receiveFees(uint256 amount) external;
}
