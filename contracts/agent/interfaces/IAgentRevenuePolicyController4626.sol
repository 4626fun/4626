// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRevenuePolicyController4626} from
    "@4626/shared/interfaces/revenue/IRevenuePolicyController4626.sol";

/**
 * @title IAgentRevenuePolicyController4626
 * @notice AgentTokenV4 extension of the shared revenue-policy authority.
 */
interface IAgentRevenuePolicyController4626 is IRevenuePolicyController4626 {
    function agentToken() external view returns (address);
    function agentRevenueRouter() external view returns (address);
    function enforceProjectTaxRecipient() external;
}
