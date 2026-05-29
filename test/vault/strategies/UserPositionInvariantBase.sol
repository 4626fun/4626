// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {RebalanceTestHarness} from "./RebalanceTestHarness.sol";

/// @title UserPositionInvariantBase
/// @notice Reusable base for invariant handlers that need to track real user positions
///         and protect them from artificial adversarial actions (e.g. extreme price skews).
///
/// This is one of the highest-leverage patterns for user-safety testing in yield/vault protocols.
///
/// Usage:
///   - Inherit from this in your handler.
///   - Call `setupTestUsers()` in your constructor or setUp.
///   - Use `depositForUser` / `withdrawForUser` for user flows.
///   - Call `_shouldBlockSkew()` (or override) before doing artificial price manipulation.
///   - Set `userProtectionMode = true` (default) for realistic user-exposed testing.
abstract contract UserPositionInvariantBase is RebalanceTestHarness {

    // === User Position Tracking ===
    mapping(address => uint256) public userDepositedAssets;
    mapping(address => uint256) public userSharesHeld;

    address[3] public testUsers;

    // === Protection Mode ===
    // When true, handlers should restrict or block artificial adverse actions
    // (price skews, etc.) while any tracked user has open positions.
    bool public userProtectionMode = true;

    function setupTestUsers() internal {
        testUsers[0] = address(0x1001);
        testUsers[1] = address(0x1002);
        testUsers[2] = address(0x1003);
    }

    function setUserProtectionMode(bool enabled) external {
        userProtectionMode = enabled;
    }

    // === User Actions (override these in concrete handlers to call the real vault) ===

    function depositForUser(uint256 userIndex, uint256 amount) external virtual {
        userIndex = bound(userIndex, 0, 2);
        address user = testUsers[userIndex];
        amount = bound(amount, 1e18, 20_000_000e18);

        // Concrete handlers must implement the actual mint + approve + deposit
        // This is intentionally left abstract so the base can be reused across different vaults.
        _depositForUser(user, amount);
    }

    function withdrawForUser(uint256 userIndex, uint256 shareFractionBps) external virtual {
        userIndex = bound(userIndex, 0, 2);
        address user = testUsers[userIndex];
        uint256 shares = userSharesHeld[user];
        if (shares == 0) return;

        uint256 toWithdraw = (shares * bound(shareFractionBps, 100, 10_000)) / 10_000;
        if (toWithdraw == 0) return;

        _withdrawForUser(user, toWithdraw);
    }

    // Hooks for concrete implementations — provide empty defaults so concrete handlers
    // can choose to override only what they need.
    function _depositForUser(address user, uint256 amount) internal virtual {}
    function _withdrawForUser(address user, uint256 amount) internal virtual {}

    // === Protection Logic ===

    /// @notice Returns true if skew/adversarial price actions should be blocked
    ///         because real users currently have exposure.
    function _shouldBlockSkew() internal view returns (bool) {
        if (!userProtectionMode) return false;

        for (uint256 i = 0; i < 3; i++) {
            if (userSharesHeld[testUsers[i]] > 0) {
                return true;
            }
        }
        return false;
    }

    /// @notice Convenience modifier for actions that should respect user protection.
    modifier onlyIfNoUserExposure() {
        require(!_shouldBlockSkew(), "Skew blocked: users have open positions");
        _;
    }
}