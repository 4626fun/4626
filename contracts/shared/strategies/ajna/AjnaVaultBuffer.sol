// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AjnaVaultBuffer
 * @notice Dedicated idle reserve for the inner Ajna ERC-4626 vault.
 * @dev The vault is the only allowed caller. The buffer keeps exit liquidity
 *      separate from Ajna bucket positions so outer withdrawals can inspect a
 *      single reserve balance.
 */
contract AjnaVaultBuffer {
    using SafeERC20 for IERC20;

    error NotVault();

    IERC20 public immutable asset;
    address public immutable vault;

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault();
        _;
    }

    constructor(IERC20 asset_) {
        asset = asset_;
        vault = msg.sender;
    }

    function depositFromVault(uint256 assets) external onlyVault {
        if (assets == 0) return;
        asset.safeTransferFrom(msg.sender, address(this), assets);
    }

    function withdrawToVault(uint256 assets) external onlyVault {
        if (assets == 0) return;
        asset.safeTransfer(msg.sender, assets);
    }

    function totalAssets() external view returns (uint256) {
        return asset.balanceOf(address(this));
    }
}
