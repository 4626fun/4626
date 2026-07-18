// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.24;

/// @notice AlfaClub's narrowly scoped bridge from Universal Router commands to
/// official Sudoswap v2 ERC-1155/ERC-20 pairs.
interface IAlfaClubSudoswapAdapter {
    /// @notice Buys `keyAmount` ERC-1155 keys from an allowlisted Sudoswap pair.
    /// @return creatorCoinIn The exact Creator Coin amount paid through Permit2.
    function buy(address pair, address recipient, uint256 keyAmount, uint256 maxCreatorCoinIn, address payer)
        external
        returns (uint256 creatorCoinIn);

    /// @notice Sells `keyAmount` ERC-1155 keys into an allowlisted Sudoswap pair.
    /// @return creatorCoinOut The exact Creator Coin amount sent by the pair.
    function sell(address pair, address recipient, uint256 keyAmount, uint256 minCreatorCoinOut, address payer)
        external
        returns (uint256 creatorCoinOut);
}
