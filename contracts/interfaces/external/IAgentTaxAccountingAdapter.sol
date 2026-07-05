// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAgentTaxAccountingAdapter
 * @notice Callback surface for AgentTokenV4 `taxAccountingAdapter` cooperation (V3).
 */
interface IAgentTaxAccountingAdapter {
    event AgentRevenueAccrued(
        address indexed agentToken,
        address indexed vault,
        uint256 buyTaxAmount,
        uint256 sellTaxAmount,
        uint64 epoch
    );

    function onBuyTax(address buyer, uint256 amount) external;
    function onSellTax(address seller, uint256 amount) external;
    function agentToken() external view returns (address);
    function vault() external view returns (address);
}
