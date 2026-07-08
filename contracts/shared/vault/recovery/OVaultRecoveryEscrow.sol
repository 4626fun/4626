// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Epoch-scoped recovery escrow. Vault notifies recoveries and executes claims.
contract OVaultRecoveryEscrow is Ownable {
    using SafeERC20 for IERC20;

    address public vault;
    address public pendingVault;
    uint256 public pendingVaultAt;
    /// @notice Sum of unclaimed recovery across all assets (for vault-update gates).
    uint256 public totalUnclaimedRecovery;
    /// @notice Per-asset unclaimed recovery (AUDIT-2026-07-08-R-H02 free-custody basis).
    mapping(address => uint256) public totalUnclaimedRecoveryByAsset;
    mapping(uint256 => mapping(address => uint256)) public recoveredByEpochAsset;
    mapping(uint256 => mapping(address => uint256)) public claimedByEpochAsset;
    uint256 public constant VAULT_UPDATE_TIMELOCK = 1 days;

    error Unauthorized();
    error ZeroAddress();
    error NoPendingVault();
    error VaultUpdateTimelockActive(uint256 executeAfter);
    error PendingRecoveryClaims(uint256 unclaimedAmount);
    error ClaimExceedsRecovered(uint256 epochId, address asset, uint256 recovered, uint256 requested);
    /// @dev Vault must push assets before notify; free = held(asset) - unclaimed(asset).
    error InsufficientRecoveryCustody(address asset, uint256 free, uint256 requested);

    event VaultUpdateQueued(address indexed pendingVault, uint256 executeAfter);
    event VaultUpdated(address indexed previousVault, address indexed newVault);
    event RecoveryNotified(address indexed asset, uint256 indexed epochId, uint256 amountReceived);
    event RecoveryClaimed(address indexed asset, uint256 indexed epochId, address indexed receiver, uint256 amount);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setVault(address vault_) external onlyOwner {
        if (vault_ == address(0)) revert ZeroAddress();
        if (totalUnclaimedRecovery > 0) revert PendingRecoveryClaims(totalUnclaimedRecovery);
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
        if (totalUnclaimedRecovery > 0) revert PendingRecoveryClaims(totalUnclaimedRecovery);

        address previous = vault;
        vault = pendingVault;
        pendingVault = address(0);
        pendingVaultAt = 0;
        emit VaultUpdated(previous, vault);
    }

    /// @notice Credit recovery for an epoch after the vault has already pushed tokens.
    /// @dev Vault push-then-notify model (see CreatorOVaultCoreModule.notifyImpairmentRecovery).
    ///      Free custody is **per asset** (R-H02): do not subtract global unclaimed from a
    ///      single token balance.
    function notifyRecovery(address asset, uint256 epochId, uint256 amount) external {
        if (msg.sender != vault) revert Unauthorized();
        if (asset == address(0)) revert ZeroAddress();
        if (amount == 0) return;

        uint256 held = IERC20(asset).balanceOf(address(this));
        uint256 unclaimedAsset = totalUnclaimedRecoveryByAsset[asset];
        if (held < unclaimedAsset) {
            revert InsufficientRecoveryCustody(asset, 0, amount);
        }
        uint256 free = held - unclaimedAsset;
        if (free < amount) revert InsufficientRecoveryCustody(asset, free, amount);

        recoveredByEpochAsset[epochId][asset] += amount;
        totalUnclaimedRecoveryByAsset[asset] = unclaimedAsset + amount;
        totalUnclaimedRecovery += amount;

        emit RecoveryNotified(asset, epochId, amount);
    }

    function claimRecovery(address asset, uint256 epochId, address receiver, uint256 amount) external {
        if (msg.sender != vault) revert Unauthorized();
        if (receiver == address(0)) revert ZeroAddress();
        // FIX C-2: epoch-scope the escrow balance. The escrow holds funds for
        // many epochs of the same asset; without this cap a single epoch's
        // claims could drain recoveries notified for other epochs.
        uint256 claimed = claimedByEpochAsset[epochId][asset] + amount;
        uint256 recovered = recoveredByEpochAsset[epochId][asset];
        if (claimed > recovered) revert ClaimExceedsRecovered(epochId, asset, recovered, claimed);
        claimedByEpochAsset[epochId][asset] = claimed;
        totalUnclaimedRecoveryByAsset[asset] -= amount;
        totalUnclaimedRecovery -= amount;
        IERC20(asset).safeTransfer(receiver, amount);
        emit RecoveryClaimed(asset, epochId, receiver, amount);
    }
}
