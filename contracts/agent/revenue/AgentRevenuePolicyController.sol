// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IAgentTokenV4} from "@4626/agent/interfaces/IAgentTokenV4.sol";

/**
 * @title AgentRevenuePolicyController
 * @notice Protocol-owned helper for agent token owner cooperation (V2).
 */
contract AgentRevenuePolicyController is Ownable {
    address public immutable agentToken;
    address public immutable agentRevenueRouter;

    event ProjectTaxRecipientEnforced(address indexed agentToken, address indexed agentRevenueRouter);

    error ZeroAddress();

    constructor(address agentToken_, address agentRevenueRouter_, address owner_) Ownable(owner_) {
        if (agentToken_ == address(0) || agentRevenueRouter_ == address(0) || owner_ == address(0)) {
            revert ZeroAddress();
        }
        agentToken = agentToken_;
        agentRevenueRouter = agentRevenueRouter_;
    }

    function enforceProjectTaxRecipient() external onlyOwner {
        IAgentTokenV4(agentToken).setProjectTaxRecipient(agentRevenueRouter);
        emit ProjectTaxRecipientEnforced(agentToken, agentRevenueRouter);
    }
}
