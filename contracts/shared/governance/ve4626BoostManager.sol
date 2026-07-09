// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ve4626BoostManager
 * @author 0xakita.eth
 * @notice Personal lottery boost via Curve-style split (0.4×–1.0× of position).
 * @dev Single envelope: NO separate lock-duration additive PPM.
 *
 *      Working balance (tokenless 0.4 + ve remainder 0.6, capped at full = 1.0):
 *        working = min(0.4 * l + 0.6 * L * (ve / Ve), 1.0 * l)
 *        boost   = working / l   ∈ [0.4, 1.0]
 *
 *      Product framing: "up to 2.5× boost" means 2.5× the *tokenless* rate
 *      (0.4 × 2.5 = 1.0), not a 2.5× deposit cap (gauge-style).
 *
 *      Lottery mapping (path A — pool = creator Share supply):
 *        l  = min(creatorShareUSD, swapUSD)     // covered skin this trade
 *        L  = total creator ShareOFT supply USD // pool size
 *        ve = effective veChance (or chance/ve fallback)
 *        Ve = total veChance (or total power)
 *
 *      Call `calculateBoostForPosition` from LotteryManager (needs l, L).
 *      `calculateBoost(user)` is a UI/legacy helper only (see natspec).
 */

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
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

contract ve4626BoostManager is Ownable, ReentrancyGuard {
    uint256 public constant BOOST_PRECISION = 10_000;
    /// @notice Tokenless working factor (0.4×).
    uint256 public constant TOKENLESS_FACTOR = 4_000;
    /// @notice Ve-weighted remainder factor (0.6×). Full = tokenless + remainder = 1.0.
    uint256 public constant VE_FACTOR = 6_000;
    /// @notice Max working/l (= full position). 0.4 × 2.5 "boost" framing = 1.0.
    uint256 public constant MAX_VE_BOOST = 10_000;
    // FIX: G-20 — increase from 10 blocks (~20s) to 1 epoch (~7 days on Base L2)
    uint256 public constant MIN_HOLDING_BLOCKS = 302_400;

    Ive4626 public immutable ve4626;

    /// @notice Optional veChance token (raw balances; may be stale without sync).
    IERC20 public chanceToken;

    /// @notice Preferred: ve4626Utility for decay-safe effective chance.
    Ive4626UtilityForBoost public utility;

    /// @notice Neutral mult when position is zero / flash-gated (leave base odds unchanged).
    uint256 public baseBoost = 10_000;
    /// @notice Max working / l (1.0× = full; tokenless 0.4× × 2.5 = 1.0).
    uint256 public maxBoost = 10_000;
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
    event ChanceTokenUpdated(address indexed token);
    event UtilityUpdated(address indexed utility);

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

    function setChanceToken(address token) external onlyOwner {
        chanceToken = IERC20(token);
        emit ChanceTokenUpdated(token);
    }

    function setUtility(address utility_) external onlyOwner {
        utility = Ive4626UtilityForBoost(utility_);
        emit UtilityUpdated(utility_);
        if (utility_ != address(0)) {
            chanceToken = IERC20(Ive4626UtilityForBoost(utility_).chance());
            emit ChanceTokenUpdated(address(chanceToken));
        }
    }

    /**
     * @notice UI / legacy: max factor attainable with current ve if position is small enough.
     * @dev Lottery must use `calculateBoostForPosition` — this ignores pool matching.
     *      Any positive eligible veChance can reach `maxBoost` (1.0) when ve share ≥ LP share.
     */
    function calculateBoost(address user) public view returns (uint256) {
        if (block.number < lastBalanceUpdateBlock[user] + MIN_HOLDING_BLOCKS) {
            return baseBoost;
        }
        (uint256 ve,) = _powerShare(user);
        if (ve == 0 || ve < minVotingPower) {
            return TOKENLESS_FACTOR; // 0.4× — unboosted
        }
        return maxBoost; // 1.0× full
    }

    /**
     * @notice Working-balance boost for a concrete trade position (0.4×–1.0×).
     * @param user Trader
     * @param shareBalanceUSD Pre-buy creator Share USD (coverage balance valued)
     * @param swapAmountUSD Trade notional USD
     * @param totalShareUSD Full creator ShareOFT supply in USD (pool size L)
     * @return boostMultiplier BPS in [TOKENLESS_FACTOR, maxBoost] when l>0;
     *         `baseBoost` when no covered position (personal layer inactive).
     */
    function calculateBoostForPosition(
        address user,
        uint256 shareBalanceUSD,
        uint256 swapAmountUSD,
        uint256 totalShareUSD
    ) public view returns (uint256 boostMultiplier) {
        if (block.number < lastBalanceUpdateBlock[user] + MIN_HOLDING_BLOCKS) {
            return baseBoost;
        }

        // l = covered skin this trade (Curve "balance")
        uint256 l = shareBalanceUSD < swapAmountUSD ? shareBalanceUSD : swapAmountUSD;
        if (l == 0) {
            // No position → do not alter base lottery odds
            return baseBoost;
        }

        (uint256 ve, uint256 Ve) = _powerShare(user);
        if (ve < minVotingPower) {
            ve = 0;
        }

        // working = 0.4 * l + 0.6 * L * (ve / Ve)
        // If no ve pool or zero L, only tokenless term (0.4 * l).
        uint256 working = Math.mulDiv(l, TOKENLESS_FACTOR, BOOST_PRECISION);
        if (ve > 0 && Ve > 0 && totalShareUSD > 0) {
            // 0.6 * L * ve / Ve
            uint256 vePart = Math.mulDiv(Math.mulDiv(totalShareUSD, VE_FACTOR, BOOST_PRECISION), ve, Ve);
            working += vePart;
        }

        uint256 maxWorking = Math.mulDiv(l, maxBoost, BOOST_PRECISION);
        if (working > maxWorking) {
            working = maxWorking;
        }

        // boost = working / l
        boostMultiplier = Math.mulDiv(working, BOOST_PRECISION, l);
        if (boostMultiplier > maxBoost) {
            boostMultiplier = maxBoost;
        }
        // Guard: never below tokenless when a position exists
        if (boostMultiplier < TOKENLESS_FACTOR) {
            boostMultiplier = TOKENLESS_FACTOR;
        }
    }

    /// @notice Alias used by older call sites; same as `calculateBoost`.
    function calculateBoostWithProtection(address user) public view returns (uint256) {
        return calculateBoost(user);
    }

    /**
     * @notice Deprecated lock-duration additive path — always returns 0 (single envelope).
     * @dev LotteryManager may still call this; returning 0 removes double-count of duration.
     */
    function getTotalProbabilityBoost(address) external pure returns (uint256) {
        return 0;
    }

    /**
     * @notice Coverage fraction of swap USD backed by held creator shares.
     * @dev Still useful for UI; Curve path uses l = min(share, swap) inside
     *      `calculateBoostForPosition` instead of post-hoc coverage scaling.
     */
    function getCoverageBps(
        address, /*user*/
        address, /*registry*/
        address, /*creatorCoin*/
        address, /*shareBalanceToken*/
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
        // baseBoost = neutral when no position; maxBoost = full working/l (≤ 1.0, > tokenless).
        if (_baseBoost == 0 || _maxBoost <= TOKENLESS_FACTOR || _maxBoost > MAX_VE_BOOST) {
            revert InvalidBoostParameters();
        }

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
        if (block.number < lastBalanceUpdateBlock[user] + MIN_HOLDING_BLOCKS) {
            return false;
        }
        (uint256 ve,) = _powerShare(user);
        return ve >= minVotingPower && ve > 0;
    }

    function _powerShare(address user) internal view returns (uint256 userPower, uint256 totalPower) {
        // Decay-safe: effective chance (post haircut). totalSupply may still include
        // unsynced balances elsewhere — that only *reduces* ve share (anti-whale).
        if (address(utility) != address(0)) {
            userPower = utility.effectiveChanceOf(user);
            totalPower = utility.totalChance();
            return (userPower, totalPower);
        }
        if (address(chanceToken) != address(0)) {
            userPower = chanceToken.balanceOf(user);
            totalPower = chanceToken.totalSupply();
            return (userPower, totalPower);
        }
        userPower = ve4626.getVotingPower(user);
        totalPower = ve4626.getTotalVotingPower();
    }
}

interface Ive4626UtilityForBoost {
    function effectiveChanceOf(address user) external view returns (uint256);
    function totalChance() external view returns (uint256);
    function chance() external view returns (address);
}
