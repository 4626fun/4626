// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ITradeFeeCollector4626
 * @notice Lane-neutral integration surface for 4626 tradeFeeCollector contracts.
 * @dev CreatorGaugeController and AgentGaugeController expose this shared ABI.
 *
 *      Intentionally outside this interface / not lane-identical:
 *      - Asset setters (`setCreatorCoin` vs `setAgentToken`).
 *      - Ongoing treasury getters (`creatorTreasury` vs `agentTreasury`) and BPS
 *        names (`creatorShareBps` vs `treasuryShareBps`). `getFeeSplit()` third
 *        return is the ongoing-treasury slice for both lanes.
 *      - `receiveFees` accounting: Creator credits the observed balance delta;
 *        Agent credits the requested `amount`.
 *      - `setLotteryManager`: Creator applies immediately; Agent first set is
 *        immediate, later updates are 1-day timelocked via
 *        `executeLotteryManagerUpdate()`.
 *      - WETH fee oracle fallback behavior differs when the oracle is disabled.
 */
interface ITradeFeeCollector4626 {
    function vault() external view returns (address);
    function wrapper() external view returns (address);
    function shareOFT() external view returns (address);
    function oracle() external view returns (address);
    function lotteryManager() external view returns (address);

    function burnShareBps() external view returns (uint256);
    function lotteryShareBps() external view returns (uint256);
    function protocolShareBps() external view returns (uint256);

    function receiveFees(uint256 amount) external;
    function receiveBridgedFees() external;
    function receiveWETHFees(uint256 amount) external;
    function distribute() external;
    function forceDistribute() external;

    function payJackpot(address winner, uint256 amount) external;
    function availableJackpotReserve() external view returns (uint256);
    function getAvailableJackpotReserve() external view returns (uint256);
    function getJackpotReserve() external view returns (uint256);

    function getFeeSplit()
        external
        pure
        returns (uint256 burn, uint256 lottery, uint256 ongoingTreasury, uint256 protocol);

    function setVault(address vault_) external;
    function setWrapper(address wrapper_) external;
    function setLotteryManager(address lotteryManager_) external;
    function setOracle(address oracle_) external;
    function transferOwnership(address newOwner) external;
}
