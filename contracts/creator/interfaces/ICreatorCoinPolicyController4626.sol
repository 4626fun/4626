// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRevenuePolicyController4626} from
    "@4626/shared/interfaces/revenue/IRevenuePolicyController4626.sol";

/**
 * @title ICreatorCoinPolicyController4626
 * @notice Zora Creator Coin extension of the shared revenue-policy authority.
 */
interface ICreatorCoinPolicyController4626 is IRevenuePolicyController4626 {
    function creatorCoin() external view returns (address);
    function payoutRouter() external view returns (address);
    function pendingCreatorCoinOwner() external view returns (address);

    function enforcePayoutRouter() external;
    function proposeCreatorCoinOwnershipTransfer(address newOwner) external;
    function acceptCreatorCoinOwnership() external;
    function cancelCreatorCoinOwnershipTransfer() external;
}
