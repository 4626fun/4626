// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Shared constants used by CreatorOVault and delegatecall modules.
library OVaultModuleConstants {
    /// @dev Must match the storage layout version expected by the vault and modules.
    ///      Bumped to v4 for the M-2 fix (docs/audits/CreatorOVault_aristotle), which
    ///      appends `maxImpairmentTripDuration` to the shared storage layout.
    bytes32 internal constant MODULE_STORAGE_VERSION = keccak256("OVaultModuleStorage.v4");

    /// @dev Tropical year in seconds, used consistently across fee/unlock math.
    uint256 internal constant SECONDS_PER_YEAR = 31_556_952;
}
