// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {CreatorOVault} from "../../../contracts/vault/CreatorOVault.sol";
import {CreatorCharmStrategy} from "../../../contracts/vault/strategies/univ3/CreatorCharmStrategy.sol";
import {AjnaERC4626Vault} from "../../../contracts/vault/strategies/ajna4626/AjnaERC4626Vault.sol";
import {ERC4626StrategyAdapter} from "../../../contracts/vault/strategies/ERC4626StrategyAdapter.sol";

import {UserPositionInvariantBase} from "./UserPositionInvariantBase.sol";

/// @title CreatorOVaultRealUserSafetyInvariant
/// @notice High-assurance invariant suite for user deposits when using *real* strategies.
/// @dev This suite is intended to be used with the actual CreatorCharmStrategy + AjnaERC4626Vault
///      (including the real backstop borrowing logic inside Charm).
///
/// It reuses the exact same user tracking + protection mode pattern from the base,
/// but now the invariants can be much tighter because the contracts behave more realistically.
///
/// Usage notes:
/// - This will likely require forking mainnet or a very faithful local deployment of the strategies.
/// - The protection mode (`userProtectionMode = true`) should remain on by default.
/// - Skew functions can be removed or heavily restricted here compared to the mock stress suite.
///
/// Recommended invariants (implement these first when real contracts are wired):
/// - invariant_userValueAfterRealCharmBackstopUsage()
/// - invariant_noDisproportionateLossWhenRebalancingWhileUsersExposed()
/// - invariant_userWorseOffThanIfTheyStayedFullyIdle()
/// - invariant_sharePriceBehaviorDuringProtectedRebalances()
contract RealUserSafetyInvariantHandler is UserPositionInvariantBase {

    // In the real version we will have references to the actual deployed strategies
    CreatorOVault internal realVault;
    CreatorCharmStrategy internal realCharm;
    AjnaERC4626Vault internal realAjna;           // or the adapter, depending on setup
    ERC4626StrategyAdapter internal ajnaAdapter;  // if using the adapter pattern

    // TODO: Replace the mock deployment with real strategy deployment / forking logic
    constructor() {
        // Example (to be replaced):
        // realVault = CreatorOVault(0x...);
        // realCharm = CreatorCharmStrategy(0x...);
        // ...
        //
        // For now we still deploy the mock vault so the file at least compiles.
        // Remove this once real deployment code is added.
        _deployMockVaultForCompilationOnly();
    }

    // Temporary helper so the file compiles while we build the real version.
    // Delete this once the real deployment/forking logic is in place.
    function _deployMockVaultForCompilationOnly() internal {
        // Minimal placeholder - real version will not need this.
        // This allows us to keep using some harness helpers during transition.
    }

    // === Override the hooks with real strategy calls ===

    function _depositForUser(address user, uint256 amount) internal override {
        // Real implementation will look like:
        // IERC20(creatorToken).transferFrom(msg.sender, user, amount); // or however funding works
        // vm.prank(user);
        // realVault.deposit(amount, user);
        //
        // For now, this is a no-op placeholder. (Tracking updates happen in base when _ is called.)
    }

    function _withdrawForUser(address user, uint256 sharesToRedeem) internal override {
        // Real implementation:
        // vm.prank(user);
        // realVault.redeem(sharesToRedeem, user, user);
        //
        // Placeholder. The proportional depositedAssets shrink logic lives in the
        // concrete handlers that actually track (see UserAccounting / Rebalance handlers).
    }

    // === Example high-signal invariants for the real backstop ===
    // NOTE: Do not declare `invariant_*` functions directly on the Handler.
    // They cause the fuzzer to attempt setup for them in a context with no
    // registered target contracts/selectors, producing "No contracts to fuzz."
    // Keep design sketches as comments or move real assertions to the
    // *InvariantTest contract (which owns the setUp + target registration).
}

contract CreatorOVaultRealUserSafetyInvariantTest is UserPositionInvariantBase {
    RealUserSafetyInvariantHandler internal handler;

    function setUp() external {
        handler = new RealUserSafetyInvariantHandler();
        handler.setupTestUsers();
        targetContract(address(handler));

        // Provide explicit selectors (even though the current impls are no-ops / placeholders)
        // so the invariant fuzzer has contracts to target and does not fail with
        // "No contracts to fuzz." during setup. When real strategies are wired, expand this list
        // and implement the _deposit/_withdraw + any rebalance/skew hooks.
        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = handler.depositForUser.selector;
        selectors[1] = handler.withdrawForUser.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    // Basic sanity invariants that should hold with real strategies

    function invariant_vaultRemainsSolventUnderUserProtection() external view {
        // With real strategies + protection mode, the vault should always be able to
        // service redemptions for tracked users.
        if (!handler.hasAnyUserExposure()) return;

        // Example using the new helpers from the base:
        uint256 userCapitalAtRisk = handler.totalUserDeposited();
        uint256 aggregateCurrent = handler.totalUserCurrentValue();

        // Cleanest form using the new helper:
        // if (handler.hasAnyUserExposure()) {
        //     assertTrue(handler.allUsersAboveBps(9800), "Worst user recovered less than 98% after real backstop usage");
        // }

        // Very clean single-line summary check:
        // if (handler.hasAnyUserExposure()) {
        //     UserRecoverySummary memory s = handler.getUserRecoverySummary();
        //     assertGe(s.minBps, 9500, "Worst user below 95%");
        //     assertGe(s.avgBps, 9700, "Average below 97%");
        // }

        // TODO: With real contracts:
        // uint256 totalAssets = realVault.totalAssets();
        // assertGe(totalAssets, userCapitalAtRisk * 9000 / 10000);
        // assertGe(aggregateCurrent, userCapitalAtRisk * 8500 / 10000);

        // Placeholder
    }
}