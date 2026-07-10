// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ve4626 (ve■4626)
 * @author 0xakita.eth
 * @notice Vote-escrow commitment: lock **■4626 only** for dual-decay voting power.
 * @dev Product name: **ve■4626** (lowercase "ve" = vote-escrow).
 *      Contract/file: `ve4626` / `ve4626.sol` — always lowercase `ve`, never `VE` / `Ve4626`.
 *      Lock asset: immutable `wrappedShareOFT` = protocol ■4626 ($4626 stack), NOT per-creator ShareOFT.
 *      Creator vault ■ (e.g. ■AKITA) cannot be locked here — `lock` reverts `InvalidToken`.
 *      Optional utilities (vote / chance) live in `ve4626Utility`, not this contract.
 */

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

/**
 * @title Ive4626
 * @notice Interface for ve4626 (Vote-Escrowed ■4626)
 */
interface Ive4626 {
    struct Lock {
        uint256 amount;
        uint256 end;
        uint256 start;
        address lockedToken;
        uint256 underlyingValue;
    }

    // Errors
    error InvalidToken();
    error ZeroAmount();
    error InvalidLockDuration();
    error NoExistingLock();
    error AlreadyLocked();
    error LockDurationTooShort();
    error LockExpired();
    error LockNotExpired();

    // Events
    event Locked(address indexed user, address indexed token, uint256 amount, uint256 lockEnd, uint256 votingPower);
    event LockExtended(address indexed user, uint256 oldEnd, uint256 newEnd, uint256 newVotingPower);
    event LockIncreased(address indexed user, uint256 addedAmount, uint256 totalAmount, uint256 newVotingPower);
    event Unlocked(address indexed user, uint256 amount, address token);

    // Functions
    function lock(address token, uint256 amount, uint256 duration) external returns (uint256 votingPower);
    function extendLock(uint256 newEnd) external returns (uint256 newVotingPower);
    function increaseLock(uint256 amount) external returns (uint256 newVotingPower);
    function unlock() external returns (uint256 amount);
    function burnExpiredLock(address user) external;
    function getLock(address user) external view returns (Lock memory);
    function votingPower(address user) external view returns (uint256);
    function getVotingPower(address user) external view returns (uint256);
    function getTotalVotingPower() external view returns (uint256);
    function hasActiveLock(address user) external view returns (bool);

    // Constants
    function MIN_LOCK_DURATION() external view returns (uint256);
    function MAX_LOCK_DURATION() external view returns (uint256);
}

contract ve4626 is Ive4626, Ownable, ERC20, ERC20Permit, ERC20Votes, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================
    // CONSTANTS
    // ================================

    uint256 public constant override MIN_LOCK_DURATION = 7 days;
    uint256 public constant override MAX_LOCK_DURATION = 4 * 365 days; // 4 years

    // ================================
    // STATE
    // ================================

    /// @notice Wrapped ShareOFT token (e.g., ■4626)
    address public immutable wrappedShareOFT;

    /// @notice Vault for calculating underlying value
    address public vault;

    /// @notice Boost manager address
    address public boostManager;

    /// @notice User locks
    mapping(address => Lock) private _locks;

    /// @notice Minted ERC20 snapshot supply (legacy cosmetic / getPastTotalSupply writes).
    /// @dev Live boost/gauge math MUST use `getTotalVotingPower()` dual-decay, not this alone.
    uint256 private _totalVotingSupply;

    // ================================
    // CURVE-STYLE DUAL DECAY (total power)
    // ================================
    // power(user) = amount * remaining / MAX_LOCK
    // slope(user) = amount / MAX_LOCK  (per-second decay of bias)
    // Global bias decays with global slope; slope drops at each lock end via slopeChanges.

    uint256 private constant WEEK = 7 days;

    /// @dev Global bias (total voting power) as of `_decayPointTs`.
    uint256 private _decayBias;
    /// @dev Sum of active user slopes (amount / MAX_LOCK_DURATION).
    uint256 private _decaySlope;
    /// @dev Timestamp of last global decay point.
    uint256 private _decayPointTs;
    /// @dev Scheduled slope decreases at lock ends. New/extended locks are week-aligned,
    ///      so the weekly checkpoint walk reaches the exact user expiry timestamp.
    mapping(uint256 => uint256) private _slopeChanges;
    /// @dev Per-user slope currently contributing to the global total.
    mapping(address => uint256) private _userSlope;
    /// @dev Per-user lock end used for slopeChanges scheduling.
    mapping(address => uint256) private _userSlopeEnd;

    // FIX: H-06 — historical total-voting-supply checkpoints.
    // Previously getPastTotalSupply() returned the *current* _totalVotingSupply
    // for every timepoint, so a governance snapshot taken at block N would be
    // evaluated against the supply at the block the proposal was cast, enabling
    // quorum manipulation (e.g. unlock-then-vote-then-re-lock within a proposal).
    // We now append a (clock, supply) entry on every mutation of _totalVotingSupply
    // and binary-search it in getPastTotalSupply to return the supply that was
    // in effect at or before the requested clock value.
    struct SupplyCheckpoint {
        uint48 clockTime; // ERC20Votes clock() value (default: block.number)
        uint208 supply;   // _totalVotingSupply at that time
    }
    SupplyCheckpoint[] private _totalSupplyCheckpoints;

    // FIX: AUDIT-2026-07-01-H04 — per-user lock checkpoints so getPastVotes and
    // votingPowerAt resolve the lock amount/end in effect at a past timestamp
    // instead of always reading the current _locks[user] snapshot.
    struct LockCheckpoint {
        uint48 clockTime;
        uint128 amount;
        uint48 end;
    }
    mapping(address => LockCheckpoint[]) private _lockCheckpoints;

    error FutureSupplyLookup(uint256 timepoint, uint48 clockNow);
    error FutureVotesLookup(uint256 timepoint, uint48 clockNow);
    error SupplyCheckpointOverflow(uint256 supply);
    error LockCheckpointOverflow(uint256 value);

    // ================================
    // CONSTRUCTOR
    // ================================

    /**
     * @notice Constructor
     * @param _name Token name (e.g., "Vote-Escrowed Wrapped 4626 Share")
     * @param _symbol Token symbol (e.g., "ve■4626")
     * @param _wrappedShareOFT Protocol ■4626 only (not per-creator ShareOFT)
     * @param _owner Owner address
     */
    constructor(string memory _name, string memory _symbol, address _wrappedShareOFT, address _owner)
        ERC20(_name, _symbol)
        ERC20Permit(_name)
        Ownable(_owner)
    {
        require(_wrappedShareOFT != address(0), "Invalid wrapped share token");
        wrappedShareOFT = _wrappedShareOFT;
    }

    // ================================
    // LOCK FUNCTIONS
    // ================================

    /**
     * @notice Lock wrapped shares (■4626) to receive voting power
     * @param _token Token to lock (must be wrappedShareOFT)
     * @param amount Amount to lock
     * @param duration Lock duration in seconds
     */
    function lock(address _token, uint256 amount, uint256 duration)
        external
        override
        nonReentrant
        returns (uint256 votingPowerAmount)
    {
        if (_token != wrappedShareOFT) revert InvalidToken();
        if (amount == 0) revert ZeroAmount();
        if (duration < MIN_LOCK_DURATION) revert InvalidLockDuration();
        if (duration > MAX_LOCK_DURATION) revert InvalidLockDuration();
        // FIX: G-17 — use correct error for already-locked user
        if (_locks[msg.sender].amount > 0) revert AlreadyLocked(); // Must use increaseLock

        uint256 lockEnd = _weekFloor(block.timestamp + duration);
        // Flooring (never ceiling) keeps the accepted end within the requested duration.
        // A near-boundary minimum request may floor below the minimum and is rejected.
        if (lockEnd < block.timestamp + MIN_LOCK_DURATION) revert InvalidLockDuration();

        // Transfer tokens
        IERC20(_token).safeTransferFrom(msg.sender, address(this), amount);

        // Calculate voting power
        votingPowerAmount = _calculateVotingPower(amount, lockEnd);

        // Store lock
        _locks[msg.sender] = Lock({
            amount: amount,
            end: lockEnd,
            start: block.timestamp,
            lockedToken: _token,
            underlyingValue: _getUnderlyingValue(_token, amount)
        });

        // Mint ve4626 (non-transferable) — snapshot at lock; live power uses dual-decay views
        _mint(msg.sender, votingPowerAmount);
        _checkpointUserSlope(msg.sender, amount, lockEnd);

        // Notify boost manager
        _notifyBoostManager(msg.sender);

        emit Locked(msg.sender, _token, amount, lockEnd, votingPowerAmount);
        _writeLockCheckpoint(msg.sender);
    }

    /**
     * @notice Extend lock duration
     * @dev Intentionally allows extending an expired lock ("revive") so users can
     *      restore voting power without unlocking and re-locking (AUDIT-2026-07-01-L07).
     */
    function extendLock(uint256 newEnd) external override nonReentrant returns (uint256 newVotingPower) {
        Lock storage userLock = _locks[msg.sender];
        if (userLock.amount == 0) revert NoExistingLock();
        if (newEnd > block.timestamp + MAX_LOCK_DURATION) revert InvalidLockDuration();
        newEnd = _weekFloor(newEnd);
        if (newEnd <= userLock.end) revert LockDurationTooShort();

        uint256 oldEnd = userLock.end;
        uint256 oldPower = balanceOf(msg.sender);

        // Update lock end
        userLock.end = newEnd;

        // Recalculate voting power
        newVotingPower = _calculateVotingPower(userLock.amount, newEnd);

        // FIX: G-22 — adjust ve4626 balance in both directions (mint or burn)
        if (newVotingPower > oldPower) {
            _mint(msg.sender, newVotingPower - oldPower);
        } else if (newVotingPower < oldPower) {
            _burn(msg.sender, oldPower - newVotingPower);
        }

        _checkpointUserSlope(msg.sender, userLock.amount, newEnd);

        // Notify boost manager
        _notifyBoostManager(msg.sender);

        emit LockExtended(msg.sender, oldEnd, newEnd, newVotingPower);
        _writeLockCheckpoint(msg.sender);
    }

    /**
     * @notice Increase lock amount
     */
    function increaseLock(uint256 amount) external override nonReentrant returns (uint256 newVotingPower) {
        if (amount == 0) revert ZeroAmount();

        Lock storage userLock = _locks[msg.sender];
        if (userLock.amount == 0) revert NoExistingLock();
        if (userLock.lockedToken != wrappedShareOFT) revert InvalidToken();
        if (block.timestamp >= userLock.end) revert LockExpired();

        uint256 oldPower = balanceOf(msg.sender);

        // Transfer additional tokens
        IERC20(userLock.lockedToken).safeTransferFrom(msg.sender, address(this), amount);

        // Update lock
        userLock.amount += amount;
        userLock.underlyingValue = _getUnderlyingValue(userLock.lockedToken, userLock.amount);

        // Recalculate voting power
        newVotingPower = _calculateVotingPower(userLock.amount, userLock.end);

        // Mint additional ve4626
        if (newVotingPower > oldPower) {
            _mint(msg.sender, newVotingPower - oldPower);
        }

        _checkpointUserSlope(msg.sender, userLock.amount, userLock.end);

        // Notify boost manager
        _notifyBoostManager(msg.sender);

        emit LockIncreased(msg.sender, amount, userLock.amount, newVotingPower);
        _writeLockCheckpoint(msg.sender);
    }

    /**
     * @notice Unlock tokens after lock expires
     */
    function unlock() external override nonReentrant returns (uint256 amount) {
        Lock storage userLock = _locks[msg.sender];
        if (userLock.amount == 0) revert NoExistingLock();
        if (block.timestamp < userLock.end) revert LockNotExpired();

        amount = userLock.amount;
        address tokenToReturn = userLock.lockedToken;

        // Burn ve4626
        uint256 veBalance = balanceOf(msg.sender);
        if (veBalance > 0) {
            _burn(msg.sender, veBalance);
        }

        // Clear lock
        delete _locks[msg.sender];
        _checkpointUserSlope(msg.sender, 0, 0);
        _writeLockCheckpoint(msg.sender);

        // Return tokens
        IERC20(tokenToReturn).safeTransfer(msg.sender, amount);

        // Notify boost manager
        _notifyBoostManager(msg.sender);

        emit Unlocked(msg.sender, amount, tokenToReturn);
    }

    // FIX: G-01, G-02 — permissionless burn of expired locks to prevent ghost votes
    // and deflate _totalVotingSupply when locks expire without unlock()
    event ExpiredLockBurned(address indexed user, uint256 burnedBalance);

    function burnExpiredLock(address user) external override nonReentrant {
        Lock storage userLock = _locks[user];
        if (userLock.amount == 0) revert NoExistingLock();
        if (block.timestamp < userLock.end) revert LockNotExpired();

        uint256 veBalance = balanceOf(user);
        if (veBalance > 0) {
            _burn(user, veBalance);
        }

        // Remove dual-decay contribution; lock principal remains until unlock().
        _checkpointUserSlope(user, 0, 0);

        // Notify boost manager
        _notifyBoostManager(user);

        emit ExpiredLockBurned(user, veBalance);
    }

    // ================================
    // INTERNAL FUNCTIONS
    // ================================

    function _calculateVotingPower(uint256 amount, uint256 lockEnd) internal view returns (uint256) {
        if (block.timestamp >= lockEnd) return 0;

        uint256 duration = lockEnd - block.timestamp;
        // Linear: max power at MAX_LOCK_DURATION
        return (amount * duration) / MAX_LOCK_DURATION;
    }

    function _weekFloor(uint256 ts) internal pure returns (uint256) {
        return (ts / WEEK) * WEEK;
    }

    function _userSlopeOf(uint256 amount) internal pure returns (uint256) {
        return amount / MAX_LOCK_DURATION;
    }

    /// @dev Project global bias/slope from last stored point to `t` (view).
    function _decayStateAt(uint256 t)
        internal
        view
        returns (uint256 bias, uint256 slope, uint256 pointTs)
    {
        bias = _decayBias;
        slope = _decaySlope;
        pointTs = _decayPointTs;
        if (pointTs == 0) {
            return (0, 0, t);
        }
        if (t <= pointTs) {
            return (bias, slope, pointTs);
        }

        // Walk week boundaries applying scheduled slope decreases (Curve-style, max ~255 weeks).
        // New locks are week-aligned, making these boundaries exact expiries rather than
        // approximations. Upgrade note: pre-alignment locks retain their legacy arbitrary
        // end until extended (which migrates them to an aligned end) or withdrawn; no
        // storage migration is required, but their already-scheduled legacy point cannot
        // be repaired without enumerating holders.
        uint256 w = _weekFloor(pointTs);
        for (uint256 i = 0; i < 255;) {
            uint256 next = w + WEEK;
            if (next > t) {
                uint256 dt = t - pointTs;
                uint256 decay = slope * dt;
                bias = bias > decay ? bias - decay : 0;
                pointTs = t;
                break;
            }
            {
                uint256 dt = next - pointTs;
                uint256 decay = slope * dt;
                bias = bias > decay ? bias - decay : 0;
                pointTs = next;
            }
            slope = slope > _slopeChanges[next] ? slope - _slopeChanges[next] : 0;
            w = next;
            if (pointTs == t) break;
            unchecked {
                ++i;
            }
        }
    }

    /// @dev Persist dual-decay global point to `block.timestamp`.
    function _checkpointGlobal() internal {
        (uint256 bias, uint256 slope, uint256 ts) = _decayStateAt(block.timestamp);
        _decayBias = bias;
        _decaySlope = slope;
        _decayPointTs = ts == 0 ? block.timestamp : ts;
        // Keep historical total-supply checkpoints aligned with live dual-decay total.
        _totalVotingSupply = bias;
    }

    /// @dev Remove old user slope contribution and apply new lock amount/end.
    function _checkpointUserSlope(address user, uint256 newAmount, uint256 newEnd) internal {
        _checkpointGlobal();

        uint256 oldSlope = _userSlope[user];
        uint256 oldEnd = _userSlopeEnd[user];

        // After global checkpoint to `now`, only still-active locks remain in slope/bias.
        if (oldSlope > 0 && oldEnd > block.timestamp) {
            uint256 oldBias = oldSlope * (oldEnd - block.timestamp);
            _decayBias = _decayBias > oldBias ? _decayBias - oldBias : 0;
            _decaySlope = _decaySlope > oldSlope ? _decaySlope - oldSlope : 0;
            uint256 weekEnd = _weekFloor(oldEnd);
            if (weekEnd > block.timestamp) {
                if (_slopeChanges[weekEnd] >= oldSlope) _slopeChanges[weekEnd] -= oldSlope;
                else _slopeChanges[weekEnd] = 0;
            }
        }

        // Prefer exact user-power formula for bias add so totals match getVotingPower at lock time.
        uint256 newSlope = newAmount == 0 || newEnd <= block.timestamp ? 0 : _userSlopeOf(newAmount);
        if (newSlope > 0 || (newAmount > 0 && newEnd > block.timestamp)) {
            uint256 newBias = _calculateVotingPower(newAmount, newEnd);
            // Slope for decay: amount / MAX (may be 0 for dust); if 0, use ceil-1 wei slope only when bias > 0
            if (newSlope == 0 && newBias > 0) {
                newSlope = 1; // minimal slope so dust locks still decay eventually
            }
            _decaySlope += newSlope;
            _decayBias += newBias;
            // Accepted lock ends are exact week boundaries. Do not ceil an arbitrary end:
            // that would retain global slope after user power has expired.
            _slopeChanges[newEnd] += newSlope;
        }

        _userSlope[user] = newSlope;
        _userSlopeEnd[user] = newSlope == 0 ? 0 : newEnd;
        _decayPointTs = block.timestamp;

        // Sync supply checkpoint trail to live dual-decay total.
        _totalVotingSupply = _decayBias;
        _writeSupplyCheckpoint();
    }

    function _getUnderlyingValue(
        address,
        /* token */
        uint256 amount
    )
        internal
        view
        returns (uint256)
    {
        if (vault == address(0)) return amount;

        // If token is vault shares, get underlying value
        try IVault(vault).previewRedeem(amount) returns (uint256 value) {
            return value;
        } catch {
            return amount;
        }
    }

    function _notifyBoostManager(address user) internal {
        if (boostManager != address(0)) {
            try IBoostManager(boostManager).updateBalanceTracking(user) {} catch {}
        }
    }

    // ================================
    // VIEW FUNCTIONS
    // ================================

    function getLock(address user) external view override returns (Lock memory) {
        return _locks[user];
    }

    function votingPower(address user) public view override returns (uint256) {
        Lock memory userLock = _locks[user];
        if (userLock.amount == 0) return 0;
        return _calculateVotingPower(userLock.amount, userLock.end);
    }

    function getVotingPower(address user) external view override returns (uint256) {
        return votingPower(user);
    }

    function votingPowerAt(address user, uint256 timestamp) external view returns (uint256) {
        (uint256 amount, uint256 end) = _lockAt(user, timestamp);
        return _votingPowerAt(amount, end, timestamp);
    }

    /// @notice Live dual-decay total voting power (Curve-style bias − slope·Δt).
    /// @dev Prefer this over minted ERC20 supply for boost/gauge share math.
    function getTotalVotingPower() public view override returns (uint256) {
        (uint256 bias,,) = _decayStateAt(block.timestamp);
        return bias;
    }

    /// @notice Alias of live dual-decay total (same as `getTotalVotingPower`).
    function totalVotingSupply() external view returns (uint256) {
        return getTotalVotingPower();
    }

    /// @notice Minted ERC20 snapshot total (not dual-decay). Prefer `getTotalVotingPower`.
    function mintedVotingSupply() external view returns (uint256) {
        return _totalVotingSupply;
    }

    function hasActiveLock(address user) external view override returns (bool) {
        return _locks[user].amount > 0 && block.timestamp < _locks[user].end;
    }

    function getRemainingLockTime(address user) external view returns (uint256) {
        Lock memory userLock = _locks[user];
        if (userLock.amount == 0 || block.timestamp >= userLock.end) return 0;
        return userLock.end - block.timestamp;
    }

    // ================================
    // ADMIN
    // ================================

    function setVault(address _vault) external onlyOwner {
        vault = _vault;
    }

    function setBoostManager(address _boostManager) external onlyOwner {
        boostManager = _boostManager;
    }

    // ================================
    // OVERRIDES (Non-transferable)
    // ================================

    function transfer(address, uint256) public pure override returns (bool) {
        revert("ve4626: non-transferable");
    }

    function transferFrom(address, address, uint256) public pure override returns (bool) {
        revert("ve4626: non-transferable");
    }

    function approve(address, uint256) public pure override returns (bool) {
        revert("ve4626: non-transferable");
    }

    // Required overrides
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
        // FIX: H-06 — checkpoint _totalVotingSupply on every mint/burn so
        // getPastTotalSupply can resolve historical snapshots accurately.
        // This also covers the ExpiredLockBurned / increaseLockAmount paths
        // because they all funnel through _mint/_burn → _update.
        _writeSupplyCheckpoint();
    }

    /**
     * @dev FIX: H-06 — append the current _totalVotingSupply to the checkpoint
     *      array, replacing the last entry in-place when two writes happen
     *      within the same clock tick (matches the OZ Checkpoints convention).
     */
    function _writeSupplyCheckpoint() internal {
        uint256 supply = _totalVotingSupply;
        if (supply > type(uint208).max) revert SupplyCheckpointOverflow(supply);
        uint48 nowClock = SafeCastUint48(clock());
        uint256 len = _totalSupplyCheckpoints.length;
        if (len > 0 && _totalSupplyCheckpoints[len - 1].clockTime == nowClock) {
            _totalSupplyCheckpoints[len - 1].supply = uint208(supply);
        } else {
            _totalSupplyCheckpoints.push(
                SupplyCheckpoint({clockTime: nowClock, supply: uint208(supply)})
            );
        }
    }

    /**
     * @dev FIX: AUDIT-2026-07-01-H04 — append the user's lock amount/end after
     *      every lock mutation, coalescing writes within the same clock tick.
     */
    function _writeLockCheckpoint(address user) internal {
        Lock memory userLock = _locks[user];
        if (userLock.amount > type(uint128).max) revert LockCheckpointOverflow(userLock.amount);
        if (userLock.end > type(uint48).max) revert LockCheckpointOverflow(userLock.end);

        uint48 nowClock = SafeCastUint48(clock());
        uint256 len = _lockCheckpoints[user].length;
        LockCheckpoint memory checkpoint = LockCheckpoint({
            clockTime: nowClock,
            amount: uint128(userLock.amount),
            end: userLock.amount == 0 ? uint48(0) : uint48(userLock.end)
        });

        if (len > 0 && _lockCheckpoints[user][len - 1].clockTime == nowClock) {
            _lockCheckpoints[user][len - 1] = checkpoint;
        } else {
            _lockCheckpoints[user].push(checkpoint);
        }
    }

    function _lockAt(address account, uint256 timepoint) internal view returns (uint256 amount, uint256 end) {
        uint256 len = _lockCheckpoints[account].length;
        if (len == 0) return (0, 0);

        if (_lockCheckpoints[account][len - 1].clockTime <= timepoint) {
            LockCheckpoint storage latest = _lockCheckpoints[account][len - 1];
            return (latest.amount, latest.end);
        }

        uint256 lo = 0;
        uint256 hi = len;
        while (lo < hi) {
            uint256 mid = (lo + hi) >> 1;
            if (_lockCheckpoints[account][mid].clockTime > timepoint) {
                hi = mid;
            } else {
                lo = mid + 1;
            }
        }
        if (lo == 0) return (0, 0);
        LockCheckpoint storage prior = _lockCheckpoints[account][lo - 1];
        return (prior.amount, prior.end);
    }

    function _votingPowerAt(uint256 amount, uint256 end, uint256 timepoint)
        internal
        pure
        returns (uint256)
    {
        if (amount == 0) return 0;
        if (timepoint >= end) return 0;
        uint256 duration = end - timepoint;
        return (amount * duration) / MAX_LOCK_DURATION;
    }

    /**
     * @dev FIX: H-06 — tiny local helper because we do not want to import
     *      OZ SafeCast just for one uint48 cast.
     */
    function SafeCastUint48(uint256 v) private pure returns (uint48) {
        require(v <= type(uint48).max, "clock overflow");
        return uint48(v);
    }

    // FIX: AUDIT-2026-07-01-H04 — use timestamp clock so lock.end comparisons in
    // getPastVotes share the same unit as ERC20Votes historical queries.
    function clock() public view override returns (uint48) {
        return uint48(block.timestamp);
    }

    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=timestamp";
    }

    // FIX: G-07 — override getPastVotes to return time-decayed voting power
    // instead of raw ERC20 balance checkpoints, preventing stale governance snapshots
    function getPastVotes(address account, uint256 timepoint) public view override returns (uint256) {
        uint48 currentClock = SafeCastUint48(clock());
        if (timepoint >= currentClock) revert FutureVotesLookup(timepoint, currentClock);

        (uint256 amount, uint256 end) = _lockAt(account, timepoint);
        return _votingPowerAt(amount, end, timepoint);
    }

    // FIX: H-06 (supersedes G-07) — binary search the checkpoint array to
    // return the _totalVotingSupply in effect at `timepoint`. The prior
    // implementation always returned the current supply regardless of
    // timepoint, which let a voter manipulate quorum by changing their lock
    // between the snapshot block and the vote cast.
    function getPastTotalSupply(uint256 timepoint) public view override returns (uint256) {
        uint48 currentClock = SafeCastUint48(clock());
        if (timepoint >= currentClock) revert FutureSupplyLookup(timepoint, currentClock);

        uint256 len = _totalSupplyCheckpoints.length;
        if (len == 0) return 0;

        // Binary search for the last checkpoint with clockTime <= timepoint.
        // Invariant: answer lies in [lo, hi).
        uint256 lo = 0;
        uint256 hi = len;
        while (lo < hi) {
            uint256 mid = (lo + hi) >> 1;
            if (_totalSupplyCheckpoints[mid].clockTime > timepoint) {
                hi = mid;
            } else {
                lo = mid + 1;
            }
        }
        // lo is the first index with clockTime > timepoint; the checkpoint at
        // lo - 1 is the one in effect at `timepoint`.
        if (lo == 0) return 0;
        return uint256(_totalSupplyCheckpoints[lo - 1].supply);
    }

    function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}

// Helper interfaces
interface IVault {
    function previewRedeem(uint256 shares) external view returns (uint256);
}

interface IBoostManager {
    function updateBalanceTracking(address user) external;
}

