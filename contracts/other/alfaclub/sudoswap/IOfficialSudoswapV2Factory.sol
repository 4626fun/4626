// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

/// @notice ABI surface of the hook-enabled Sudoswap v2 factory deployed on Base.
/// @dev The vendored rehearsal source predates the two trailing create-pair
///      fields, so production callers must use this exact tuple shape.
interface IOfficialSudoswapV2Factory {
    struct CreateERC1155ERC20PairParams {
        address token;
        address nft;
        address bondingCurve;
        address payable assetRecipient;
        uint8 poolType;
        uint128 delta;
        uint96 fee;
        uint128 spotPrice;
        uint256 nftId;
        uint256 initialNFTBalance;
        uint256 initialTokenBalance;
        address hookAddress;
        address referralAddress;
    }

    function createPairERC1155ERC20(CreateERC1155ERC20PairParams calldata params) external returns (address pair);
}
