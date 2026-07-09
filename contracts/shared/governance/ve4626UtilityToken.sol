// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ve4626UtilityToken
 * @notice Non-transferable balance representing a utility of ve■4626 power.
 * @dev Minted only by `ve4626Utility`. Two instances:
 *      - vote   → gauge voting / fee weight
 *      - chance → optional personal lottery mult
 *
 * Naming: docs/contracts/governance/ve-naming.md
 * - Product lock: ve■4626 only
 * - Code: ve4626* without ■
 */
contract ve4626UtilityToken is ERC20, Ownable {
    address public minter;
    bool public transfersEnabled;

    error NotMinter();
    error TransfersDisabled();
    error ZeroAddress();

    event MinterUpdated(address indexed previous, address indexed next);
    event TransfersEnabledUpdated(bool enabled);

    constructor(string memory name_, string memory symbol_, address owner_)
        ERC20(name_, symbol_)
        Ownable(owner_)
    {}

    function setMinter(address minter_) external onlyOwner {
        if (minter_ == address(0)) revert ZeroAddress();
        emit MinterUpdated(minter, minter_);
        minter = minter_;
    }

    function setTransfersEnabled(bool enabled) external onlyOwner {
        transfersEnabled = enabled;
        emit TransfersEnabledUpdated(enabled);
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != minter) revert NotMinter();
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        if (msg.sender != minter) revert NotMinter();
        _burn(from, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0) && !transfersEnabled) {
            revert TransfersDisabled();
        }
        super._update(from, to, value);
    }
}
