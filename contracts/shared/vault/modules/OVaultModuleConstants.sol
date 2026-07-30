// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Shared constants used by CreatorOVault and delegatecall modules.
library OVaultModuleConstants {
    /// @dev Must match the storage layout version expected by the vault and modules.
    ///      Bumped to v5 for ODA-427-F1 (impairment challenge bond + per-epoch cap).
    ///      Bumped to v6 for LeftClaw #509 U-03 (isTrustedAdapter registry appended).
    ///      Bumped to v7 for Yearn-parity vault primitives (depositLimit, maxLoss, strategyMaxDebt).
    ///      Bumped to v8 for on-chain PPS checkpoints (APY display ring buffer).
    bytes32 internal constant MODULE_STORAGE_VERSION = keccak256("OVaultModuleStorage.v8");

    /// @dev Tropical year in seconds, used consistently across fee/unlock math.
    uint256 internal constant SECONDS_PER_YEAR = 31_556_952;

    /// @dev LeftClaw #509 U-01: iteration cap for the agent lane's measured strategy
    ///      refill loop (`AgentOVaultCoreModule._ensureCoin`). Each round grosses the
    ///      request up by the token's quoted transfer tax and re-measures the vault's
    ///      real balance; the loop breaks early on no progress.
    uint256 internal constant MAX_REFILL_ROUNDS = 4;

    /// @dev LeftClaw #509 U-10: single source of truth for the vault's ERC-4626
    ///      `_decimalsOffset()` virtual-offset math (offset 3 → 1000 virtual shares,
    ///      1 virtual asset). Modules must derive share/conversion math from these —
    ///      never hand-copy the literals (a one-word `virtual` restore or a base
    ///      literal change would otherwise desync minting from every preview).
    uint8 internal constant DECIMALS_OFFSET = 3;
    uint256 internal constant VIRTUAL_SHARES_UNITS = 10 ** DECIMALS_OFFSET;
    uint256 internal constant VIRTUAL_ASSETS_UNITS = 1;

    /// @dev LeftClaw #509 (operator-perm lead): sentinel stamped into every
    ///      `_operatorPerms` value written via the vault's grant functions, so
    ///      enforcement can distinguish "no registration" (permissionless baseline)
    ///      from "registered with zero perms" (deny everything — fail closed).
    ///      Sits above the real perm bits (OP_DEPOSIT = 1<<0, OP_WITHDRAW = 1<<1).
    uint256 internal constant OPERATOR_REGISTERED_BIT = 1 << 255;

    /// @dev On-chain APY display: ring capacity and minimum write spacing for the
    ///      vault's PPS checkpoint buffer. 64 × 12h spans 32 days, so a full ring
    ///      always covers 7d/30d lookbacks; single source of truth for the vault's
    ///      storage declaration, the module's writer, and the APY views.
    uint64 internal constant PPS_CHECKPOINT_CAPACITY = 64;
    uint40 internal constant PPS_CHECKPOINT_MIN_INTERVAL = 12 hours;
}
