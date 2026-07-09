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
 * @notice Claim vote / chance utilities from live ve■4626 power.
 * @dev Product lock: **ve■4626** (`ve4626`). This module: **ve4626Utility** (no ■ in the id).
 *
 *      capacity = dual-decay ve■4626 power (shrinks over time)
 *      free     = capacity - claimedVote - claimedChance  (after sync)
 *
 *      vote   (veVote)   → ve4626GaugeVoting
 *      chance (veChance) → ve4626BoostManager (lottery mult, opt-in)
 *
 * Default claim-all: vote only.
 *
 * When ve power decays below outstanding utilities, call `sync(user)` (or any claim/forfeit)
 * which burns excess: **chance first**, then vote.
 *
 * Naming: docs/contracts/governance/ve-naming.md
 */
contract ve4626Utility is Ownable, ReentrancyGuard {
    Ive4626 public immutable ve4626;
    ve4626UtilityToken public immutable vote;
    ve4626UtilityToken public immutable chance;

    mapping(address => uint256) public userClaimedVote;
    mapping(address => uint256) public userClaimedChance;

    /// @notice When true, `claimAllOutstanding` also claims chance (default false).
    bool public autoClaimChance;

    event ClaimedVote(address indexed user, uint256 amount);
    event ClaimedChance(address indexed user, uint256 amount);
    event ForfeitedVote(address indexed user, uint256 amount);
    event ForfeitedChance(address indexed user, uint256 amount);
    event Synced(address indexed user, uint256 burnedVote, uint256 burnedChance, uint256 capacity);
    event AutoClaimChanceUpdated(bool enabled);

    error ZeroAddress();
    error InsufficientCapacity();
    error InsufficientClaimed();
    error ZeroAmount();

    constructor(address ve4626_, address owner_) Ownable(owner_) {
        if (ve4626_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        ve4626 = Ive4626(ve4626_);

        // Deploy under this contract so setMinter works, then hand ownership to protocol owner.
        vote = new ve4626UtilityToken("ve\u25A04626 Vote", "veVote", address(this));
        chance = new ve4626UtilityToken("ve\u25A04626 Chance", "veChance", address(this));
        vote.setMinter(address(this));
        chance.setMinter(address(this));
        vote.transferOwnership(owner_);
        chance.transferOwnership(owner_);
    }

    function setAutoClaimChance(bool enabled) external onlyOwner {
        autoClaimChance = enabled;
        emit AutoClaimChanceUpdated(enabled);
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
     * @notice Vote/chance balances as if `sync` had just run (view; no state change).
     * @dev Consumers MUST use these (or call `sync` then `voteOf`/`chanceOf`) so dual-decay
     *      cannot leave inflated utilities after ve power shrinks.
     *      Haircut order matches sync: **chance first**, then vote.
     */
    function previewUtilities(address user) public view returns (uint256 voteAmt, uint256 chanceAmt) {
        uint256 cap = capacityOf(user);
        uint256 claimedV = userClaimedVote[user];
        uint256 claimedC = userClaimedChance[user];
        uint256 used = claimedV + claimedC;
        if (used <= cap) {
            return (claimedV, claimedC);
        }

        uint256 excess = used - cap;
        chanceAmt = claimedC;
        voteAmt = claimedV;

        if (excess > 0 && chanceAmt > 0) {
            uint256 burnC = excess > chanceAmt ? chanceAmt : excess;
            chanceAmt -= burnC;
            excess -= burnC;
        }
        if (excess > 0 && voteAmt > 0) {
            uint256 burnV = excess > voteAmt ? voteAmt : excess;
            voteAmt -= burnV;
        }
    }

    /// @notice Effective veVote after dual-decay haircut (safe for gauge weight reads).
    function effectiveVoteOf(address user) external view returns (uint256) {
        (uint256 v,) = previewUtilities(user);
        return v;
    }

    /// @notice Effective veChance after dual-decay haircut (safe for boost share reads).
    function effectiveChanceOf(address user) external view returns (uint256) {
        (, uint256 c) = previewUtilities(user);
        return c;
    }

    /**
     * @notice Burn utilities that exceed live ve■4626 capacity after dual-decay.
     * @dev Permissionless. Order: burn **chance** first (opt-in luxury), then **vote**.
     *      Also call this from gauge `vote()` so storage balances stay honest.
     */
    function sync(address user) public nonReentrant returns (uint256 burnedVote, uint256 burnedChance) {
        (burnedVote, burnedChance) = _sync(user);
    }

    function _sync(address user) internal returns (uint256 burnedVote, uint256 burnedChance) {
        uint256 cap = capacityOf(user);
        uint256 claimedV = userClaimedVote[user];
        uint256 claimedC = userClaimedChance[user];
        (uint256 keepV, uint256 keepC) = previewUtilities(user);

        if (keepV == claimedV && keepC == claimedC) {
            return (0, 0);
        }

        burnedChance = claimedC - keepC;
        burnedVote = claimedV - keepV;

        if (burnedChance > 0) {
            userClaimedChance[user] = keepC;
            chance.burn(user, burnedChance);
        }
        if (burnedVote > 0) {
            userClaimedVote[user] = keepV;
            vote.burn(user, burnedVote);
        }

        emit Synced(user, burnedVote, burnedChance, cap);
    }

    // -------------------------------------------------------------------------
    // Claim / forfeit
    // -------------------------------------------------------------------------

    function claimVote(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _sync(msg.sender);
        uint256 free = freeCapacityOf(msg.sender);
        if (amount > free) revert InsufficientCapacity();
        userClaimedVote[msg.sender] += amount;
        vote.mint(msg.sender, amount);
        emit ClaimedVote(msg.sender, amount);
    }

    function claimChance(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _sync(msg.sender);
        uint256 free = freeCapacityOf(msg.sender);
        if (amount > free) revert InsufficientCapacity();
        userClaimedChance[msg.sender] += amount;
        chance.mint(msg.sender, amount);
        emit ClaimedChance(msg.sender, amount);
    }

    /// @notice Claim free capacity as vote (and chance if `autoClaimChance`).
    function claimAllOutstanding() external nonReentrant {
        _sync(msg.sender);
        uint256 free = freeCapacityOf(msg.sender);
        if (free == 0) return;

        if (autoClaimChance) {
            uint256 half = free / 2;
            uint256 voteAmt = free - half;
            if (voteAmt > 0) {
                userClaimedVote[msg.sender] += voteAmt;
                vote.mint(msg.sender, voteAmt);
                emit ClaimedVote(msg.sender, voteAmt);
            }
            if (half > 0) {
                userClaimedChance[msg.sender] += half;
                chance.mint(msg.sender, half);
                emit ClaimedChance(msg.sender, half);
            }
        } else {
            userClaimedVote[msg.sender] += free;
            vote.mint(msg.sender, free);
            emit ClaimedVote(msg.sender, free);
        }
    }

    function forfeitVote(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _sync(msg.sender);
        if (userClaimedVote[msg.sender] < amount) revert InsufficientClaimed();
        userClaimedVote[msg.sender] -= amount;
        vote.burn(msg.sender, amount);
        emit ForfeitedVote(msg.sender, amount);
    }

    function forfeitChance(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _sync(msg.sender);
        if (userClaimedChance[msg.sender] < amount) revert InsufficientClaimed();
        userClaimedChance[msg.sender] -= amount;
        chance.burn(msg.sender, amount);
        emit ForfeitedChance(msg.sender, amount);
    }

    function forfeitAll() external nonReentrant {
        _sync(msg.sender);
        uint256 v = userClaimedVote[msg.sender];
        uint256 c = userClaimedChance[msg.sender];
        if (v > 0) {
            userClaimedVote[msg.sender] = 0;
            vote.burn(msg.sender, v);
            emit ForfeitedVote(msg.sender, v);
        }
        if (c > 0) {
            userClaimedChance[msg.sender] = 0;
            chance.burn(msg.sender, c);
            emit ForfeitedChance(msg.sender, c);
        }
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @notice Raw token balance (may be stale until `sync`). Prefer `effectiveVoteOf` for weight.
    function voteOf(address user) external view returns (uint256) {
        return vote.balanceOf(user);
    }

    /// @notice Raw token balance (may be stale until `sync`). Prefer `effectiveChanceOf` for boost.
    function chanceOf(address user) external view returns (uint256) {
        return chance.balanceOf(user);
    }

    function totalVote() external view returns (uint256) {
        return vote.totalSupply();
    }

    function totalChance() external view returns (uint256) {
        return chance.totalSupply();
    }
}
