// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ve4626 - 4626 Protocol Token
 * @author 0xakita.eth
 * @notice Vote-escrowed ERC4626 (ve■4626) for protocol-wide boosts.
 * @dev Users lock ■4626 to get voting power and lottery boosts.
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

    /// @notice Total voting supply
    uint256 private _totalVotingSupply;

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

    error FutureSupplyLookup(uint256 timepoint, uint48 clockNow);
    error SupplyCheckpointOverflow(uint256 supply);

    // ================================
    // CONSTRUCTOR
    // ================================

    /**
     * @notice Constructor
     * @param _name Token name (e.g., "Vote-Escrowed Wrapped 4626 Share")
     * @param _symbol Token symbol (e.g., "ve■4626")
     * @param _wrappedShareOFT The ■4626 (or similar) token to lock
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

        uint256 lockEnd = block.timestamp + duration;

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

        // Mint ve4626 (non-transferable)
        _mint(msg.sender, votingPowerAmount);
        _totalVotingSupply += votingPowerAmount;

        // Notify boost manager
        _notifyBoostManager(msg.sender);

        emit Locked(msg.sender, _token, amount, lockEnd, votingPowerAmount);
    }

    /**
     * @notice Extend lock duration
     */
    function extendLock(uint256 newEnd) external override nonReentrant returns (uint256 newVotingPower) {
        Lock storage userLock = _locks[msg.sender];
        if (userLock.amount == 0) revert NoExistingLock();
        if (newEnd <= userLock.end) revert LockDurationTooShort();
        if (newEnd > block.timestamp + MAX_LOCK_DURATION) revert InvalidLockDuration();

        uint256 oldEnd = userLock.end;
        uint256 oldPower = balanceOf(msg.sender);

        // Update lock end
        userLock.end = newEnd;

        // Recalculate voting power
        newVotingPower = _calculateVotingPower(userLock.amount, newEnd);

        // FIX: G-22 — adjust ve4626 balance in both directions (mint or burn)
        if (newVotingPower > oldPower) {
            uint256 diff = newVotingPower - oldPower;
            _mint(msg.sender, diff);
            _totalVotingSupply += diff;
        } else if (newVotingPower < oldPower) {
            uint256 diff = oldPower - newVotingPower;
            _burn(msg.sender, diff);
            _totalVotingSupply -= diff;
        }

        // Notify boost manager
        _notifyBoostManager(msg.sender);

        emit LockExtended(msg.sender, oldEnd, newEnd, newVotingPower);
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
            uint256 diff = newVotingPower - oldPower;
            _mint(msg.sender, diff);
            _totalVotingSupply += diff;
        }

        // Notify boost manager
        _notifyBoostManager(msg.sender);

        emit LockIncreased(msg.sender, amount, userLock.amount, newVotingPower);
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
            _totalVotingSupply -= veBalance;
        }

        // Clear lock
        delete _locks[msg.sender];

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
            _totalVotingSupply -= veBalance;
        }

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
        Lock memory userLock = _locks[user];
        if (userLock.amount == 0) return 0;
        if (timestamp >= userLock.end) return 0;

        uint256 duration = userLock.end - timestamp;
        return (userLock.amount * duration) / MAX_LOCK_DURATION;
    }

    function getTotalVotingPower() external view override returns (uint256) {
        return _totalVotingSupply;
    }

    function totalVotingSupply() external view returns (uint256) {
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
     * @dev FIX: H-06 — tiny local helper because we do not want to import
     *      OZ SafeCast just for one uint48 cast.
     */
    function SafeCastUint48(uint256 v) private pure returns (uint48) {
        require(v <= type(uint48).max, "clock overflow");
        return uint48(v);
    }

    // FIX: G-07 — override getPastVotes to return time-decayed voting power
    // instead of raw ERC20 balance checkpoints, preventing stale governance snapshots
    function getPastVotes(address account, uint256 timepoint) public view override returns (uint256) {
        Lock memory userLock = _locks[account];
        if (userLock.amount == 0) return 0;
        if (timepoint >= userLock.end) return 0;
        uint256 duration = userLock.end - timepoint;
        return (userLock.amount * duration) / MAX_LOCK_DURATION;
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

