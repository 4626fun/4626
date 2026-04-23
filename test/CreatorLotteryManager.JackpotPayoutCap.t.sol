// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

/// @notice Targeted fuzz/unit tests for the M-06 remediation in
/// contracts/utilities/lottery/CreatorLotteryManager.sol.
///
/// The remediation added:
///   - MAX_JACKPOT_PAYOUT_ITERATIONS = 128  (cap on *active* creators)
///   - MAX_JACKPOT_PAYOUT_SLOT_SCANS = 1024 (cap on registry slot scans)
///   - jackpotPayoutCursor state variable (rotating start index)
///   - Rotating-window loop in _payoutLocalJackpotInner
///   - JackpotPayoutCapped event (registrySize, startIndex, activeIterated, slotsScanned)
///
/// Because _payoutLocalJackpotInner is `internal`, we verify the invariant
/// at the library-math level by recreating the cursor arithmetic in this
/// test, identical to the Solidity expression used by the remediated code.
/// This guarantees the window math itself is correct; full end-to-end
/// behaviour (registry interaction, per-coin try/catch guards) is covered
/// by the existing CreatorLotteryManager.*.t.sol integration suite.
contract CreatorLotteryManagerJackpotPayoutCapTest is Test {
    uint256 private constant ACTIVE_CAP = 128;
    uint256 private constant SLOT_CAP = 1024;

    /// @dev Mirror of the remediated window math so we can fuzz it in
    /// isolation. Kept in sync with _payoutLocalJackpotInner by code review.
    /// Given a registry size, a cursor, and an `isActive` predicate, returns
    /// the number of active creators paid, the number of registry slots
    /// scanned, and the advanced cursor.
    function _walk(
        uint256 registrySize,
        uint256 cursor,
        bool[] memory isActive
    )
        private
        pure
        returns (uint256 startIndex, uint256 activeIterated, uint256 slotsScanned, uint256 nextCursor)
    {
        if (registrySize == 0) return (0, 0, 0, cursor);
        require(isActive.length == registrySize, "predicate len");

        uint256 activeCap = registrySize < ACTIVE_CAP ? registrySize : ACTIVE_CAP;
        uint256 slotCap = registrySize < SLOT_CAP ? registrySize : SLOT_CAP;
        startIndex = cursor % registrySize;

        for (uint256 k = 0; k < slotCap; k++) {
            if (activeIterated >= activeCap) break;
            uint256 i = (startIndex + k) % registrySize;
            slotsScanned = k + 1;
            if (!isActive[i]) continue;
            activeIterated++;
        }

        unchecked {
            nextCursor = startIndex + slotsScanned;
        }
    }

    /// @dev Helper: build an "all active" predicate for a given size.
    function _allActive(uint256 n) private pure returns (bool[] memory a) {
        a = new bool[](n);
        for (uint256 i = 0; i < n; i++) a[i] = true;
    }

    // ---------------------------------------------------------------------
    // Unit tests — all creators active (pre-Codex behaviour must still hold)
    // ---------------------------------------------------------------------

    function test_allActive_belowCap_iteratesAll() public pure {
        (, uint256 active, uint256 slots,) = _walk(50, 0, _allActive(50));
        assertEq(active, 50);
        assertEq(slots, 50);
    }

    function test_allActive_atCap_iteratesAll() public pure {
        (, uint256 active, uint256 slots,) = _walk(128, 0, _allActive(128));
        assertEq(active, 128);
        assertEq(slots, 128);
    }

    function test_allActive_aboveCap_iteratesCapOnly() public pure {
        (, uint256 active, uint256 slots,) = _walk(500, 0, _allActive(500));
        assertEq(active, ACTIVE_CAP);
        assertEq(slots, ACTIVE_CAP);
    }

    function test_allActive_cursorWrapsAround() public pure {
        (uint256 startIndex,,,) = _walk(10, 27, _allActive(10));
        assertEq(startIndex, 7);
    }

    // ---------------------------------------------------------------------
    // Unit tests — inactive-starvation scenarios (Codex concern)
    // ---------------------------------------------------------------------

    /// @notice Inactive prefix of any length up to SLOT_CAP must never starve
    /// active creators past it. With 1000 inactive entries followed by 50
    /// active, one call pays all 50 active (slot cap 1024 > 1050 is false, so
    /// this tests the exact bound: we need iterations to continue past the
    /// inactive prefix, which requires slotCap >= prefixLen + activeCount
    /// within a single registrySize <= SLOT_CAP).
    function test_inactivePrefix_activesReached_withinSlotCap() public pure {
        uint256 n = 900;
        uint256 inactivePrefix = 800;
        bool[] memory a = new bool[](n);
        for (uint256 i = inactivePrefix; i < n; i++) a[i] = true;

        (, uint256 active, uint256 slots,) = _walk(n, 0, a);
        // slotCap = min(n, SLOT_CAP) = 900, so we scan every slot and find
        // all 100 active entries.
        assertEq(active, 100);
        assertEq(slots, n);
    }

    /// @notice When the inactive prefix exceeds the slot cap, a single call
    /// stops early but the cursor advances so the next call resumes and
    /// eventually reaches every active creator.
    function test_inactivePrefix_cursorCarriesAcrossCalls() public pure {
        uint256 n = SLOT_CAP + 200; // 1224
        uint256 inactivePrefix = SLOT_CAP + 100; // 1124 inactive, 100 active
        bool[] memory a = new bool[](n);
        for (uint256 i = inactivePrefix; i < n; i++) a[i] = true;

        uint256 cursor = 0;
        uint256 totalActive;
        bool[] memory seen = new bool[](n);

        // Up to n successive calls is sufficient upper bound; in practice
        // ceil(n / SLOT_CAP) + 1 rounds reach every active entry.
        for (uint256 round = 0; round < 16; round++) {
            (uint256 startIndex, uint256 activeIter, uint256 slotsScanned, uint256 next) =
                _walk(n, cursor, a);
            for (uint256 k = 0; k < slotsScanned; k++) {
                uint256 idx = (startIndex + k) % n;
                if (a[idx] && !seen[idx]) {
                    seen[idx] = true;
                    totalActive++;
                }
            }
            cursor = next;
            activeIter; // silence unused
            if (totalActive == 100) break;
        }
        assertEq(totalActive, 100, "cursor rotation failed to reach actives past inactive prefix");
    }

    /// @notice All-inactive registry: each call scans up to SLOT_CAP, pays
    /// zero, and advances the cursor by slotsScanned. This is the worst-case
    /// gas bound and must never revert or underflow.
    function test_allInactive_slotCapBounds_noPayout() public pure {
        uint256 n = 4000;
        bool[] memory a = new bool[](n); // all false

        (, uint256 active, uint256 slots,) = _walk(n, 0, a);
        assertEq(active, 0);
        assertEq(slots, SLOT_CAP);
    }

    // ---------------------------------------------------------------------
    // Fuzz tests
    // ---------------------------------------------------------------------

    /// @notice Fuzz: with an arbitrary active pattern, iterating enough
    /// successive calls visits every index at least once as long as the
    /// total registry fits within the slot budget per full pass.
    function testFuzz_cursorEventuallyVisitsEveryIndex(uint256 seed) public pure {
        uint256 n = bound(seed, ACTIVE_CAP + 1, ACTIVE_CAP * 8);
        bool[] memory a = new bool[](n);
        // Mark every 3rd index as active; leaves gaps to test skip behaviour.
        for (uint256 i = 0; i < n; i++) {
            a[i] = (uint256(keccak256(abi.encode(seed, i))) % 3) == 0;
        }

        uint256 cursor = 0;
        bool[] memory visited = new bool[](n);
        // Worst case is ceil(n / min(activeCap, slotCap)) rounds plus a buffer
        // for inactive spans; a 3x bound is safe for n up to 8*ACTIVE_CAP.
        uint256 rounds = 3 * ((n + ACTIVE_CAP - 1) / ACTIVE_CAP);

        for (uint256 r = 0; r < rounds; r++) {
            (uint256 startIndex,, uint256 slotsScanned, uint256 nextCursor) = _walk(n, cursor, a);
            for (uint256 k = 0; k < slotsScanned; k++) {
                visited[(startIndex + k) % n] = true;
            }
            cursor = nextCursor;
        }

        for (uint256 i = 0; i < n; i++) {
            assertTrue(visited[i], "cursor rotation starved an index");
        }
    }

    /// @notice Fuzz: active count returned is bounded by min(registrySize,
    /// ACTIVE_CAP) and slotsScanned is bounded by min(registrySize, SLOT_CAP).
    /// Neither value underflows and the cursor advances in lockstep with
    /// slotsScanned.
    function testFuzz_boundsHoldForAnyActivityPattern(uint256 seed, uint256 cursorIn) public pure {
        uint256 n = bound(seed, 1, 5_000);
        bool[] memory a = new bool[](n);
        for (uint256 i = 0; i < n; i++) {
            a[i] = (uint256(keccak256(abi.encode(seed, i, "act"))) & 1) == 1;
        }

        (uint256 startIndex, uint256 activeIter, uint256 slotsScanned, uint256 nextCursor) =
            _walk(n, cursorIn, a);

        assertLt(startIndex, n, "start index out of range");
        assertLe(activeIter, ACTIVE_CAP, "active count exceeds cap");
        assertLe(activeIter, n, "active count exceeds registry");
        assertLe(slotsScanned, SLOT_CAP, "slots scanned exceed cap");
        assertLe(slotsScanned, n, "slots scanned exceed registry");
        assertEq(nextCursor, startIndex + slotsScanned, "cursor advance mismatch");
    }
}
