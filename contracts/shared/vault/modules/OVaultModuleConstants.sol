// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Shared constants used by CreatorOVault and delegatecall modules.
library OVaultModuleConstants {
    /// @dev Must match the storage layout version expected by the vault and modules.
    ///      Bumped to v5 for ODA-427-F1 (impairment challenge bond + per-epoch cap).
    bytes32 internal constant MODULE_STORAGE_VERSION = keccak256("OVaultModuleStorage.v5");

    /// @dev Tropical year in seconds, used consistently across fee/unlock math.
    uint256 internal constant SECONDS_PER_YEAR = 31_556_952;
}
