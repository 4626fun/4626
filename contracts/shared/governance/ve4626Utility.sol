// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ve4626UtilityToken} from "./ve4626UtilityToken.sol";

interface Ive4626 {
    function getVotingPower(address user) external view returns (uint256);
    function getTotalVotingPower() external view returns (uint256);
}

/**
 * @title ve4626Utility
 * @notice Claim ve33 / veLottery utilities from live ve■4626 power.
 * @dev Product lock: **ve■4626** (`ve4626`). This module: **ve4626Utility** (no ■ in the id).
 *
 *      capacity = dual-decay ve■4626 power (shrinks over time)
 *      free     = capacity - claimedVe33 - claimedVeLottery  (after sync)
 *
 *      ve33      → ve4626GaugeVoting
 *      veLottery → ve4626BoostManager (lottery mult, opt-in)
 *
 * Default claim-all: ve33 only.
 *
 * When ve power decays below outstanding utilities, call `sync(user)` (or any claim/forfeit)
 * which burns excess: **veLottery first**, then ve33.
 *
 * Naming: docs/contracts/governance/ve-naming.md
 */
contract ve4626Utility is Ownable, ReentrancyGuard {
    Ive4626 public immutable ve4626;
    ve4626UtilityToken public immutable ve33;
    ve4626UtilityToken public immutable veLottery;

    mapping(address => uint256) public userClaimedVe33;
    mapping(address => uint256) public userClaimedVeLottery;

    /// @notice When true, `claimAllOutstanding` also claims veLottery (default false).
    bool public autoClaimVeLottery;

    event ClaimedVe33(address indexed user, uint256 amount);
    event ClaimedVeLottery(address indexed user, uint256 amount);
    event ForfeitedVe33(address indexed user, uint256 amount);
    event ForfeitedVeLottery(address indexed user, uint256 amount);
    event Synced(address indexed user, uint256 burnedVe33, uint256 burnedVeLottery, uint256 capacity);
    event AutoClaimVeLotteryUpdated(bool enabled);

    error ZeroAddress();
    error InsufficientCapacity();
    error InsufficientClaimed();
    error ZeroAmount();

    constructor(address ve4626_, address owner_) Ownable(owner_) {
        if (ve4626_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        ve4626 = Ive4626(ve4626_);

        // Deploy under this contract so setMinter works, then hand ownership to protocol owner.
        ve33 = new ve4626UtilityToken("ve\u25A04626 33", "ve33", address(this));
        veLottery = new ve4626UtilityToken("ve\u25A04626 Lottery", "veLottery", address(this));
        ve33.setMinter(address(this));
        veLottery.setMinter(address(this));
        ve33.transferOwnership(owner_);
        veLottery.transferOwnership(owner_);
    }

    function setAutoClaimVeLottery(bool enabled) external onlyOwner {
        autoClaimVeLottery = enabled;
        emit AutoClaimVeLotteryUpdated(enabled);
    }

    // -------------------------------------------------------------------------
    // Capacity (live ve■4626 power)
    // -------------------------------------------------------------------------

    function capacityOf(address user) public view returns (uint256) {
        return ve4626.getVotingPower(user);
    }

    /// @notice Free capacity using **effective** (post-decay) utility amounts.
    function freeCapacityOf(address user) public view returns (uint256) {
        uint256 cap = capacityOf(user);
        (uint256 v, uint256 c) = previewUtilities(user);
        uint256 used = v + c;
        return cap > used ? cap - used : 0;
    }

    /**
     * @notice ve33/veLottery balances as if `sync` had just run (view; no state change).
     * @dev Consumers MUST use these (or call `sync` then `ve33Of`/`veLotteryOf`) so dual-decay
     *      cannot leave inflated utilities after ve power shrinks.
     *      Haircut order matches sync: **veLottery first**, then ve33.
     */
    function previewUtilities(address user) public view returns (uint256 ve33Amt, uint256 veLotteryAmt) {
        uint256 cap = capacityOf(user);
        uint256 claimedV = userClaimedVe33[user];
        uint256 claimedC = userClaimedVeLottery[user];
        uint256 used = claimedV + claimedC;
        if (used <= cap) {
            return (claimedV, claimedC);
        }

        uint256 excess = used - cap;
        veLotteryAmt = claimedC;
        ve33Amt = claimedV;

        if (excess > 0 && veLotteryAmt > 0) {
            uint256 burnC = excess > veLotteryAmt ? veLotteryAmt : excess;
            veLotteryAmt -= burnC;
            excess -= burnC;
        }
        if (excess > 0 && ve33Amt > 0) {
            uint256 burnV = excess > ve33Amt ? ve33Amt : excess;
            ve33Amt -= burnV;
        }
    }

    /// @notice Effective ve33 after dual-decay haircut (safe for gauge weight reads).
    function effectiveVe33Of(address user) external view returns (uint256) {
        (uint256 v,) = previewUtilities(user);
        return v;
    }

    /// @notice Effective veLottery after dual-decay haircut (safe for boost share reads).
    function effectiveVeLotteryOf(address user) external view returns (uint256) {
        (, uint256 c) = previewUtilities(user);
        return c;
    }

    /**
     * @notice Burn utilities that exceed live ve■4626 capacity after dual-decay.
     * @dev Permissionless. Order: burn **veLottery** first (opt-in luxury), then **ve33**.
     *      Also call this from gauge `vote()` so storage balances stay honest.
     */
    function sync(address user) public nonReentrant returns (uint256 burnedVe33, uint256 burnedVeLottery) {
        (burnedVe33, burnedVeLottery) = _sync(user);
    }

    function _sync(address user) internal returns (uint256 burnedVe33, uint256 burnedVeLottery) {
        uint256 cap = capacityOf(user);
        uint256 claimedV = userClaimedVe33[user];
        uint256 claimedC = userClaimedVeLottery[user];
        (uint256 keepV, uint256 keepC) = previewUtilities(user);

        if (keepV == claimedV && keepC == claimedC) {
            return (0, 0);
        }

        burnedVeLottery = claimedC - keepC;
        burnedVe33 = claimedV - keepV;

        if (burnedVeLottery > 0) {
            userClaimedVeLottery[user] = keepC;
            veLottery.burn(user, burnedVeLottery);
        }
        if (burnedVe33 > 0) {
            userClaimedVe33[user] = keepV;
            ve33.burn(user, burnedVe33);
        }

        emit Synced(user, burnedVe33, burnedVeLottery, cap);
    }

    // -------------------------------------------------------------------------
    // Claim / forfeit
    // -------------------------------------------------------------------------

    function claimVe33(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _sync(msg.sender);
        uint256 free = freeCapacityOf(msg.sender);
        if (amount > free) revert InsufficientCapacity();
        userClaimedVe33[msg.sender] += amount;
        ve33.mint(msg.sender, amount);
        emit ClaimedVe33(msg.sender, amount);
    }

    function claimVeLottery(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _sync(msg.sender);
        uint256 free = freeCapacityOf(msg.sender);
        if (amount > free) revert InsufficientCapacity();
        userClaimedVeLottery[msg.sender] += amount;
        veLottery.mint(msg.sender, amount);
        emit ClaimedVeLottery(msg.sender, amount);
    }

    /// @notice Claim free capacity as ve33 (and veLottery if `autoClaimVeLottery`).
    function claimAllOutstanding() external nonReentrant {
        _sync(msg.sender);
        uint256 free = freeCapacityOf(msg.sender);
        if (free == 0) return;

        if (autoClaimVeLottery) {
            uint256 half = free / 2;
            uint256 ve33Amt = free - half;
            if (ve33Amt > 0) {
                userClaimedVe33[msg.sender] += ve33Amt;
                ve33.mint(msg.sender, ve33Amt);
                emit ClaimedVe33(msg.sender, ve33Amt);
            }
            if (half > 0) {
                userClaimedVeLottery[msg.sender] += half;
                veLottery.mint(msg.sender, half);
                emit ClaimedVeLottery(msg.sender, half);
            }
        } else {
            userClaimedVe33[msg.sender] += free;
            ve33.mint(msg.sender, free);
            emit ClaimedVe33(msg.sender, free);
        }
    }

    function forfeitVe33(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _sync(msg.sender);
        if (userClaimedVe33[msg.sender] < amount) revert InsufficientClaimed();
        userClaimedVe33[msg.sender] -= amount;
        ve33.burn(msg.sender, amount);
        emit ForfeitedVe33(msg.sender, amount);
    }

    function forfeitVeLottery(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _sync(msg.sender);
        if (userClaimedVeLottery[msg.sender] < amount) revert InsufficientClaimed();
        userClaimedVeLottery[msg.sender] -= amount;
        veLottery.burn(msg.sender, amount);
        emit ForfeitedVeLottery(msg.sender, amount);
    }

    function forfeitAll() external nonReentrant {
        _sync(msg.sender);
        uint256 v = userClaimedVe33[msg.sender];
        uint256 c = userClaimedVeLottery[msg.sender];
        if (v > 0) {
            userClaimedVe33[msg.sender] = 0;
            ve33.burn(msg.sender, v);
            emit ForfeitedVe33(msg.sender, v);
        }
        if (c > 0) {
            userClaimedVeLottery[msg.sender] = 0;
            veLottery.burn(msg.sender, c);
            emit ForfeitedVeLottery(msg.sender, c);
        }
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @notice Raw token balance (may be stale until `sync`). Prefer `effectiveVe33Of` for weight.
    function ve33Of(address user) external view returns (uint256) {
        return ve33.balanceOf(user);
    }

    /// @notice Raw token balance (may be stale until `sync`). Prefer `effectiveVeLotteryOf` for boost.
    function veLotteryOf(address user) external view returns (uint256) {
        return veLottery.balanceOf(user);
    }

    function totalVe33() external view returns (uint256) {
        return ve33.totalSupply();
    }

    function totalVeLottery() external view returns (uint256) {
        return veLottery.totalSupply();
    }
}
