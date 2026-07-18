// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DeployAlfaCreatorKeyLPFactory
 * @notice Fail-closed tombstone for the retired custom AlfaClub AMM deploy path.
 * @dev AlfaClub ERC-1155 / Creator Coin liquidity must use the pinned official
 *      Sudoswap v2 stack deployed by `DeploySudoswapV2Base` instead.
 */
contract DeployAlfaCreatorKeyLPFactory {
    error CustomAlfaClubAmmRetired();

    function run() external pure {
        revert CustomAlfaClubAmmRetired();
    }
}
