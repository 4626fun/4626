// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ve4626BoostManager
 * @author 0xakita.eth
 * @notice Calculates personal ve4626 lottery boost (global 2.5x max, coverage-scaled by held creator shares only)
 * @dev ONE LOCK ONLY: users lock into ve4626 once. No per-creator lock or "veAKITA" required.
 *      - Global multiplier from total ve4626 share
 *      - Coverage = only the creator shares the user actually holds (passed from swap)
 *      - Matches "full 2.5x only up to their value" requirement
 */

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

interface Ive4626 {
    struct Lock {
        uint256 amount;
        uint256 end;
        uint256 start;
        address lockedToken;
        uint256 underlyingValue;
    }
    function getVotingPower(address user) external view returns (uint256);
    function getTotalVotingPower() external view returns (uint256);
    function hasActiveLock(address user) external view returns (bool);
    function getRemainingLockTime(address user) external view returns (uint256);
    function getLock(address user) external view returns (Lock memory);
}

interface ICreatorRegistryCoverage {
    function getShareOFTForToken(address token) external view returns (address);
    function getTokenForShareOFT(address shareOFT) external view returns (address);
    function getOracleForToken(address token) external view returns (address);
    function isCreatorCoinActive(address token) external view returns (bool);
}

interface ICreatorOracleCoverage {
    function getCreatorPrice() external view returns (int256 price, uint256 timestamp);
}

contract ve4626BoostManager is Ownable, ReentrancyGuard {
    uint256 public constant BOOST_PRECISION = 10_000;
    uint256 public constant MAX_VE_BOOST = 25_000;
    // FIX: G-20 — increase from 10 blocks (~20s) to 1 epoch (~7 days on Base L2)
    uint256 public constant MIN_HOLDING_BLOCKS = 302_400;

    Ive4626 public immutable ve4626;

    uint256 public baseBoost = 10_000; // 1.0x
    uint256 public maxBoost = 25_000; // 2.5x
    uint256 public minVotingPower = 0.1 ether;
    bool public boostParametersLocked;

    // FIX: G-13 — timelock for boost parameter updates instead of permanent lock
    uint256 public constant BOOST_TIMELOCK_DURATION = 48 hours;
    uint256 public pendingBaseBoost;
    uint256 public pendingMaxBoost;
    uint256 public boostTimelockExpiry;

    // Flash-loan protection
    mapping(address => uint256) public lastBalanceUpdateBlock;

    event BoostCalculated(address indexed user, uint256 boostMultiplier);
    event BoostParametersUpdated(uint256 baseBoost, uint256 maxBoost);
    event MinVotingPowerUpdated(uint256 minPower);
    event BalanceTrackingUpdated(address indexed user, uint256 blockNumber);

    error ZeroAddress();
    error InvalidBoostParameters();
    error BoostParametersAreLocked();
    // FIX: G-13 — timelock errors
    error TimelockNotExpired();
    error NoPendingBoostUpdate();

    constructor(address _ve4626, address _owner) Ownable(_owner) {
        if (_ve4626 == address(0)) revert ZeroAddress();
        ve4626 = Ive4626(_ve4626);
    }

    function calculateBoost(address user) public view returns (uint256) {
        return calculateBoostWithProtection(user);
    }

    function calculateBoostWithProtection(address user) public view returns (uint256 boostMultiplier) {
        if (block.number < lastBalanceUpdateBlock[user] + MIN_HOLDING_BLOCKS) {
            return baseBoost;
        }

        uint256 userPower = ve4626.getVotingPower(user);
        uint256 totalPower = ve4626.getTotalVotingPower();

        if (userPower == 0 || totalPower == 0 || userPower < minVotingPower) {
            return baseBoost;
        }

        uint256 scaledShare = Math.mulDiv(userPower, BOOST_PRECISION, totalPower);
        if (scaledShare > BOOST_PRECISION) scaledShare = BOOST_PRECISION;

        uint256 boostRange = maxBoost - baseBoost;
        boostMultiplier = baseBoost + Math.mulDiv(boostRange, scaledShare, BOOST_PRECISION);
        if (boostMultiplier > maxBoost) boostMultiplier = maxBoost;

        return boostMultiplier;
    }

    function getTotalProbabilityBoost(address user) external view returns (uint256 totalBoostBps) {
        if (!ve4626.hasActiveLock(user)) return 0;

        uint256 remainingTime = ve4626.getRemainingLockTime(user);
        uint256 maxLockTime = 4 * 365 days;
        uint256 maxProbBoost = 690; // becomes 69_000 PPM in lottery

        totalBoostBps = Math.mulDiv(maxProbBoost, remainingTime, maxLockTime);
    }

    /**
     * @notice Coverage is now purely based on held creator shares in USD
     * @dev No ve lock matching, no per-creator lock required - one ve4626 lock only
     */
    function getCoverageBps(
        address /*user*/,
        address /*registry*/,
        address /*creatorCoin*/,
        address /*shareBalanceToken*/,
        uint256 creatorShareBalanceUSD,
        uint256 swapAmountUSD
    ) external pure returns (uint256 coverageBps) {
        if (swapAmountUSD == 0 || creatorShareBalanceUSD == 0) return 0;

        uint256 coveredUsd = Math.min(creatorShareBalanceUSD, swapAmountUSD);
        coverageBps = Math.mulDiv(coveredUsd, BOOST_PRECISION, swapAmountUSD);
        if (coverageBps > BOOST_PRECISION) coverageBps = BOOST_PRECISION;
    }

    function updateBalanceTracking(address user) external {
        require(msg.sender == address(ve4626), "Only ve4626");
        lastBalanceUpdateBlock[user] = block.number;
        emit BalanceTrackingUpdated(user, block.number);
    }

    // FIX: G-13 — replace permanent lock with 48h timelock for boost parameter updates
    function setBoostParameters(uint256 _baseBoost, uint256 _maxBoost) external onlyOwner {
        if (_baseBoost == 0 || _maxBoost <= _baseBoost || _maxBoost > MAX_VE_BOOST) revert InvalidBoostParameters();

        pendingBaseBoost = _baseBoost;
        pendingMaxBoost = _maxBoost;
        boostTimelockExpiry = block.timestamp + BOOST_TIMELOCK_DURATION;
    }

    // FIX: G-13 — execute pending boost update after timelock expires
    function executeBoostParameterUpdate() external onlyOwner {
        if (boostTimelockExpiry == 0) revert NoPendingBoostUpdate();
        if (block.timestamp < boostTimelockExpiry) revert TimelockNotExpired();

        baseBoost = pendingBaseBoost;
        maxBoost = pendingMaxBoost;
        boostTimelockExpiry = 0;
        emit BoostParametersUpdated(pendingBaseBoost, pendingMaxBoost);
    }

    function setMinVotingPower(uint256 _minPower) external onlyOwner {
        minVotingPower = _minPower;
        emit MinVotingPowerUpdated(_minPower);
    }

    function hasBoost(address user) external view returns (bool) {
        return calculateBoost(user) > baseBoost;
    }
}

