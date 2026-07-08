// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Non-transferable v1 impairment claims keyed by epoch id.
contract OVaultImpairmentClaims is ERC1155, Ownable {
    address public vault;
    address public pendingVault;
    uint256 public pendingVaultAt;
    mapping(uint256 => uint256) public totalSupply;
    uint256 public constant VAULT_UPDATE_TIMELOCK = 1 days;

    error Unauthorized();
    error ClaimTransferDisabled();
    error ZeroAddress();
    error NoPendingVault();
    error VaultUpdateTimelockActive(uint256 executeAfter);

    event VaultUpdateQueued(address indexed pendingVault, uint256 executeAfter);
    event VaultUpdated(address indexed previousVault, address indexed newVault);
    event ClaimMinted(address indexed account, uint256 indexed epochId, uint256 amount);

    constructor(address initialOwner) ERC1155("") Ownable(initialOwner) {}

    function setVault(address vault_) external onlyOwner {
        if (vault_ == address(0)) revert ZeroAddress();
        if (vault == address(0)) {
            address previous = vault;
            vault = vault_;
            emit VaultUpdated(previous, vault_);
            return;
        }
        pendingVault = vault_;
        pendingVaultAt = block.timestamp + VAULT_UPDATE_TIMELOCK;
        emit VaultUpdateQueued(vault_, pendingVaultAt);
    }

    function executeVaultUpdate() external onlyOwner {
        uint256 executeAfter = pendingVaultAt;
        if (executeAfter == 0) revert NoPendingVault();
        if (block.timestamp < executeAfter) revert VaultUpdateTimelockActive(executeAfter);

        address previous = vault;
        vault = pendingVault;
        pendingVault = address(0);
        pendingVaultAt = 0;
        emit VaultUpdated(previous, vault);
    }

    function mintFromVault(address account, uint256 epochId, uint256 amount) external {
        if (msg.sender != vault) revert Unauthorized();
        totalSupply[epochId] += amount;
        _mint(account, epochId, amount, "");
        emit ClaimMinted(account, epochId, amount);
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values) internal override {
        if (from != address(0) && to != address(0)) revert ClaimTransferDisabled();
        super._update(from, to, ids, values);
    }
}

