// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRevenueRouter4626
 * @notice Lane-neutral integration surface for external-earnings routers.
 * @dev CreatorPayoutRouter and AgentRevenueRouter expose this shared ABI today.
 *
 *      Intentionally outside this interface / not lane-identical:
 *      - Asset getters (`creatorCoin` vs `agentToken`).
 *      - Emergency withdraw (Creator is timelocked; Agent is immediate).
 *      - Keeper external-swap spend caps exist only on CreatorPayoutRouter.
 *
 *      Execution functions (`convertAndQueue`, `convertViaExternalAndQueue`,
 *      `processBatch`, protocol-reward claims) require owner or keeper.
 */
interface IRevenueRouter4626 {
    struct ExternalSwapParams {
        address tokenIn;
        uint256 amountIn;
        uint256 minOut;
        address spender;
        address swapTarget;
        bytes swapCallData;
    }

    struct BatchAction {
        uint8 kind;
        address tokenIn;
        uint256 amountIn;
        uint256 minOut;
        address spender;
        address swapTarget;
        bytes swapCallData;
    }

    function vault() external view returns (address);
    function wrapper() external view returns (address);
    function burnStream() external view returns (address);
    function shareOFT() external view returns (address);
    function swapRouter() external view returns (address);
    function weth() external view returns (address);
    function protocolRewards() external view returns (address);
    function keeper() external view returns (address);

    function approvedExternalSwapTargets(address target) external view returns (bool);
    function approvedExternalSwapSpenders(address spender) external view returns (bool);
    function swapPathToShareOFT(address tokenIn) external view returns (bytes memory);
    function protocolRewardsClaimable() external view returns (uint256);

    function convertAndQueue(address tokenIn, uint256 amountIn, uint256 minOut)
        external
        returns (uint256 tokenOut, uint256 sharesQueued);

    function convertViaExternalAndQueue(ExternalSwapParams calldata params)
        external
        returns (uint256 tokenOut, uint256 sharesQueued);

    function processBatch(BatchAction[] calldata actions)
        external
        returns (uint256 totalTokenOut, uint256 totalSharesQueued);

    function claimProtocolRewards(uint256 amount) external returns (uint256 claimed);
    function claimAllProtocolRewards() external returns (uint256 claimed);

    function setKeeper(address newKeeper) external;
    function removeKeeper() external;
    function setSwapPath(address tokenIn, bytes calldata path) external;
    function setExternalSwapTargetApproval(address target, bool approved) external;
    function setExternalSwapSpenderApproval(address spender, bool approved) external;
}
