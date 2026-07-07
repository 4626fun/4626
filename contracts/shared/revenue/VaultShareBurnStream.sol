// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ICreatorOVaultBurn {
    function burnSharesForPriceIncrease(uint256 shares) external;
    function pricePerShare() external view returns (uint256);
}

/**
 * @title VaultShareBurnStream
 * @notice Holds CreatorOVault shares (▢TOKEN) and burns them linearly over an epoch.
 *
 * @dev Enforceability:
 * - This contract has NO owner and NO withdrawal function.
 * - Vault shares deposited/minted to this address can only ever leave via burning.
 *
 * Epoch schedule:
 * - Weekly epochs aligned to Thursday 00:00 UTC (Unix epoch is Thursday 00:00 UTC).
 * - Shares minted to this contract are queued for the NEXT epoch.
 * - During an active epoch, anyone can call `drip()` to burn the proportional amount.
 * - If `drip()` is not called for a long time, the next call burns the full catch-up amount in one tx
 *   (up to the full epoch), which can create a discrete price-per-share jump. Run a keeper for smoothness.
 */
contract VaultShareBurnStream is ReentrancyGuard {
    // Weekly epochs (7 days)
    uint256 public constant EPOCH_DURATION = 7 days;

    address public immutable vault;
    IERC20 public immutable vaultShares;

    // Pending (next epoch)
    uint256 public pendingShares;
    uint256 public pendingEpochStart;

    // Active (current epoch)
    uint256 public activeShares;
    uint256 public activeEpochStart;
    uint256 public burnedActive;

    // FIX: BS-01 — access control for queueShares
    mapping(address => bool) public authorizedQueuers;

    // FIX: BS-03 — track failed burn amounts for manual recovery
    uint256 public failedBurnAccumulator;

    // FIX: H-05 — hard cap on how many failed shares we'll keep silently accruing
    // before the drip path starts reverting. Prevents unbounded silent loss when
    // burnSharesForPriceIncrease keeps failing (e.g. vault paused indefinitely).
    // Operators must call recoverFailedBurns before the cap is reached.
    uint256 public constant MAX_FAILED_BURN_ACCUMULATOR = 1_000_000e18;

    event SharesQueued(uint256 shares, uint256 indexed scheduledEpochStart);
    event StreamStarted(uint256 indexed epochStart, uint256 shares);
    event StreamDripped(
        uint256 indexed epochStart, uint256 burnedNow, uint256 burnedTotal, uint256 remaining, uint256 pps
    );
    event StreamCompleted(uint256 indexed epochStart, uint256 totalBurned, uint256 pps);
    // FIX: BS-03 — event for burn failures
    event BurnFailed(uint256 indexed epochStart, uint256 burnAttempted, uint256 failedTotal);
    // FIX: H-05 — recovery attempt event
    event FailedBurnsRecovered(uint256 recovered, uint256 remaining);
    // FIX: BS-01 — event for queuer authorization
    event QueuerAuthorizationUpdated(address indexed queuer, bool authorized);

    error ZeroAddress();
    error ZeroAmount();
    error NothingToStart();
    error TooSoon(uint256 nowTs, uint256 requiredTs);
    error NoActiveStream();
    error NoNewShares();
    error PendingEpochMismatch(uint256 pendingEpochStart, uint256 requiredEpochStart);
    // FIX: BS-01 — unauthorized queuer error
    error UnauthorizedQueuer();
    // FIX: H-05 — accumulator cap + recovery errors
    error FailedBurnAccumulatorFull(uint256 current, uint256 cap);
    error NothingToRecover();
    error OnlyVault();

    constructor(address _vault) {
        if (_vault == address(0)) revert ZeroAddress();
        vault = _vault;
        vaultShares = IERC20(_vault);
    }

    // FIX: BS-01 — vault itself can authorize queuers (since this contract has no owner)
    function setAuthorizedQueuer(address queuer, bool authorized) external {
        require(msg.sender == vault, "Only vault");
        authorizedQueuers[queuer] = authorized;
        emit QueuerAuthorizationUpdated(queuer, authorized);
    }

    // ================================
    // EPOCH HELPERS (THU 00:00 UTC)
    // ================================

    // Deterministic epoch bucketing helper; this is not used as a randomness source.
    // slither-disable-next-line weak-prng
    function epochStart(uint256 ts) public pure returns (uint256) {
        return ts - (ts % EPOCH_DURATION);
    }

    function nextEpochStart(uint256 ts) public pure returns (uint256) {
        return epochStart(ts) + EPOCH_DURATION;
    }

    // ================================
    // QUEUE NEW SHARES
    // ================================

    function _remainingActive() internal view returns (uint256) {
        return activeShares > burnedActive ? activeShares - burnedActive : 0;
    }

    function _startPendingInternal() internal {
        activeShares = pendingShares;
        activeEpochStart = pendingEpochStart;
        burnedActive = 0;

        pendingShares = 0;
        pendingEpochStart = 0;

        emit StreamStarted(activeEpochStart, activeShares);
    }

    function _rolloverIfNeeded() internal {
        // Advance/complete any active stream first.
        _drip();

        // If the pending bucket is now due, activate it before accepting new shares.
        // This prevents attributing shares received after an epoch boundary to the prior pending epoch.
        if (activeShares == 0 && pendingShares > 0 && pendingEpochStart != 0 && block.timestamp >= pendingEpochStart) {
            _startPendingInternal();
        }
    }

    function _queueSharesAfterRollover(uint256 shares) internal {
        uint256 remainingActive = _remainingActive();
        uint256 accounted = pendingShares + remainingActive;
        uint256 bal = vaultShares.balanceOf(address(this));
        if (bal < accounted + shares) revert NoNewShares();

        uint256 scheduled = nextEpochStart(block.timestamp);
        if (pendingShares == 0) {
            pendingEpochStart = scheduled;
        } else if (pendingEpochStart != scheduled) {
            // FIX: BS-02 — auto-advance stale pending bucket instead of reverting
            // If no active stream, start the stale pending shares and re-queue
            if (activeShares == 0 && block.timestamp >= pendingEpochStart) {
                _startPendingInternal();
                pendingEpochStart = scheduled;
            } else {
                revert PendingEpochMismatch(pendingEpochStart, scheduled);
            }
        }

        pendingShares += shares;
        emit SharesQueued(shares, pendingEpochStart);
    }

    function _queueSharesInternal(uint256 shares) internal {
        if (shares == 0) revert ZeroAmount();
        _rolloverIfNeeded();
        _queueSharesAfterRollover(shares);
    }

    /**
     * @notice Queue newly-minted/received vault shares for the next epoch.
     * @dev `shares` must correspond to NEW shares not yet accounted as pending/active.
     *      This lets routers call `queueShares(sharesMinted)` right after `vault.deposit(..., this)`.
     */
    // FIX: BS-01 — restrict queueShares to authorized callers only
    function queueShares(uint256 shares) public nonReentrant {
        if (!authorizedQueuers[msg.sender]) revert UnauthorizedQueuer();
        _queueSharesInternal(shares);
    }

    /**
     * @notice Convenience: queue ALL unaccounted shares.
     */
    function syncUnaccounted() external nonReentrant {
        _rolloverIfNeeded();

        uint256 remainingActive = _remainingActive();
        uint256 accounted = pendingShares + remainingActive;
        uint256 bal = vaultShares.balanceOf(address(this));
        if (bal <= accounted) revert NoNewShares();
        _queueSharesAfterRollover(bal - accounted);
    }

    // ================================
    // START + DRIP
    // ================================

    /**
     * @notice Start the pending stream once the scheduled epoch begins.
     */
    function start() public nonReentrant {
        if (pendingShares == 0) revert NothingToStart();
        if (pendingEpochStart == 0) revert NothingToStart();
        if (block.timestamp < pendingEpochStart) revert TooSoon(block.timestamp, pendingEpochStart);

        // Only one active stream at a time (one epoch).
        if (activeShares != 0) revert NothingToStart();

        _startPendingInternal();

        // If we started late, burn what should already have been burned.
        _drip();
    }

    /**
     * @notice Burn the proportional amount of shares for the active epoch.
     * @dev Permissionless.
     */
    function drip() external nonReentrant returns (uint256 burnedNow) {
        burnedNow = _drip();
    }

    /**
     * @notice Convenience: sync → start (if ready) → drip.
     */
    function checkpoint() external nonReentrant returns (uint256 burnedNow) {
        // Advance active and start a due pending stream (if any) before syncing.
        // This ensures newly received shares are always scheduled for the correct NEXT epoch.
        _rolloverIfNeeded();

        // Sync any unaccounted shares into the pending bucket (non-reverting).
        uint256 remainingActive = _remainingActive();
        uint256 accounted = pendingShares + remainingActive;
        uint256 bal = vaultShares.balanceOf(address(this));
        if (bal > accounted) {
            _queueSharesAfterRollover(bal - accounted);
        }

        burnedNow = _drip();
    }

    function _drip() internal returns (uint256 burnedNow) {
        if (activeShares == 0) return 0;
        if (block.timestamp < activeEpochStart) return 0;

        uint256 elapsed = block.timestamp - activeEpochStart;
        if (elapsed > EPOCH_DURATION) elapsed = EPOCH_DURATION;

        uint256 burnableTotal = (activeShares * elapsed) / EPOCH_DURATION;
        if (burnableTotal <= burnedActive) return 0;

        burnedNow = burnableTotal - burnedActive;
        burnedActive = burnableTotal;

        // FIX: BS-03 — wrap burn call in try/catch to prevent permanent stream lockup
        try ICreatorOVaultBurn(vault).burnSharesForPriceIncrease(burnedNow) {
            // success
        } catch {
            // FIX: H-05 — enforce a hard cap on accumulated failed burns so that
            // a persistently-failing vault does not silently build up unbounded
            // "ghost" shares. Operators must recover before the cap is reached.
            uint256 newAccum = failedBurnAccumulator + burnedNow;
            if (newAccum > MAX_FAILED_BURN_ACCUMULATOR) {
                revert FailedBurnAccumulatorFull(newAccum, MAX_FAILED_BURN_ACCUMULATOR);
            }
            failedBurnAccumulator = newAccum;
            emit BurnFailed(activeEpochStart, burnedNow, failedBurnAccumulator);
        }

        uint256 remaining = activeShares - burnedActive;
        uint256 pps;
        try ICreatorOVaultBurn(vault).pricePerShare() returns (uint256 _pps) {
            pps = _pps;
        } catch {}
        emit StreamDripped(activeEpochStart, burnedNow, burnedActive, remaining, pps);

        // FIX: BS-04 — force-complete at epoch end regardless of rounding
        if (elapsed >= EPOCH_DURATION) {
            // Burn any remainder due to rounding
            uint256 roundingRemainder = activeShares - burnedActive;
            if (roundingRemainder > 0) {
                try ICreatorOVaultBurn(vault).burnSharesForPriceIncrease(roundingRemainder) {} catch {
                    // FIX: H-05 — same cap enforcement on the rounding-remainder path
                    uint256 newAccum2 = failedBurnAccumulator + roundingRemainder;
                    if (newAccum2 > MAX_FAILED_BURN_ACCUMULATOR) {
                        revert FailedBurnAccumulatorFull(newAccum2, MAX_FAILED_BURN_ACCUMULATOR);
                    }
                    failedBurnAccumulator = newAccum2;
                    emit BurnFailed(activeEpochStart, roundingRemainder, failedBurnAccumulator);
                }
                burnedActive = activeShares;
            }
            emit StreamCompleted(activeEpochStart, activeShares, pps);
            activeShares = 0;
            activeEpochStart = 0;
            burnedActive = 0;
        }
    }

    // ================================
    // FAILED BURN RECOVERY (FIX: H-05)
    // ================================

    /**
     * @notice Retry burning shares accumulated from prior failed burn attempts.
     * @dev The accumulator grows whenever vault.burnSharesForPriceIncrease reverts
     *      during a drip (e.g. vault was paused). Once the vault is healthy again,
     *      the vault itself may call this to clear the accumulator and actually
     *      burn the queued-but-never-burned shares. Gated by the vault address
     *      because this contract has no owner (see BS-01 authorization model).
     *      Callable with `amount == 0` to retry the full accumulator.
     */
    function recoverFailedBurns(uint256 amount) external nonReentrant returns (uint256 recovered) {
        if (msg.sender != vault) revert OnlyVault();
        uint256 accum = failedBurnAccumulator;
        if (accum == 0) revert NothingToRecover();

        recovered = amount == 0 || amount > accum ? accum : amount;

        // Effects first
        failedBurnAccumulator = accum - recovered;

        // Interaction
        ICreatorOVaultBurn(vault).burnSharesForPriceIncrease(recovered);

        emit FailedBurnsRecovered(recovered, failedBurnAccumulator);
    }
}
