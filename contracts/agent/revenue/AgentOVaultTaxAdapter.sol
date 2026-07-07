// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IAgentTaxAccountingAdapter} from "@4626/agent/interfaces/IAgentTaxAccountingAdapter.sol";

/**
 * @title AgentOVaultTaxAdapter
 * @notice V3 cooperation adapter — records buy/sell tax accrual for analytics and keeper hooks.
 */
contract AgentOVaultTaxAdapter is Ownable, IAgentTaxAccountingAdapter {
    address public immutable override agentToken;
    address public immutable override vault;

    mapping(address => bool) public authorizedCallers;
    uint64 public epoch;
    uint256 public totalBuyTaxAccrued;
    uint256 public totalSellTaxAccrued;

    error UnauthorizedCaller();

    modifier onlyAuthorized() {
        if (!authorizedCallers[msg.sender] && msg.sender != owner()) revert UnauthorizedCaller();
        _;
    }

    constructor(address agentToken_, address vault_, address owner_) Ownable(owner_) {
        require(agentToken_ != address(0) && vault_ != address(0), "zero");
        agentToken = agentToken_;
        vault = vault_;
    }

    function setAuthorizedCaller(address caller, bool allowed) external onlyOwner {
        authorizedCallers[caller] = allowed;
    }

    function onBuyTax(address, uint256 amount) external override onlyAuthorized {
        totalBuyTaxAccrued += amount;
        emit AgentRevenueAccrued(agentToken, vault, amount, 0, epoch);
    }

    function onSellTax(address, uint256 amount) external override onlyAuthorized {
        totalSellTaxAccrued += amount;
        emit AgentRevenueAccrued(agentToken, vault, 0, amount, epoch);
    }

    function bumpEpoch() external onlyOwner {
        epoch += 1;
    }
}
