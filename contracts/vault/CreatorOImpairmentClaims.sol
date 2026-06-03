// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Non-transferable v1 impairment claims keyed by epoch id.
contract CreatorOImpairmentClaims is ERC1155, Ownable {
    address public vault;
    mapping(uint256 => uint256) public totalSupply;

    error Unauthorized();
    error ClaimTransferDisabled();

    constructor(address initialOwner) ERC1155("") Ownable(initialOwner) {}

    function setVault(address vault_) external onlyOwner {
        vault = vault_;
    }

    function mintFromVault(address account, uint256 epochId, uint256 amount) external {
        if (msg.sender != vault) revert Unauthorized();
        _mint(account, epochId, amount, "");
        totalSupply[epochId] += amount;
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values) internal override {
        if (from != address(0) && to != address(0)) revert ClaimTransferDisabled();
        super._update(from, to, ids, values);
    }
}

