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

    function setupTestUsers() public {
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

    // === Reusable Views (highly recommended for invariants) ===

    /// @notice Returns true if any tracked test user currently holds shares in the vault.
    function hasAnyUserExposure() public view returns (bool) {
        for (uint256 i = 0; i < 3; i++) {
            if (userSharesHeld[testUsers[i]] > 0) {
                return true;
            }
        }
        return false;
    }

    /// @notice Returns the sum of all assets that tracked users have deposited (not current value).
    function totalUserDeposited() public view returns (uint256 total) {
        for (uint256 i = 0; i < 3; i++) {
            total += userDepositedAssets[testUsers[i]];
        }
    }

    /// @notice Returns the current mark-to-market value of a specific tracked user's shares.
    ///         Concrete handlers must override this with the actual vault's totalAssets/totalSupply logic.
    function getUserCurrentValue(address user) public view virtual returns (uint256) {
        // Default implementation returns 0. Concrete handlers (mock or real) should override.
        return 0;
    }

    /// @notice Returns the sum of current mark-to-market values across all tracked users.
    function totalUserCurrentValue() public view returns (uint256 total) {
        for (uint256 i = 0; i < 3; i++) {
            total += getUserCurrentValue(testUsers[i]);
        }
    }

    /// @notice Returns the current recovery of a specific user in basis points (current value / deposited * 10000).
    ///         Returns 0 if the user has no deposits.
    ///         Concrete handlers should override for accurate calculation with real vaults.
    function userRecoveryBps(address user) public view virtual returns (uint256) {
        uint256 deposited = userDepositedAssets[user];
        if (deposited == 0) return 0;

        uint256 current = getUserCurrentValue(user);
        return (current * 10000) / deposited;
    }

    /// @notice Returns whether a specific tracked user currently has exposure (positive shares).
    function userIsExposed(address user) public view returns (bool) {
        return userSharesHeld[user] > 0;
    }

    /// @notice Returns the lowest recovery (in basis points) among all currently exposed users.
    ///         Returns type(uint256).max if no users are exposed.
    ///         Very useful for invariants like "no user should be below X% recovery".
    function minUserRecoveryBps() public view returns (uint256 minBps) {
        minBps = type(uint256).max;
        bool anyExposed = false;

        for (uint256 i = 0; i < 3; i++) {
            address user = testUsers[i];
            if (userIsExposed(user)) {
                anyExposed = true;
                uint256 rec = userRecoveryBps(user);
                if (rec < minBps) minBps = rec;
            }
        }

        if (!anyExposed) return type(uint256).max;
    }

    /// @notice Returns true if every currently exposed user has recovery >= the given basis points.
    ///         Returns true if no users are currently exposed.
    ///         Extremely clean for invariants: "assertTrue(handler.allUsersAboveBps(8500));"
    function allUsersAboveBps(uint256 bps) public view returns (bool) {
        if (!hasAnyUserExposure()) return true;
        return minUserRecoveryBps() >= bps;
    }

    /// @notice Returns a dynamic array of all currently exposed users (those with positive shares).
    ///         Very useful when you want to iterate only over users who actually have skin in the game.
    function getExposedUsers() public view returns (address[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < 3; i++) {
            if (userIsExposed(testUsers[i])) count++;
        }

        address[] memory exposed = new address[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < 3; i++) {
            if (userIsExposed(testUsers[i])) {
                exposed[idx] = testUsers[i];
                idx++;
            }
        }
        return exposed;
    }

    /// @notice Returns the address of the currently exposed user with the lowest recovery.
    ///         Returns address(0) if no users are exposed.
    ///         Extremely useful for targeted debugging and specific per-user invariants.
    function worstExposedUser() public view returns (address worst) {
        uint256 lowest = type(uint256).max;
        worst = address(0);

        for (uint256 i = 0; i < 3; i++) {
            address user = testUsers[i];
            if (userIsExposed(user)) {
                uint256 rec = userRecoveryBps(user);
                if (rec < lowest) {
                    lowest = rec;
                    worst = user;
                }
            }
        }
    }

    /// @notice Returns the average recovery (in basis points) among all currently exposed users.
    ///         Returns 0 if no users are exposed.
    ///         Useful as a high-level "user base health" metric.
    ///         Concrete handlers should override when they have a better way to compute current value.
    function averageUserRecoveryBps() public view virtual returns (uint256) {
        uint256 sum = 0;
        uint256 count = 0;

        for (uint256 i = 0; i < 3; i++) {
            address user = testUsers[i];
            if (userIsExposed(user)) {
                sum += userRecoveryBps(user);
                count++;
            }
        }

        if (count == 0) return 0;
        return sum / count;
    }

    /// @notice A compact summary of recovery statistics across all currently exposed users.
struct UserRecoverySummary {
    uint256 minBps;
    uint256 avgBps;
    uint256 maxBps;
    uint256 exposedCount;
}

/// @notice Returns a summary struct with min/avg/max recovery + count of exposed users.
///         Extremely useful for a single-line "health check" invariant or logging.
function getUserRecoverySummary() public view returns (UserRecoverySummary memory summary) {
        uint256 minBps = type(uint256).max;
        uint256 maxBps = 0;
        uint256 sum = 0;
        uint256 count = 0;

        for (uint256 i = 0; i < 3; i++) {
            address user = testUsers[i];
            if (userIsExposed(user)) {
                uint256 rec = userRecoveryBps(user);
                if (rec < minBps) minBps = rec;
                if (rec > maxBps) maxBps = rec;
                sum += rec;
                count++;
            }
        }

        if (count == 0) {
            return UserRecoverySummary(0, 0, 0, 0);
        }

        summary.minBps = minBps;
        summary.avgBps = sum / count;
        summary.maxBps = maxBps;
        summary.exposedCount = count;
    }
}