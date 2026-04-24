// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IStrategy} from "../../interfaces/IStrategy.sol";
import {IStrategyValuation} from "../../interfaces/IStrategyValuation.sol";

/**
 * @title SolanaStrategy
 * @notice IStrategy + IStrategyValuation for Solana exposure under CreatorOVault accounting.
 * @dev Combines Base liquid balance with keeper-reported remote NAV; enforces freshness and delta guardrails.
 */
contract SolanaStrategy is IStrategy, IStrategyValuation, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================
    // ERRORS
    // ================================

    error OnlyVault();
    error OnlyKeeper();
    error StrategyPaused();
    error NavDeltaExceedsCap();
    error InvalidVault();
    error InvalidAsset();
    error InvalidKeeper();
    error RebalanceWouldBreachBuffer();
    error InvalidBridgeAddress();
    error InsufficientBaseLiquidity();
    // FIX: H-05 (4626-437) — reportId replay guard
    error InvalidReportId();
    error ReportIdAlreadyUsed();

    // ================================
    // EVENTS
    // ================================

    event RemoteNavUpdated(uint256 newRemoteNav, bytes32 reportId);
    // FIX: C-01 — emitted when the hourly anchor rolls forward
    event NavWindowRolled(uint256 newAnchor, uint64 newWindowStart);
    event RebalanceToSolana(uint256 amount, address indexed bridge);
    event RebalanceFromSolanaReconciled(uint256 amount, bytes32 reportId);
    event KeeperSet(address indexed keeper, bool status);
    event RemoteNavEnabledSet(bool enabled);
    event EmergencyPausedSet(bool paused);
    // FIX: H-05 (4626-437) — emitted when a reportId is marked consumed
    event ReportIdConsumed(bytes32 indexed reportId, bytes32 indexed context);

    // ================================
    // STATE
    // ================================

    address public immutable vault;
    IERC20 public immutable CREATOR;

    uint256 public remoteNav;
    uint256 public remoteNavAnchor;
    uint64 public remoteNavUpdatedAt;
    uint64 public maxNavAge;
    uint16 public maxNavDeltaBpsPerUpdate;
    uint16 public minBaseLiquidityBps;
    address public bridgeAddress;
    uint256 public totalReconciledFromSolana;

    // FIX: C-01 — per-hour NAV cool-down anchor.
    // Previously the bps delta cap was applied against the running remoteNav,
    // so a compromised/misbehaving keeper could chain many within-cap updates
    // inside a single block and drift NAV arbitrarily (bypassing the delta
    // cap by making the cap compound against itself). We now freeze a
    // "window anchor" for a full 1-hour cool-down window; every NAV update
    // inside a window must stay within maxNavDeltaBpsPerUpdate of *that*
    // frozen anchor. The anchor only rolls forward once an hour has elapsed.
    uint64 public constant NAV_WINDOW_DURATION = 1 hours;
    uint256 public navWindowAnchor;
    uint64 public navWindowStart;

    bool public remoteNavEnabled;
    bool private _emergencyPaused;

    mapping(address => bool) public keepers;

    // FIX: H-05 (4626-437) — prevents replay of keeper reports. Every
    // `updateRemoteNav` / `reconcileFromSolana` call is identified by a
    // non-zero `reportId` derived offchain from (srcChain, slot, nonce).
    // Once consumed, the same reportId can never be replayed. Without this
    // guard a compromised relayer or re-org could re-submit an old report,
    // ratcheting `remoteNav` or `totalReconciledFromSolana` arbitrarily.
    mapping(bytes32 => bool) public usedReportIds;

    // ================================
    // MODIFIERS
    // ================================

    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    modifier onlyKeeper() {
        if (!keepers[msg.sender]) revert OnlyKeeper();
        _;
    }

    modifier whenActive() {
        if (!_isActive()) revert StrategyPaused();
        _;
    }

    // ================================
    // CONSTRUCTOR
    // ================================

    constructor(
        address _vault,
        address _asset,
        address _owner,
        address _keeper,
        uint64 _maxNavAge,
        uint16 _maxNavDeltaBpsPerUpdate,
        uint16 _minBaseLiquidityBps,
        address _bridgeAddress
    ) Ownable(_owner) {
        if (_vault == address(0)) revert InvalidVault();
        if (_asset == address(0)) revert InvalidAsset();

        vault = _vault;
        CREATOR = IERC20(_asset);
        maxNavAge = _maxNavAge;
        maxNavDeltaBpsPerUpdate = _maxNavDeltaBpsPerUpdate;
        minBaseLiquidityBps = _minBaseLiquidityBps;
        bridgeAddress = _bridgeAddress;
        remoteNavEnabled = true;

        if (_keeper != address(0)) keepers[_keeper] = true;
    }

    // ================================
    // KEEPER NAV UPDATE
    // ================================

    /**
     * @notice Update keeper-reported remote NAV with delta cap enforcement.
     * @param newRemoteNav New NAV value (creator token units).
     * @param reportId Report identifier for offchain correlation.
     */
    function updateRemoteNav(uint256 newRemoteNav, bytes32 reportId) external onlyKeeper {
        // FIX: H-05 (4626-437) — consume reportId before any effects to
        // prevent replay. Non-zero reportId required so off-chain correlation
        // and on-chain replay-protection both resolve to the same identifier.
        if (reportId == bytes32(0)) revert InvalidReportId();
        if (usedReportIds[reportId]) revert ReportIdAlreadyUsed();
        usedReportIds[reportId] = true;
        emit ReportIdConsumed(reportId, bytes32("updateRemoteNav"));

        // FIX: C-01 — roll the hourly anchor forward if the current window has
        // expired. Within a window, all deltas are measured against the frozen
        // anchor, not the running remoteNav, so the cap cannot be compounded.
        if (navWindowStart == 0 || block.timestamp >= navWindowStart + NAV_WINDOW_DURATION) {
            navWindowAnchor = remoteNav > 0 ? remoteNav : remoteNavAnchor;
            navWindowStart = uint64(block.timestamp);
            emit NavWindowRolled(navWindowAnchor, navWindowStart);
        }

        uint256 referenceNav = navWindowAnchor > 0 ? navWindowAnchor : (remoteNav > 0 ? remoteNav : remoteNavAnchor);

        // On first NAV update, enforce a bounded bootstrap relative to base liquidity.
        // This prevents unbounded first writes while still allowing remote NAV initialization.
        if (referenceNav == 0 && newRemoteNav > 0) {
            uint256 baseLiquid = CREATOR.balanceOf(address(this));
            if (minBaseLiquidityBps == 0) revert NavDeltaExceedsCap();
            uint256 maxBootstrapRemoteNav = (baseLiquid * (10_000 - minBaseLiquidityBps)) / minBaseLiquidityBps;
            if (newRemoteNav > maxBootstrapRemoteNav) revert NavDeltaExceedsCap();
            // On bootstrap, seed the anchor too so subsequent in-window updates
            // are bounded relative to this first value.
            navWindowAnchor = newRemoteNav;
        } else if (referenceNav > 0) {
            // FIX: C-01 — cap measured against the frozen hourly anchor, not
            // the running remoteNav. This bounds *cumulative* drift per hour
            // to maxNavDeltaBpsPerUpdate regardless of how many updates the
            // keeper submits inside the window.
            uint256 delta = newRemoteNav > referenceNav ? newRemoteNav - referenceNav : referenceNav - newRemoteNav;
            uint256 deltaBps = (delta * 10_000) / referenceNav;
            if (deltaBps > maxNavDeltaBpsPerUpdate) revert NavDeltaExceedsCap();
        }

        remoteNav = newRemoteNav;
        if (newRemoteNav > 0) {
            remoteNavAnchor = newRemoteNav;
        } else {
            // FIX: M-09 (4626-318) — a deliberate zero-reset (bridge failure,
            // governance kill switch, etc.) previously left `remoteNavAnchor`
            // at its last non-zero value. Subsequent updates then computed
            // their delta against that stale anchor, effectively widening the
            // allowed delta cap on the next update. Zeroing the anchor and
            // window on reset forces the next non-zero update to go through
            // the bootstrap branch, which bounds against base liquidity.
            remoteNavAnchor = 0;
            navWindowAnchor = 0;
            navWindowStart = 0;
        }
        remoteNavUpdatedAt = uint64(block.timestamp);
        emit RemoteNavUpdated(newRemoteNav, reportId);
    }

    // ================================
    // KEEPER REBALANCE FLOWS
    // ================================

    /**
     * @notice Rebalance tokens from Base to Solana (keeper-only).
     * @dev Transfers tokens to bridge address. Cannot breach minBaseLiquidityBps buffer.
     * @param amount Amount of creator tokens to rebalance out.
     */
    function rebalanceToSolana(uint256 amount) external onlyKeeper whenActive nonReentrant {
        if (bridgeAddress == address(0)) revert InvalidBridgeAddress();
        if (amount == 0) return;

        uint256 balance = CREATOR.balanceOf(address(this));
        if (amount > balance) revert InsufficientBaseLiquidity();

        uint256 total = getTotalAssets();
        uint256 minBase = (total * minBaseLiquidityBps) / 10_000;
        uint256 remaining = balance - amount;
        if (remaining < minBase) revert RebalanceWouldBreachBuffer();

        CREATOR.safeTransfer(bridgeAddress, amount);
        emit RebalanceToSolana(amount, bridgeAddress);
    }

    /**
     * @notice Mark reconciliation of tokens received from Solana (keeper-only).
     * @dev Updates flow-tracking state. Call after bridge has deposited tokens to this contract.
     * @param amount Amount of creator tokens received.
     * @param reportId Report identifier for offchain correlation.
     */
    function reconcileFromSolana(uint256 amount, bytes32 reportId) external onlyKeeper {
        if (amount == 0) return;
        // FIX: H-05 (4626-437) — consume reportId before any effects to
        // prevent replay of bridge-receipt reports. A successful bridge
        // receipt must carry a unique reportId; re-submitting the same
        // reportId would otherwise inflate `totalReconciledFromSolana`.
        if (reportId == bytes32(0)) revert InvalidReportId();
        if (usedReportIds[reportId]) revert ReportIdAlreadyUsed();
        usedReportIds[reportId] = true;
        emit ReportIdConsumed(reportId, bytes32("reconcileFromSolana"));

        totalReconciledFromSolana += amount;
        emit RebalanceFromSolanaReconciled(amount, reportId);
    }

    // ================================
    // IStrategy
    // ================================

    function asset() external view override returns (address) {
        return address(CREATOR);
    }

    function getTotalAssets() public view override returns (uint256) {
        uint256 baseLiquid = CREATOR.balanceOf(address(this));
        if (remoteNavEnabled && _isValuationReady()) {
            return baseLiquid + remoteNav;
        }
        return baseLiquid;
    }

    function isActive() external view override returns (bool) {
        return _isActive();
    }

    function deposit(uint256 amount) external override onlyVault whenActive nonReentrant returns (uint256 deposited) {
        if (amount == 0) return 0;
        CREATOR.safeTransferFrom(vault, address(this), amount);
        deposited = amount;
        emit StrategyDeposit(vault, amount, deposited);
    }

    function withdraw(uint256 amount) external override onlyVault nonReentrant returns (uint256 withdrawn) {
        if (amount == 0) return 0;
        uint256 balance = CREATOR.balanceOf(address(this));
        withdrawn = amount > balance ? balance : amount;
        if (withdrawn > 0) {
            CREATOR.safeTransfer(vault, withdrawn);
        }
        emit StrategyWithdraw(vault, amount, withdrawn);
    }

    function emergencyWithdraw() external override onlyVault nonReentrant returns (uint256 withdrawn) {
        withdrawn = CREATOR.balanceOf(address(this));
        if (withdrawn > 0) {
            CREATOR.safeTransfer(vault, withdrawn);
        }
        emit EmergencyWithdraw(vault, withdrawn);
    }

    function harvest() external view override onlyVault returns (uint256 profit) {
        return 0;
    }

    function rebalance() external override onlyVault {}

    // ================================
    // IStrategyValuation
    // ================================

    function isValuationReady() external view override returns (bool) {
        return _isValuationReady();
    }

    function _isValuationReady() internal view returns (bool) {
        if (_emergencyPaused) return false;
        if (!remoteNavEnabled) return true;
        if (remoteNavUpdatedAt == 0) return false;
        return block.timestamp - remoteNavUpdatedAt <= maxNavAge;
    }

    function _isActive() internal view returns (bool) {
        return !_emergencyPaused;
    }

    // ================================
    // ADMIN
    // ================================

    function setKeeper(address keeper, bool status) external onlyOwner {
        if (keeper == address(0) && status) revert InvalidKeeper();
        keepers[keeper] = status;
        emit KeeperSet(keeper, status);
    }

    function setRemoteNavEnabled(bool enabled) external onlyOwner {
        remoteNavEnabled = enabled;
        emit RemoteNavEnabledSet(enabled);
    }

    function setEmergencyPaused(bool paused) external onlyOwner {
        _emergencyPaused = paused;
        emit EmergencyPausedSet(paused);
    }

    function emergencyPaused() external view returns (bool) {
        return _emergencyPaused;
    }
}
