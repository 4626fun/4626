// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Epoch-scoped recovery escrow. Vault notifies recoveries and executes claims.
contract CreatorORecoveryEscrow is Ownable {
    using SafeERC20 for IERC20;

    address public vault;
    mapping(uint256 => mapping(address => uint256)) public recoveredByEpochAsset;
    mapping(uint256 => mapping(address => uint256)) public claimedByEpochAsset;

    error Unauthorized();
    error ClaimExceedsRecovered(uint256 epochId, address asset, uint256 recovered, uint256 requested);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setVault(address vault_) external onlyOwner {
        vault = vault_;
    }

    function notifyRecovery(address asset, uint256 epochId, uint256 amount) external {
        if (msg.sender != vault) revert Unauthorized();
        recoveredByEpochAsset[epochId][asset] += amount;
    }

    function claimRecovery(address asset, uint256 epochId, address receiver, uint256 amount) external {
        if (msg.sender != vault) revert Unauthorized();
        // FIX C-2: epoch-scope the escrow balance. The escrow holds funds for
        // many epochs of the same asset; without this cap a single epoch's
        // claims could drain recoveries notified for other epochs.
        uint256 claimed = claimedByEpochAsset[epochId][asset] + amount;
        uint256 recovered = recoveredByEpochAsset[epochId][asset];
        if (claimed > recovered) revert ClaimExceedsRecovered(epochId, asset, recovered, claimed);
        claimedByEpochAsset[epochId][asset] = claimed;
        IERC20(asset).safeTransfer(receiver, amount);
    }
}

