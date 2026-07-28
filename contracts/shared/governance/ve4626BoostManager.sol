// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ve4626BoostManager
 * @author 0xakita.eth
 * @notice Personal lottery boost via Curve-style working balance (1.0×–2.5× tokenless-normalized).
 * @dev Single envelope: NO separate lock-duration additive PPM.
 *
 *      Working balance (tokenless 0.4 + ve remainder 0.6, capped at full position):
 *        working = min(0.4 * l + 0.6 * L * (ve / Ve), 1.0 * l)
 *        boost   = working / (0.4 * l) ∈ [1.0, 2.5]
 *
 *      Curve caps working balance at the full position (`l`). The advertised
 *      2.5× is the full position divided by the 0.4× tokenless baseline.
 *
 *      Lottery mapping (path A — pool = creator Share supply):
 *        l  = min(creatorShareUSD, swapUSD)     // covered skin this trade
 *        L  = total creator ShareOFT supply USD // pool size
 *        ve = effective veLottery from ve4626Utility
 *        Ve = live total ve4626 power
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
    /// @notice Ve-weighted remainder factor (0.6×). Full working balance = 1.0× position.
    uint256 public constant VE_FACTOR = 6_000;
    /// @notice Maximum boost relative to the 0.4× tokenless baseline.
    uint256 public constant MAX_VE_BOOST = 25_000;
    // FIX: G-20 — increase from 10 blocks (~20s) to 1 epoch (~7 days on Base L2)
    uint256 public constant MIN_HOLDING_BLOCKS = 302_400;

    Ive4626 public immutable ve4626;

    /// @notice Optional veLottery token (raw balances; may be stale without sync).
    IERC20 public veLotteryToken;

    /// @notice Preferred: ve4626Utility for decay-safe effective veLottery.
    Ive4626UtilityForBoost public utility;

    /// @notice ODA-433-F4: queued utility rewiring (48h, first set instant).
    Ive4626UtilityForBoost public pendingUtility;
    uint256 public utilityTimelockExpiry;
    uint256 public constant UTILITY_TIMELOCK_DURATION = 48 hours;

    /// @notice Neutral mult when position is zero / flash-gated (leave base odds unchanged).
    uint256 public baseBoost = 10_000;
    /// @notice Maximum tokenless-normalized multiplier (2.5× by default).
    uint256 public maxBoost = 25_000;
    uint256 public minVotingPower = 0.1 ether;
    bool public boostParametersLocked;

    // FIX: G-13 — timelock for boost parameter updates instead of permanent lock
    uint256 public constant BOOST_TIMELOCK_DURATION = 48 hours;
    uint256 public pendingBaseBoost;
    uint256 public pendingMaxBoost;
    uint256 public boostTimelockExpiry;
    /// @notice ODA-468-M2: minVotingPower changes share the 48h queue/execute pattern.
    uint256 public pendingMinVotingPower;
    uint256 public minVotingPowerTimelockExpiry;

    // Flash-loan protection
    mapping(address => uint256) public lastBalanceUpdateBlock;

    event BoostCalculated(address indexed user, uint256 boostMultiplier);
    event BoostParametersUpdated(uint256 baseBoost, uint256 maxBoost);
    event MinVotingPowerUpdated(uint256 minPower);
    event MinVotingPowerUpdateQueued(uint256 minPower, uint256 executeAfter);
    event BalanceTrackingUpdated(address indexed user, uint256 blockNumber);
    event VeLotteryTokenUpdated(address indexed token);
    event UtilityUpdated(address indexed utility);
    event UtilityUpdateQueued(address indexed utility, uint256 executeAfter);

    error ZeroAddress();
    error InvalidBoostParameters();
    error BoostParametersAreLocked();
    error UtilityNotConfigured();
    // FIX: G-13 — timelock errors
    error TimelockNotExpired();
    error NoPendingBoostUpdate();
    error NoPendingUtilityUpdate();
    error UtilityTimelockNotExpired(uint256 executeAfter);
    error NoPendingMinVotingPowerUpdate();
    error OwnershipRenounceDisabled();

    constructor(address _ve4626, address _owner) Ownable(_owner) {
        if (_ve4626 == address(0)) revert ZeroAddress();
        ve4626 = Ive4626(_ve4626);
    }

    function setveLotteryToken(address token) external onlyOwner {
        veLotteryToken = IERC20(token);
        emit VeLotteryTokenUpdated(token);
    }

    function setUtility(address utility_) external onlyOwner {
        // ODA-433-F4: first set instant; rewires match boost-parameter 48h timelock.
        if (address(utility) == address(0)) {
            _applyUtility(utility_);
            return;
        }
        pendingUtility = Ive4626UtilityForBoost(utility_);
        utilityTimelockExpiry = block.timestamp + UTILITY_TIMELOCK_DURATION;
        emit UtilityUpdateQueued(utility_, utilityTimelockExpiry);
    }

    function executeUtilityUpdate() external onlyOwner {
        if (utilityTimelockExpiry == 0) revert NoPendingUtilityUpdate();
        if (block.timestamp < utilityTimelockExpiry) revert UtilityTimelockNotExpired(utilityTimelockExpiry);
        address next = address(pendingUtility);
        pendingUtility = Ive4626UtilityForBoost(address(0));
        utilityTimelockExpiry = 0;
        _applyUtility(next);
    }

    function _applyUtility(address utility_) internal {
        utility = Ive4626UtilityForBoost(utility_);
        emit UtilityUpdated(utility_);
        if (utility_ != address(0)) {
            veLotteryToken = IERC20(Ive4626UtilityForBoost(utility_).veLottery());
            emit VeLotteryTokenUpdated(address(veLotteryToken));
        }
    }

    /**
     * @notice UI / legacy: max factor attainable with current ve if position is small enough.
     * @dev Lottery must use `calculateBoostForPosition` — this ignores pool matching.
     *      Any positive eligible veLottery can reach `maxBoost` when ve share ≥ LP share.
     */
    function calculateBoost(address user) public view returns (uint256) {
        if (!_holdingPeriodSatisfied(user)) {
            return baseBoost;
        }
        (uint256 ve,) = _powerShare(user);
        if (ve == 0 || ve < minVotingPower) {
            return baseBoost;
        }
        return maxBoost;
    }

    /**
     * @notice Tokenless-normalized Curve boost for a concrete trade position (1.0×–2.5×).
     * @param user Trader
     * @param shareBalanceUSD Pre-buy creator Share USD (coverage balance valued)
     * @param swapAmountUSD Trade notional USD
     * @param totalShareUSD Full creator ShareOFT supply in USD (pool size L)
     * @return boostMultiplier BPS in [baseBoost, maxBoost].
     */
    function calculateBoostForPosition(
        address user,
        uint256 shareBalanceUSD,
        uint256 swapAmountUSD,
        uint256 totalShareUSD
    ) public view returns (uint256 boostMultiplier) {
        if (!_holdingPeriodSatisfied(user)) {
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
        uint256 tokenlessWorking = Math.mulDiv(l, TOKENLESS_FACTOR, BOOST_PRECISION);
        if (tokenlessWorking == 0) return baseBoost;
        uint256 working = tokenlessWorking;
        if (ve > 0 && Ve > 0 && totalShareUSD > 0) {
            // 0.6 * L * ve / Ve
            uint256 vePart = Math.mulDiv(Math.mulDiv(totalShareUSD, VE_FACTOR, BOOST_PRECISION), ve, Ve);
            working += vePart;
        }

        if (working > l) {
            working = l;
        }

        // Quoted boost B = working/(0.4*l) in BPS ∈ [10_000, 25_000].
        // Floor is always BOOST_PRECISION (Curve tokenless 1.0×), never owner baseBoost,
        // so a mis-set baseBoost cannot inflate covered tokenless quotes.
        boostMultiplier = Math.mulDiv(working, BOOST_PRECISION, tokenlessWorking);
        if (boostMultiplier > maxBoost) {
            boostMultiplier = maxBoost;
        }
        if (boostMultiplier < BOOST_PRECISION) {
            boostMultiplier = BOOST_PRECISION;
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
     * @dev LotteryManager uses this same fraction to blend only the Curve uplift
     *      into full-trade odds after `calculateBoostForPosition`.
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
    /// @dev baseBoost is locked to BOOST_PRECISION (1.0×). Owner may only tune maxBoost
    ///      so covered tokenless positions never receive an owner-inflated floor.
    function setBoostParameters(uint256 _baseBoost, uint256 _maxBoost) external onlyOwner {
        if (_baseBoost != BOOST_PRECISION || _maxBoost < _baseBoost || _maxBoost > MAX_VE_BOOST) {
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

    /// @notice Queue a minVotingPower change (48h timelock, ODA-468-M2).
    function setMinVotingPower(uint256 _minPower) external onlyOwner {
        pendingMinVotingPower = _minPower;
        minVotingPowerTimelockExpiry = block.timestamp + BOOST_TIMELOCK_DURATION;
        emit MinVotingPowerUpdateQueued(_minPower, minVotingPowerTimelockExpiry);
    }

    function executeMinVotingPowerUpdate() external onlyOwner {
        if (minVotingPowerTimelockExpiry == 0) revert NoPendingMinVotingPowerUpdate();
        if (block.timestamp < minVotingPowerTimelockExpiry) revert TimelockNotExpired();
        minVotingPower = pendingMinVotingPower;
        minVotingPowerTimelockExpiry = 0;
        emit MinVotingPowerUpdated(pendingMinVotingPower);
    }

    /// @notice ODA-468-L11: owner-critical boost config — disable renounce.
    function renounceOwnership() public pure override {
        revert OwnershipRenounceDisabled();
    }

    function hasBoost(address user) external view returns (bool) {
        if (!_holdingPeriodSatisfied(user)) {
            return false;
        }
        (uint256 ve,) = _powerShare(user);
        return ve >= minVotingPower && ve > 0;
    }

    function _powerShare(address user) internal view returns (uint256 userPower, uint256 totalPower) {
        // Curve denominator is live system-wide ve power, not a utility token's
        // raw totalSupply (which can remain stale until users sync).
        if (address(utility) == address(0)) revert UtilityNotConfigured();
        userPower = utility.effectiveVeLotteryOf(user);
        totalPower = ve4626.getTotalVotingPower();
    }

    function _holdingPeriodSatisfied(address user) internal view returns (bool) {
        uint256 updatedAt = lastBalanceUpdateBlock[user];
        return updatedAt != 0 && block.number >= updatedAt + MIN_HOLDING_BLOCKS;
    }
}

interface Ive4626UtilityForBoost {
    function effectiveVeLotteryOf(address user) external view returns (uint256);
    function veLottery() external view returns (address);
}
