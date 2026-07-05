// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ILotteryManager4626
 * @notice Protocol-wide lottery manager interface (4626 hub singleton).
 */
interface ILotteryManager4626 {
    function processSwapLottery(address buyer, address tokenIn, uint256 amountIn) external payable returns (uint256);
    function processSwapLottery(address buyer, address tokenIn, uint256 amountIn, uint256 buyerCurrentShareBalance)
        external
        payable
        returns (uint256);
    function receiveRemoteLotteryEntry(uint32 srcEid, bytes32 originSender, bytes calldata payload) external;
}
