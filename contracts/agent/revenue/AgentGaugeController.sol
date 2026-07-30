// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IOracle4626} from "@4626/shared/interfaces/oracles/IOracle4626.sol";

interface IAgentOVault {
    function burnSharesForPriceIncrease(uint256 shares) external;
    function pricePerShare() external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function totalAssets() external view returns (uint256);
    function asset() external view returns (address);
    /// @dev ODA-508-5 — the vault's registered gauge, checked at wire time and before burns.
    function gaugeController() external view returns (address);
}

interface IAgentOVaultWrapper {
    function wrap(uint256 amount) external returns (uint256);
    function unwrap(uint256 amount) external returns (uint256);
    function vaultShares() external view returns (address);
    function previewWrap(uint256 amount, address user) external view returns (uint256);
}

interface IWETH {
    function deposit() external payable;
}

interface Ive4626VoterRewardsDistributor {
    function notifyRewards(address vault, address token, uint256 amount) external;
}

/**
 * @title AgentGaugeController
 * @author 0xakita.eth
 * @notice Per-agent `tradeFeeCollector` for the agent lane — receives ShareOFT buy fees, unwraps, and splits value.
 * @dev Hub-only (Base). Uses agent lane ShareOFT (◆). Split:
 *      - 69% ◆ → jackpot reserve
 *      - 21.39% ◆ → ve4626VoterRewardsDistributor
 *      - 9.61% ◇ burned (PPS)
 *      - 0% treasury (default)
 *      V4 sell-tax WETH is buyback'd to ◆ via keeper-quoted `processWETHFeesWithRoute` (no buyFeeBps).
 */
contract AgentGaugeController is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================
    // CONSTANTS
    // ================================

    uint256 public constant MAX_BPS = 10000;
    uint256 public constant LOTTERY_MANAGER_UPDATE_TIMELOCK = 1 days;

    /// @notice Timelock for emergency withdrawals and stranded-WETH write-downs
    ///         (ODA-508-6 creator-lane parity / ODA-508-2).
    uint256 public constant EMERGENCY_WITHDRAW_DELAY = 1 days;

    /// @notice ODA-508-L5: with less remaining gas than this (e.g. a 2,300-gas
    /// `.transfer()/.send()` stipend), `receive()` keeps the ETH raw instead of wrapping.
    uint256 private constant MIN_WRAP_GAS = 10_000;

    /// @notice WETH on Base
    address public constant WETH = 0x4200000000000000000000000000000000000006;

    // ================================
    // STATE
    // ================================

    /// @notice The ShareOFT token (e.g., ◆AKITA) - what we receive as fees
    IERC20 public immutable shareOFT;

    /// @notice The underlying agent token (e.g., akita)
    IERC20 public agentToken;

    /// @notice The wrapper to unwrap OFT → vault shares
    IAgentOVaultWrapper public wrapper;

    /// @notice The ERC-4626 vault (e.g., ◇AKITA)
    IAgentOVault public vault;

    /// @notice Vault shares token (same as vault address, but as IERC20)
    IERC20 public vaultShares;

    /// @notice Lottery manager for jackpot (pull-based: reads the reserve and calls
    ///         `payJackpot`; no push hook exists on the gauge — ODA-508-I4/I-6)
    address public lotteryManager;
    address public pendingLotteryManager;
    uint256 public pendingLotteryManagerAt;

    /// @notice One-way flag: true once a non-zero lottery manager has ever been set.
    /// @dev FIX: ODA-508-3 — never cleared by the revoke path, so revoke-then-set routes
    ///      through the timelock instead of the immediate first-set branch.
    bool public lotteryManagerInitialized;

    /// @notice FIX: ODA-508-L4 — delay before an oracle change or a new swap-router
    ///         allowlisting can execute; converts the instant owner pivot that defeats
    ///         `PendingWethFeesProtected` into an observable 1-day action.
    uint256 public constant CONFIG_UPDATE_TIMELOCK = 1 days;

    address public pendingOracle;
    uint256 public pendingOracleAt;
    /// @notice One-way flag: true once a non-zero oracle has ever been set (first set stays
    ///         immediate so deploy wiring is unaffected).
    bool public oracleInitialized;
    /// @notice Router → timestamp after which its allowlisting can execute (0 = none pending).
    mapping(address => uint256) public pendingRouterAllowlist;

    /// @notice Agent's treasury wallet
    address public agentTreasury;

    /// @notice Protocol multisig (4626 treasury)
    address public protocolTreasury;

    /// @notice Slippage tolerance for swaps (in bps, default 100 = 1%)
    uint256 public swapSlippageBps = 100;

    /// @notice Oracle for price-based slippage protection
    IOracle4626 public oracle;

    /// @notice TWAP duration for oracle price (default 30 min)
    uint32 public oracleTwapDuration = 1800;

    /// @notice Whether to use oracle for slippage (if false, the keeper-supplied
    ///         `minShareOftOut` is the only floor — ODA-508-2)
    bool public useOracleSlippage = true;

    /// @notice Voter rewards distributor (receives the 21.39% voter slice as ShareOFT)
    Ive4626VoterRewardsDistributor public ve4626VoterRewardsDistributor;

    // ================================
    // FEE SPLIT (in basis points) — IMMUTABLE
    // ================================
    /// @dev Public constant names preserve legacy getter selectors (`burnShareBps()`, etc.) for
    ///      off-chain monitors (e.g. KPR payout-integrity) and integrators. Do not rename.

    /// @notice Percentage burned as vault shares (increases PPS for all holders)
    uint256 public constant burnShareBps = 961; // 9.61%

    /// @notice Percentage to lottery reserve (ShareOFT units)
    uint256 public constant lotteryShareBps = 6900; // 69%

    /// @notice Percentage to agent treasury (ongoing lane)
    uint256 public constant treasuryShareBps = 0; // 0% - agents earn via appreciation + bribes (disabled by default)

    /// @notice Voter slice (ShareOFT units via ve4626VoterRewardsDistributor or treasury fallbacks)
    uint256 public constant protocolShareBps = 2139; // 21.39%

    // ================================
    // ACCUMULATION & DISTRIBUTION
    // ================================

    /// @notice Pending OFT fees to distribute
    uint256 public pendingFees;

    /// @notice Explicit accounting of how much OFT this contract expects to hold
    ///         (pendingFees + jackpotReserve); bridged credits sweep the surplus (G-11).
    uint256 public accountedOFTBalance;

    /// @notice Minimum amount before auto-distribution
    uint256 public distributionThreshold = 100e18; // 100 OFT tokens

    /// @notice Last ShareOFT distribution timestamp
    uint256 public lastDistribution;

    /// @notice Last WETH-lane distribution timestamp (ODA-424-L4 / 432-F3)
    /// @dev Independent of `lastDistribution` so WETH processing cannot suppress OFT cadence.
    uint256 public lastWethDistribution;

    /// @notice Minimum time between distributions
    uint256 public distributionInterval = 1 hours;
    /// @notice Cap distributionInterval to avoid `lastDistribution + interval` overflow brick (ODA-467-5).
    uint256 public constant MAX_DISTRIBUTION_INTERVAL = 30 days;
    /// @notice Floor for distributionInterval — 0 removed all rate limiting and enabled a
    ///      dust-fee leak loop through the wrapper's unwrapFee (ODA-508-7).
    uint256 public constant MIN_DISTRIBUTION_INTERVAL = 5 minutes;
    /// @notice Minimum oracle TWAP window (ODA-467-4).
    uint32 public constant MIN_ORACLE_TWAP_DURATION = 1800;
    /// @notice Maximum oracle TWAP window.
    uint32 public constant MAX_ORACLE_TWAP_DURATION = 7200;

    // ================================
    // JACKPOT RESERVE
    // ================================

    /// @notice ShareOFT (◆) held as jackpot reserve for lottery payouts
    uint256 public jackpotReserve;

    // ================================
    // LIFETIME STATS
    // ================================

    /// @notice Total vault shares burned (lifetime) — ◇ vault-share units, NOT ShareOFT ◆
    ///         (ODA-508-L6: differs 1000× from the ◆ burn slice; see `previewDistribution`)
    uint256 public totalSharesBurned;

    /// @notice Total distributed to lottery (lifetime)
    uint256 public totalLotteryFunded;

    /// @notice Total distributed to treasury (lifetime)
    uint256 public totalTreasuryEarned;

    /// @notice Total distributed to protocol (lifetime)
    uint256 public totalProtocolEarned;

    /// @notice Total OFT fees received (lifetime)
    uint256 public totalFeesReceived;

    /// @notice Total WETH fees received from tax hook (lifetime)
    uint256 public totalWETHFeesReceived;

    /// @notice Pending WETH fees from tax hook
    uint256 public pendingWETHFees;

    // ================================
    // WETH FEE PROCESSING (MEV HARDENING)
    // ================================

    /// @notice Optional keeper allowed to process large WETH fee batches.
    /// @dev Default: address(0) (disabled). Owner is always authorized.
    address public wethFeeKeeper;

    /// @notice Max WETH per keeper `processWETHFeesWithRoute` call (0 = keeper cannot swap; owner uncapped).
    /// @dev Storage name preserved for ABI compatibility with prior permissionless cap.
    uint256 public maxPermissionlessWethProcess;

    /// @notice Allowlisted routers for keeper WETH→◆ buyback calldata.
    mapping(address => bool) public allowedSwapRouters;

    /// @notice Minimum seconds between keeper `processWETHFeesWithRoute` calls (0 = no cooldown).
    /// @dev FIX: ODA-508-8 — the per-call cap alone was loopable within one transaction; this
    ///      bounds keeper throughput over time. Owner calls are never gated.
    uint256 public wethKeeperCooldown = 1 hours;

    /// @notice Pending owner write-down of the stranded WETH earmark (ODA-508-2).
    uint256 public pendingWethWriteDownAmount;
    uint256 public pendingWethWriteDownAt;

    /// @dev FIX: ODA-508-L1 — set around the router call so `receive()` skips the WETH
    ///      earmark credit for mid-swap native-ETH refunds (Universal Router UNWRAP_WETH /
    ///      SWEEP). Without this, a refund deterministically reverted the buyback at the
    ///      exact-consumption check — and would otherwise have double-credited the refund.
    bool private _swapInProgress;

    // ================================
    // EVENTS
    // ================================

    event FeesReceived(address indexed from, uint256 oftAmount);
    event WETHFeesReceived(address indexed from, uint256 wethAmount);
    /// @dev ODA-508-L6 unit note: `sharesBurned` is vault shares (◇); `toLottery`,
    ///      `toTreasury`, `toProtocol` are ShareOFT (◆) — a 1000× normalization apart.
    event FeesDistributed(
        uint256 sharesBurned, uint256 toLottery, uint256 toTreasury, uint256 toProtocol, uint256 newPricePerShare
    );
    event WETHFeesProcessed(uint256 wethAmount, uint256 shareOftReceived, address router);
    event SwapRouterAllowlistUpdated(address indexed router, bool allowed);
    event SharesBurned(uint256 shares, uint256 newPPS);
    event JackpotPaid(address indexed winner, uint256 shares);

    event VaultSet(address indexed vault);
    event WrapperSet(address indexed wrapper);
    event LotteryManagerSet(address indexed manager);
    event LotteryManagerUpdateQueued(address indexed pendingManager, uint256 executeAfter);
    event AgentTreasurySet(address indexed treasury);
    event ProtocolTreasurySet(address indexed treasury);
    event AgentTokenSet(address indexed coin);
    event ThresholdUpdated(uint256 newThreshold);
    event SwapConfigUpdated(uint256 slippageBps);
    event OracleSet(address indexed oracle);
    /// @notice ODA-508-L4.
    event OracleUpdateQueued(address indexed oracle, uint256 executeAfter);
    /// @notice ODA-508-L4.
    event OracleUpdateCancelled(address indexed oracle);
    /// @notice ODA-508-L4.
    event RouterAllowlistQueued(address indexed router, uint256 executeAfter);
    event OracleConfigUpdated(uint32 twapDuration, bool useOracle);
    event ve4626VoterRewardsDistributorUpdated(address indexed distributor);

    event WethFeeKeeperUpdated(address indexed oldKeeper, address indexed newKeeper);
    event WethProcessingConfigUpdated(uint256 maxPermissionlessWethProcess, bool autoProcessWethFees);

    // ODA-508 remediation events
    /// @notice Burn-slice unwrap degraded to a next-cycle retry (bridged-accounting only). ODA-508-1.
    event BurnSliceDegraded(uint256 oftAmount);
    /// @notice I-3: `setDistributionInterval` previously emitted nothing. ODA-508-7.
    event DistributionIntervalUpdated(uint256 newInterval);
    /// @notice ODA-508-8.
    event WethKeeperCooldownUpdated(uint256 newCooldown);
    /// @notice ODA-508-6 (creator-lane parity).
    event EmergencyWithdrawQueued(address indexed token, uint256 amount, address indexed to, uint256 executeAfter);
    /// @notice ODA-508-6 (creator-lane parity).
    event EmergencyWithdrawCancelled(address indexed token, uint256 amount, address indexed to);
    /// @notice ODA-508-2.
    event PendingWethFeesWriteDownQueued(uint256 amount, uint256 executeAfter);
    /// @notice ODA-508-2.
    event PendingWethFeesWriteDownCancelled(uint256 amount);
    /// @notice ODA-508-2.
    event PendingWethFeesWrittenDown(uint256 amount);

    // ================================
    // ERRORS
    // ================================

    error ZeroAddress();
    error NothingToDistribute();
    error TooSoon();
    error VaultNotSet();
    error WrapperNotSet();
    error InsufficientJackpot();
    error OnlyLotteryManager();
    error SwapFailed();
    error InvalidSlippage();
    error MinOutputUnavailable();
    error NotAuthorized();
    error AgentTreasuryRequired();
    error InvalidVaultAssetBinding();
    error InvalidWrapperVaultBinding();
    error JackpotReserveProtected();
    error PendingWethFeesProtected();
    error NoPendingLotteryManager();
    error LotteryManagerUpdateTimelockActive(uint256 executeAfter);
    error OwnershipRenounceDisabled();
    error InvalidDistributionInterval();
    error InvalidTwapDuration();
    error RouterNotAllowed();
    error RoutedSwapRequired();
    /// @dev ODA-508-1 — burn-slice unwrap reverted for a non-bridged reason; distribution
    ///      must fail loudly rather than divert the slice to jackpot.
    error BurnSliceUnwrapFailed(bytes reason);
    /// @dev ODA-508-5 — vault does not recognise this gauge as its registered controller.
    error GaugeNotRegisteredOnVault();
    error ZeroAmount();
    error NoPendingEmergencyWithdraw();
    error EmergencyWithdrawTooEarly(uint256 executeAfter);
    /// @dev ODA-508-L5 — native-ETH sweep transfer failed.
    error NativeSweepFailed();
    error NoPendingWethWriteDown();
    error WethWriteDownTooEarly(uint256 executeAfter);
    /// @dev ODA-508-7.
    error BelowDistributionThreshold();
    /// @dev ODA-508-8.
    error KeeperCooldownActive();
    /// @dev ODA-508-L9 — oracle-floor math assumes 18-decimal units.
    error Non18DecimalAgentToken(address token, uint8 tokenDecimals);

    /// @notice ODA-508-L4.
    error NoPendingOracleUpdate();
    /// @notice ODA-508-L4.
    error OracleUpdateTooEarly(uint256 executeAfter);
    /// @notice ODA-508-L4.
    error NoPendingRouterAllowlist();
    /// @notice ODA-508-L4.
    error RouterAllowlistTooEarly(uint256 executeAfter);

    // ================================
    // CONSTRUCTOR
    // ================================

    /**
     * @notice Create gauge controller for a agent token vault
     * @param _shareOFT The ShareOFT token address (e.g., ◆AKITA)
     * @param _agentTreasury Agent's treasury wallet
     * @param _protocolTreasury Protocol multisig (4626 treasury)
     * @param _owner Owner (usually the agent owner)
     */
    constructor(address _shareOFT, address _agentTreasury, address _protocolTreasury, address _owner)
        Ownable(_owner)
    {
        if (_shareOFT == address(0)) revert ZeroAddress();
        if (_protocolTreasury == address(0)) revert ZeroAddress();

        // FIX: L-03 (4626-351) — the constant WETH address above is hardcoded to Base
        // (chain id 8453). Deploying this controller to any other chain would silently
        // succeed but every swap path would target an address that does not exist on that
        // chain, bricking fee routing. Assert chain id at construction so misdeployment
        // fails fast rather than on the first swap attempt.
        require(block.chainid == 8453, "Only Base supported");

        // FIX: G-24 — compile/deploy-time assertion that fee split constants sum to MAX_BPS
        require(
            burnShareBps + lotteryShareBps + treasuryShareBps + protocolShareBps == MAX_BPS,
            "BPS mismatch"
        );

        shareOFT = IERC20(_shareOFT);
        agentTreasury = _agentTreasury;
        protocolTreasury = _protocolTreasury;
    }

    // ================================
    // RECEIVE FEES
    // ================================

    /**
     * @notice Receive fees from AgentShareOFT buy transactions
     * @dev Called by ShareOFT when buy fees are collected
     *      Fees arrive as OFT tokens (e.g., ◆AKITA)
     * @param amount Amount of OFT tokens received
     */
    function receiveFees(uint256 amount) external nonReentrant {
        if (amount == 0) return;

        // FIX: ODA-508-L2 (creator-lane parity) — pull OFT tokens and account only what arrived.
        uint256 balBefore = shareOFT.balanceOf(address(this));
        shareOFT.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = shareOFT.balanceOf(address(this)) - balBefore;
        if (received == 0) return;

        pendingFees += received;
        // FIX: G-11 — track OFT balance
        accountedOFTBalance += received;
        totalFeesReceived += received;

        emit FeesReceived(msg.sender, received);

        // Auto-distribute if above threshold and enough time has passed
        if (pendingFees >= distributionThreshold && block.timestamp >= lastDistribution + distributionInterval) {
            _distribute();
        }
    }

    /**
     * @notice Direct deposit for manual fee deposits
     */
    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) return;

        // FIX: ODA-508-L2 (creator-lane parity) — account only what arrived.
        uint256 balBefore = shareOFT.balanceOf(address(this));
        shareOFT.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = shareOFT.balanceOf(address(this)) - balBefore;
        if (received == 0) return;

        pendingFees += received;
        // FIX: G-11 — track OFT balance
        accountedOFTBalance += received;
        totalFeesReceived += received;

        emit FeesReceived(msg.sender, received);
    }

    /**
     * @notice Account for OFT tokens that arrived via cross-chain fee flush
     * @dev When remote AgentShareOFTs flush fees via OFT send(), the tokens
     *      are minted directly to this contract by LayerZero's _credit().
     *      This function sweeps the unaccounted balance into pendingFees.
     *
     *      Permissionless — anyone can trigger this (keeper, owner, etc.)
     */
    function receiveBridgedFees() external nonReentrant {
        uint256 balance = shareOFT.balanceOf(address(this));

        // FIX: G-11 — use explicit accounted OFT balance instead of just pendingFees
        // This prevents jackpot ShareOFT from being swept as bridged fees
        uint256 accounted = accountedOFTBalance;
        if (balance <= accounted) return;

        uint256 bridgedAmount = balance - accounted;
        pendingFees += bridgedAmount;
        accountedOFTBalance += bridgedAmount;
        totalFeesReceived += bridgedAmount;

        emit FeesReceived(address(0), bridgedAmount); // address(0) signals bridged origin

        // Auto-distribute if above threshold and enough time has passed
        if (pendingFees >= distributionThreshold && block.timestamp >= lastDistribution + distributionInterval) {
            _distribute();
        }
    }

    // ================================
    // RECEIVE WETH FEES (FROM V4 TAX HOOK)
    // ================================

    /**
     * @notice Receive WETH fees from the V4 Tax Hook
     * @dev Called when swaps happen on the ◆AKITA/ETH pool with tax hook
     *      The tax hook sends WETH here, which we convert to vault shares
     * @param amount Amount of WETH received
     */
    function receiveWETHFees(uint256 amount) external nonReentrant {
        if (amount == 0) return;

        // FIX: ODA-508-L2 (creator-lane parity) — pull WETH and account only what arrived.
        uint256 balBefore = IERC20(WETH).balanceOf(address(this));
        IERC20(WETH).safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = IERC20(WETH).balanceOf(address(this)) - balBefore;
        if (received == 0) return;

        pendingWETHFees += received;
        totalWETHFeesReceived += received;

        emit WETHFeesReceived(msg.sender, received);
        // MEV: never auto-swap on intake. Keepr submits `processWETHFeesWithRoute` privately.
    }

    /**
     * @notice Receive native ETH (e.g., from tax hook that sends ETH directly)
     */
    receive() external payable {
        if (msg.value == 0) return;

        // FIX: ODA-508-L5 — a 2,300-gas stipend (`.transfer()/.send()`, the pattern the tax
        // hook uses per the docblock above) cannot pay for the WETH wrap + two SSTOREs + an
        // event, so those sends used to revert outright. Keep the ETH raw instead; it is
        // recoverable via the native-ETH branch of `executeEmergencyWithdraw` (ODA-508-6).
        if (gasleft() < MIN_WRAP_GAS) return;

        // Wrap ETH to WETH
        IWETH(WETH).deposit{value: msg.value}();
        // FIX: ODA-508-L1 — a native-ETH refund arriving mid-swap stays un-earmarked surplus;
        // crediting it would charge the gauge for WETH it had just paid out of its own balance.
        if (_swapInProgress) return;
        pendingWETHFees += msg.value;
        totalWETHFeesReceived += msg.value;

        emit WETHFeesReceived(msg.sender, msg.value);
    }

    /**
     * @notice Legacy entrypoint removed — use `processWETHFeesWithRoute`.
     */
    function processWETHFees() external pure {
        revert RoutedSwapRequired();
    }

    /**
     * @notice Process pending WETH fees via keeper-quoted best-path buyback into ShareOFT (◆).
     * @dev Owner or `wethFeeKeeper` only. ■/◆ recipient in calldata must be this gauge (`NoFees`).
     */
    function processWETHFeesWithRoute(
        uint256 wethAmount,
        address router,
        bytes calldata swapCalldata,
        uint256 minShareOftOut
    ) external nonReentrant {
        uint256 amountToProcess = _wethAmountToProcessForCaller(msg.sender, wethAmount);
        if (amountToProcess == 0) return;
        _processWETHFeesWithRoute(amountToProcess, router, swapCalldata, minShareOftOut);
    }

    function _wethAmountToProcessForCaller(address caller, uint256 requested)
        internal
        view
        returns (uint256 amountToProcess)
    {
        uint256 pending = pendingWETHFees;
        if (pending == 0 || requested == 0) return 0;

        uint256 want = requested > pending ? pending : requested;

        if (caller == owner()) {
            return want;
        }
        if (caller != wethFeeKeeper) revert NotAuthorized();

        uint256 cap = maxPermissionlessWethProcess;
        if (cap == 0) revert NotAuthorized();
        // FIX: ODA-508-8 — the per-call cap had no temporal bound: a keeper contract could
        // loop `ceil(pendingWETHFees / cap)` calls in one transaction. Rate-limit via the
        // already-written (and previously never-read) `lastWethDistribution`.
        if (block.timestamp < lastWethDistribution + wethKeeperCooldown) revert KeeperCooldownActive();
        return want > cap ? cap : want;
    }

    function _processWETHFeesWithRoute(
        uint256 wethAmount,
        address router,
        bytes calldata swapCalldata,
        uint256 minShareOftOut
    ) internal {
        if (wethAmount == 0) return;
        if (pendingWETHFees < wethAmount) revert SwapFailed();
        if (router == address(0) || !allowedSwapRouters[router]) revert RouterNotAllowed();
        if (swapCalldata.length == 0) revert SwapFailed();

        uint256 oracleMin = _calculateMinOutput(wethAmount);
        // FIX: ODA-508-2 — only fail closed when the oracle floor is actually enabled.
        // `useOracleSlippage == false` is the documented way to disable oracle slippage and
        // must mean "caller-supplied `minShareOftOut` floor only", not "brick the WETH lane".
        if (oracleMin == 0 && useOracleSlippage) revert MinOutputUnavailable();
        uint256 minOut = minShareOftOut > oracleMin ? minShareOftOut : oracleMin;

        pendingWETHFees -= wethAmount;

        uint256 oftBefore = shareOFT.balanceOf(address(this));
        uint256 wethBefore = IERC20(WETH).balanceOf(address(this));

        IERC20(WETH).forceApprove(router, wethAmount);
        _swapInProgress = true;
        (bool ok,) = router.call(swapCalldata);
        _swapInProgress = false;
        IERC20(WETH).forceApprove(router, 0);
        if (!ok) revert SwapFailed();

        uint256 wethAfter = IERC20(WETH).balanceOf(address(this));
        // FIX: ODA-508-L1 — allow under-spend and native-ETH refunds (the refund stays
        // un-earmarked surplus while `_swapInProgress` suppressed the credit); still revert
        // if the router pulled more WETH than authorised for this call.
        if (wethBefore > wethAfter && wethBefore - wethAfter > wethAmount) revert SwapFailed();

        uint256 oftAfter = shareOFT.balanceOf(address(this));
        if (oftAfter <= oftBefore) revert SwapFailed();
        uint256 shareOftReceived = oftAfter - oftBefore;
        if (shareOftReceived < minOut) revert SwapFailed();

        pendingFees += shareOftReceived;
        accountedOFTBalance += shareOftReceived;
        totalFeesReceived += shareOftReceived;
        lastWethDistribution = block.timestamp;

        emit WETHFeesProcessed(wethAmount, shareOftReceived, router);
        // Do not auto `_distribute()` here — keeps ShareOFT `lastDistribution` independent
        // of the WETH lane (ODA-424-L4). Permissionless `distribute()` sweeps pendingFees.
    }

    /**
     * @dev `getAssetEthTWAP` returns vault-asset tokens per ETH (IOracle4626), not ShareOFT.
     *      Convert asset → vault shares via `pricePerShare`, then vault shares → ShareOFT via
     *      `wrapper.previewWrap` (NORMALIZATION_FACTOR / wrap fee). Fail closed if unset.
     *
     *      ODA-508-4 (documented limitation): this reconstructs MINT PARITY (vault NAV), but
     *      the buyback swap executes on the ◆/WETH AMM. The two prices are linked only by an
     *      arbitrage that pays wrap fee + cooldown + the ◆ pool's buyFeeBps, so treat the
     *      result as a loose sanity bound — the authoritative MEV defence is the keeper's
     *      own `minShareOftOut` quote plus private submission. `previewWrap` deducts the
     *      wrap fee unless the gauge is whitelisted; the deploy batcher whitelists the gauge
     *      (ODA-508-1 operational fix), so deployed gauges do not pay that deduction here.
     */
    function _expectedShareOftFromAssetTwap(uint256 wethAmount, uint256 assetPerEth)
        internal
        view
        returns (uint256 expectedShareOft)
    {
        if (
            address(vault) == address(0) || address(wrapper) == address(0) || assetPerEth == 0
                || wethAmount == 0
        ) {
            return 0;
        }
        uint256 pps = vault.pricePerShare();
        if (pps == 0) return 0;
        uint256 expectedAsset = Math.mulDiv(wethAmount, assetPerEth, 1e18);
        uint256 expectedVaultShares = Math.mulDiv(expectedAsset, 1e18, pps);
        return wrapper.previewWrap(expectedVaultShares, address(this));
    }

    /**
     * @notice Calculate minimum ◆ output for WETH → ShareOFT buyback using oracle TWAP
     * @dev ODA-508-4: the floor is priced off vault NAV (mint parity), not the ◆/WETH
     *      execution venue — a loose sanity bound, not a tight execution-price floor.
     *      Returns 0 when the oracle is disabled, stale, or the amount truncates to zero;
     *      callers treat 0 as "no oracle floor" (fail-closed only when `useOracleSlippage`).
     */
    function _calculateMinOutput(uint256 wethAmount) internal view returns (uint256 minOut) {
        if (!useOracleSlippage || address(oracle) == address(0)) {
            return 0;
        }

        try oracle.isPriceFresh() returns (bool fresh) {
            if (!fresh) return 0;
        } catch {
            return 0;
        }

        try oracle.getAssetEthTWAP(oracleTwapDuration) returns (uint256 assetPerEth) {
            uint256 expectedOut = _expectedShareOftFromAssetTwap(wethAmount, assetPerEth);
            if (expectedOut == 0) return 0;
            minOut = Math.mulDiv(expectedOut, (MAX_BPS - swapSlippageBps), MAX_BPS);
        } catch {
            return 0;
        }
    }

    // ================================
    // DISTRIBUTION
    // ================================

    /**
     * @notice Distribute accumulated fees
     * @dev Can be called by anyone (permissionless)
     */
    function distribute() external nonReentrant {
        _distribute();
    }

    // FIX: G-19 — event for emergency force distributions (auditing/monitoring)
    event ForceDistributed(uint256 amount, uint256 timestamp);

    /**
     * @notice Force distribution (owner only, bypasses time check)
     * @dev EMERGENCY ONLY — bypasses distributionInterval. Should be behind timelock/multisig.
     */
    function forceDistribute() external nonReentrant onlyOwner {
        if (pendingFees == 0) revert NothingToDistribute();
        uint256 amount = pendingFees;
        _distributeInternal();
        emit ForceDistributed(amount, block.timestamp);
    }

    function _distribute() internal {
        if (pendingFees == 0) revert NothingToDistribute();
        // FIX: ODA-508-7 — the permissionless path ignored the threshold: any dust reset
        // `lastDistribution` (cadence hostage) and `canDistribute()` disagreed with
        // `distribute()`. Bind the same threshold the auto-distribute paths already check.
        if (pendingFees < distributionThreshold) revert BelowDistributionThreshold();
        if (block.timestamp < lastDistribution + distributionInterval) revert TooSoon();

        _distributeInternal();
    }

    function _distributeInternal() internal {
        if (address(vault) == address(0)) revert VaultNotSet();

        uint256 oftAmount = pendingFees;
        pendingFees = 0;
        accountedOFTBalance -= oftAmount;
        lastDistribution = block.timestamp;

        (uint256 toLottery, uint256 toVoters, uint256 toTreasury, uint256 toBurnOft) =
            _splitShareOftAmount(oftAmount);

        if (toLottery > 0) {
            jackpotReserve += toLottery;
            totalLotteryFunded += toLottery;
            accountedOFTBalance += toLottery;
        }

        if (toTreasury > 0 && agentTreasury != address(0)) {
            shareOFT.safeTransfer(agentTreasury, toTreasury);
            totalTreasuryEarned += toTreasury;
        } else if (toTreasury > 0) {
            jackpotReserve += toTreasury;
            totalLotteryFunded += toTreasury;
            toLottery += toTreasury;
            accountedOFTBalance += toTreasury;
            toTreasury = 0;
        }

        uint256 vaultSharesBurned = _burnShareOftSlice(toBurnOft);
        _routeVoterShareOft(toVoters);

        emit FeesDistributed(vaultSharesBurned, toLottery, toTreasury, toVoters, vault.pricePerShare());
    }

    function _splitShareOftAmount(uint256 oftAmount)
        internal
        pure
        returns (uint256 toLottery, uint256 toVoters, uint256 toTreasury, uint256 toBurnOft)
    {
        toLottery = (oftAmount * lotteryShareBps) / MAX_BPS;
        toVoters = (oftAmount * protocolShareBps) / MAX_BPS;
        toTreasury = (oftAmount * treasuryShareBps) / MAX_BPS;
        toBurnOft = oftAmount - toLottery - toVoters - toTreasury;
    }

    function _burnShareOftSlice(uint256 oftAmount) internal returns (uint256 vaultSharesBurned) {
        if (oftAmount == 0) return 0;
        if (address(wrapper) == address(0)) revert WrapperNotSet();

        // ODA-467-[1] (agent lane parity): bridged ShareOFT has no wrap accounting.
        // FIX: ODA-508-1 — degrade ONLY for the bridged-accounting reverts this catch was
        // added for. Any other revert (e.g. an attacker-inducible wrapper cooldown) must not
        // silently reclassify the burn slice as jackpot; leave the slice in pendingFees for
        // retry next cycle and emit a distinct event so the degrade is observable.
        shareOFT.forceApprove(address(wrapper), oftAmount);
        try wrapper.unwrap(oftAmount) returns (uint256 unwrapped) {
            vaultSharesBurned = unwrapped;
        } catch (bytes memory reason) {
            shareOFT.forceApprove(address(wrapper), 0);
            if (!_isBridgedAccountingRevert(reason)) revert BurnSliceUnwrapFailed(reason);
            pendingFees += oftAmount;
            accountedOFTBalance += oftAmount;
            emit BurnSliceDegraded(oftAmount);
            return 0;
        }

        // FIX: ODA-508-5 — fail with a clear error when the vault no longer recognises this
        // gauge (vault owner repointed `setGaugeController`), instead of the vault's opaque
        // `OnlyGaugeController` revert mid-distribution.
        if (vault.gaugeController() != address(this)) revert GaugeNotRegisteredOnVault();

        vaultShares.forceApprove(address(vault), vaultSharesBurned);
        vault.burnSharesForPriceIncrease(vaultSharesBurned);
        // FIX: ODA-508-I7 — clear allowances locally rather than relying on the counterparty
        // consuming them exactly (shareOFT was only cleared on the degrade path before).
        vaultShares.forceApprove(address(vault), 0);
        shareOFT.forceApprove(address(wrapper), 0);
        totalSharesBurned += vaultSharesBurned;

        emit SharesBurned(vaultSharesBurned, vault.pricePerShare());
    }

    /// @dev FIX: ODA-508-1 — only the wrapper's bridged-accounting reverts justify degrading
    ///      (bridged ShareOFT was LayerZero-minted to this gauge, so wrapper wrap accounting
    ///      does not cover it). Signatures mirror AgentOVaultWrapper errors; selector match
    ///      is what matters.
    function _isBridgedAccountingRevert(bytes memory reason) internal pure returns (bool) {
        if (reason.length < 4) return false;
        bytes4 selector = bytes4(reason);
        return selector == bytes4(keccak256("InsufficientLocked()"))
            || selector == bytes4(keccak256("BurnExceedsTotalMinted(uint256,uint256)"));
    }

    function _routeVoterShareOft(uint256 toVoters) internal {
        if (toVoters == 0) return;

        // `protocolTreasury` is never zero (constructor + setter forbid it), so the zero-value
        // jackpot-fallback branches the Creator-audit parity copy carried are removed (I-4).
        if (address(ve4626VoterRewardsDistributor) != address(0)) {
            shareOFT.forceApprove(address(ve4626VoterRewardsDistributor), toVoters);
            try ve4626VoterRewardsDistributor.notifyRewards(address(vault), address(shareOFT), toVoters) {
                // FIX: ODA-508-L3 — measure delivery from the remaining allowance instead of
                // balance deltas: `balanceBefore` included the entire jackpotReserve, so a ◆
                // credit landing during `notifyRewards` mis-measured `spent` as 0 and the
                // gauge paid the voter slice a second time out of jackpot backing. The
                // allowance was set to exactly `toVoters` and pulls only decrease it.
                uint256 allowanceLeft = shareOFT.allowance(address(this), address(ve4626VoterRewardsDistributor));
                uint256 spent = toVoters - allowanceLeft;

                if (spent > 0) {
                    totalProtocolEarned += spent;
                }

                uint256 remainder = toVoters - spent;
                if (remainder > 0) {
                    shareOFT.safeTransfer(protocolTreasury, remainder);
                    totalProtocolEarned += remainder;
                }
                // Clear allowance on success too, so a partial-spend distributor
                // cannot retain stale spend permissions between distributions.
                shareOFT.forceApprove(address(ve4626VoterRewardsDistributor), 0);
            } catch {
                shareOFT.forceApprove(address(ve4626VoterRewardsDistributor), 0);
                shareOFT.safeTransfer(protocolTreasury, toVoters);
                totalProtocolEarned += toVoters;
            }
        } else {
            shareOFT.safeTransfer(protocolTreasury, toVoters);
            totalProtocolEarned += toVoters;
        }
    }

    // ================================
    // JACKPOT (FOR LOTTERY)
    // ================================

    /**
     * @notice Jackpot ShareOFT available for lottery payout (conservative view for sizing).
     */
    function availableJackpotReserve() public view returns (uint256) {
        return jackpotReserve;
    }

    /**
     * @notice Pay jackpot to lottery winner in ShareOFT (◆)
     * @dev Only callable by lottery manager; reverts when reserve is insufficient (M-02).
     *      ODA-508-L10 (accepted residual): while `lotteryManager == address(0)` the jackpot
     *      is frozen — `payJackpot` is unreachable and `JackpotReserveProtected` blocks the
     *      emergency path. That freeze is the intended custody trade of ODA-508-3: the owner
     *      lifts it by queuing a new manager via `setLotteryManager` +
     *      `executeLotteryManagerUpdate` (≤ `LOTTERY_MANAGER_UPDATE_TIMELOCK`), never
     *      instantly, so a compromised owner key cannot drain the reserve in one transaction.
     * @param winner Winner's address
     * @param amount Amount of ShareOFT to pay
     */
    function payJackpot(address winner, uint256 amount) external nonReentrant {
        if (msg.sender != lotteryManager) revert OnlyLotteryManager();
        if (amount > jackpotReserve) revert InsufficientJackpot();
        if (winner == address(0)) revert ZeroAddress();

        jackpotReserve -= amount;
        accountedOFTBalance -= amount;
        shareOFT.safeTransfer(winner, amount);

        emit JackpotPaid(winner, amount);
    }

    /**
     * @notice Get available jackpot
     */
    function getJackpotReserve() external view returns (uint256) {
        return jackpotReserve;
    }

    /**
     * @notice Legacy alias — returns unreserved jackpot capacity for lottery sizing.
     */
    function getAvailableJackpotReserve() external view returns (uint256) {
        return availableJackpotReserve();
    }

    // ================================
    // ADMIN - CONFIGURATION
    // ================================

    /**
     * @notice Set the vault address
     * @param _vault AgentOVault address
     */
    function setVault(address _vault) external onlyOwner {
        if (_vault == address(0)) revert ZeroAddress();
        vault = IAgentOVault(_vault);
        vaultShares = IERC20(_vault); // Vault is also the share token
        _validateCoreWiring();
        emit VaultSet(_vault);
    }

    /**
     * @notice Set the wrapper address
     * @param _wrapper AgentOVaultWrapper address
     */
    function setWrapper(address _wrapper) external onlyOwner {
        if (_wrapper == address(0)) revert ZeroAddress();
        wrapper = IAgentOVaultWrapper(_wrapper);
        _validateCoreWiring();
        emit WrapperSet(_wrapper);
    }

    /**
     * @notice Atomically (re)wire vault + wrapper + agent token (owner only).
     * @dev FIX: ODA-508-5 — the individual setters validate the mixed (new, old) pair, so
     *      migrating vault/wrapper in either order deadlocked on `InvalidWrapperVaultBinding`
     *      (the wrapper's vault binding is immutable). Setting the complete triple and
     *      validating once breaks the deadlock. The registration check catches vault↔gauge
     *      mis-wiring at wire time; it is deliberately NOT in `_validateCoreWiring` because
     *      the deploy batcher wires the gauge setters before the vault's `setGaugeController`.
     */
    function setCoreWiring(address _vault, address _wrapper, address _agentToken) external onlyOwner {
        if (_vault == address(0) || _wrapper == address(0) || _agentToken == address(0)) {
            revert ZeroAddress();
        }
        vault = IAgentOVault(_vault);
        vaultShares = IERC20(_vault); // Vault is also the share token
        wrapper = IAgentOVaultWrapper(_wrapper);
        _setAgentToken(_agentToken);
        _validateCoreWiring();
        if (vault.gaugeController() != address(this)) revert GaugeNotRegisteredOnVault();
        emit VaultSet(_vault);
        emit WrapperSet(_wrapper);
        emit AgentTokenSet(_agentToken);
    }

    /**
     * @notice Set the lottery manager
     * @dev First-ever non-zero set is immediate (deploy wiring), gated on a one-way flag
     *      (ODA-508-3). Later non-zero reassignments are timelocked (ODA-424-M2).
     *      ODA-467-2: address(0) revokes immediately and cancels any pending update —
     *      but does not re-arm the immediate path.
     * @param _lotteryManager Lottery manager address
     */
    function setLotteryManager(address _lotteryManager) external onlyOwner {
        if (_lotteryManager == address(0)) {
            pendingLotteryManager = address(0);
            pendingLotteryManagerAt = 0;
            lotteryManager = address(0);
            emit LotteryManagerSet(address(0));
            return;
        }
        // FIX: ODA-508-3 — `lotteryManager == address(0)` is a reachable runtime state via
        // the revoke branch above, so the old guard let an owner bypass the timelock with
        // revoke-then-set (instant jackpot drain). The one-way flag closes that composition.
        if (!lotteryManagerInitialized) {
            lotteryManagerInitialized = true;
            lotteryManager = _lotteryManager;
            emit LotteryManagerSet(_lotteryManager);
            return;
        }
        pendingLotteryManager = _lotteryManager;
        pendingLotteryManagerAt = block.timestamp + LOTTERY_MANAGER_UPDATE_TIMELOCK;
        emit LotteryManagerUpdateQueued(_lotteryManager, pendingLotteryManagerAt);
    }

    function executeLotteryManagerUpdate() external onlyOwner {
        uint256 executeAfter = pendingLotteryManagerAt;
        if (executeAfter == 0) revert NoPendingLotteryManager();
        if (block.timestamp < executeAfter) revert LotteryManagerUpdateTimelockActive(executeAfter);

        address next = pendingLotteryManager;
        pendingLotteryManager = address(0);
        pendingLotteryManagerAt = 0;
        lotteryManager = next;
        emit LotteryManagerSet(next);
    }

    /**
     * @notice Set agent treasury
     * @param _treasury Agent's treasury wallet
     */
    function setAgentTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0) && treasuryShareBps > 0) revert AgentTreasuryRequired();
        agentTreasury = _treasury;
        emit AgentTreasurySet(_treasury);
    }

    /**
     * @notice Set protocol treasury (multisig)
     * @param _treasury Protocol multisig address
     */
    function setProtocolTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        protocolTreasury = _treasury;
        emit ProtocolTreasurySet(_treasury);
    }

    /**
     * @notice Set the agent token address
     * @param _agentToken Agent token address (e.g., the AgentTokenV4)
     */
    function setAgentToken(address _agentToken) external onlyOwner {
        if (_agentToken == address(0)) revert ZeroAddress();
        _setAgentToken(_agentToken);
        _validateCoreWiring();
        emit AgentTokenSet(_agentToken);
    }

    /// @dev FIX: ODA-508-L9 — the oracle-floor math hardcodes 1e18 scaling (correct only for
    ///      18-decimal assets/shares, and nothing else enforced it). Reject a non-18-decimal
    ///      agent token at wire time; tokens without `decimals()` are left to the vault's
    ///      own asset binding check.
    function _setAgentToken(address _agentToken) internal {
        try IERC20Metadata(_agentToken).decimals() returns (uint8 tokenDecimals) {
            if (tokenDecimals != 18) revert Non18DecimalAgentToken(_agentToken, tokenDecimals);
        } catch {}
        agentToken = IERC20(_agentToken);
    }

    /**
     * @notice Set swap configuration for the WETH → ShareOFT buyback
     * @dev ODA-508-I2/I4: the inert `_feeTier` parameter was removed — routing is entirely
     *      determined by keeper-supplied `swapCalldata` + the `allowedSwapRouters` allowlist;
     *      the stored fee tier was never read and implied an on-chain price bound that does
     *      not exist. `_slippageBps` remains live (scales the oracle sanity floor).
     * @param _slippageBps Slippage tolerance in basis points
     */
    function setSwapConfig(uint256 _slippageBps) external onlyOwner {
        if (_slippageBps > 1000) revert InvalidSlippage(); // Max 10% slippage
        swapSlippageBps = _slippageBps;
        emit SwapConfigUpdated(_slippageBps);
    }

    /**
     * @notice Set keeper for processing large WETH fee batches.
     * @dev Owner is always authorized; keeper can be address(0) to disable.
     */
    function setWethFeeKeeper(address _keeper) external onlyOwner {
        address old = wethFeeKeeper;
        wethFeeKeeper = _keeper;
        emit WethFeeKeeperUpdated(old, _keeper);
    }

    /**
     * @notice Set the keeper WETH-processing cooldown in seconds (0 disables).
     * @dev ODA-508-8 — bounds keeper throughput over time; never gates the owner.
     */
    function setWethKeeperCooldown(uint256 _cooldown) external onlyOwner {
        wethKeeperCooldown = _cooldown;
        emit WethKeeperCooldownUpdated(_cooldown);
    }

    /**
     * @notice Configure keeper WETH buyback batch cap.
     * @param _maxPermissionlessWethProcess Max WETH per keeper `processWETHFeesWithRoute` (0 disables keeper swaps).
     * @param _autoProcessWethFees Ignored — auto-process on intake is permanently disabled (MEV);
     *        the inert storage flag was removed (ODA-508-I4).
     */
    function setWethProcessingConfig(uint256 _maxPermissionlessWethProcess, bool _autoProcessWethFees)
        external
        onlyOwner
    {
        maxPermissionlessWethProcess = _maxPermissionlessWethProcess;
        emit WethProcessingConfigUpdated(_maxPermissionlessWethProcess, false);
    }

    /**
     * @notice Allowlist a router for WETH→◆ buyback calldata execution.
     * @dev FIX: ODA-508-L4 — additions queue for `CONFIG_UPDATE_TIMELOCK` (an instant router
     *      pivot plus an oracle pivot is the WETH-drain path); removals stay immediate so a
     *      compromised router can be kicked without delay.
     */
    function setAllowedSwapRouter(address router, bool allowed) external onlyOwner {
        if (router == address(0)) revert ZeroAddress();
        if (!allowed) {
            allowedSwapRouters[router] = false;
            pendingRouterAllowlist[router] = 0;
            emit SwapRouterAllowlistUpdated(router, false);
            return;
        }
        if (allowedSwapRouters[router]) return;
        uint256 executeAfter = block.timestamp + CONFIG_UPDATE_TIMELOCK;
        pendingRouterAllowlist[router] = executeAfter;
        emit RouterAllowlistQueued(router, executeAfter);
    }

    /**
     * @notice Execute a queued router allowlisting after the timelock.
     */
    function executeRouterAllowlist(address router) external onlyOwner {
        uint256 executeAfter = pendingRouterAllowlist[router];
        if (executeAfter == 0) revert NoPendingRouterAllowlist();
        if (block.timestamp < executeAfter) revert RouterAllowlistTooEarly(executeAfter);
        pendingRouterAllowlist[router] = 0;
        allowedSwapRouters[router] = true;
        emit SwapRouterAllowlistUpdated(router, true);
    }

    /**
     * @notice Set the oracle for price-based slippage protection
     * @param _oracle AgentOracle address
     * @dev FIX: ODA-508-L4 — the first-ever set stays immediate (deploy wiring, no WETH at
     *      risk yet); subsequent changes queue for `CONFIG_UPDATE_TIMELOCK` so a malicious
     *      oracle substitution is observable before it can clear the fail-closed check.
     */
    function setOracle(address _oracle) external onlyOwner {
        // ODA-424-L10: disallow zero; disable slippage via `setOracleConfig(_, false)`.
        if (_oracle == address(0)) revert ZeroAddress();
        if (!oracleInitialized) {
            oracle = IOracle4626(_oracle);
            oracleInitialized = true;
            emit OracleSet(_oracle);
            return;
        }
        pendingOracle = _oracle;
        pendingOracleAt = block.timestamp + CONFIG_UPDATE_TIMELOCK;
        emit OracleUpdateQueued(_oracle, pendingOracleAt);
    }

    /**
     * @notice Execute a queued oracle change after the timelock.
     */
    function executeOracleUpdate() external onlyOwner {
        address _oracle = pendingOracle;
        uint256 executeAfter = pendingOracleAt;
        if (_oracle == address(0) || executeAfter == 0) revert NoPendingOracleUpdate();
        if (block.timestamp < executeAfter) revert OracleUpdateTooEarly(executeAfter);
        pendingOracle = address(0);
        pendingOracleAt = 0;
        oracle = IOracle4626(_oracle);
        emit OracleSet(_oracle);
    }

    /**
     * @notice Cancel a queued oracle change.
     */
    function cancelOracleUpdate() external onlyOwner {
        address _oracle = pendingOracle;
        if (_oracle == address(0) || pendingOracleAt == 0) revert NoPendingOracleUpdate();
        pendingOracle = address(0);
        pendingOracleAt = 0;
        emit OracleUpdateCancelled(_oracle);
    }

    /**
     * @notice Configure oracle settings
     * @param _twapDuration TWAP duration in seconds
     * @param _useOracle Whether to use oracle for slippage protection
     */
    function setOracleConfig(uint32 _twapDuration, bool _useOracle) external onlyOwner {
        // ODA-467-3/4: keep amountOutMinimum-only swaps (ODA-424-M3 griefing fix) and
        // raise the TWAP floor so permissionless pricing is not unbounded short-window.
        if (_twapDuration < MIN_ORACLE_TWAP_DURATION || _twapDuration > MAX_ORACLE_TWAP_DURATION) {
            revert InvalidTwapDuration();
        }
        oracleTwapDuration = _twapDuration;
        useOracleSlippage = _useOracle;
        emit OracleConfigUpdated(_twapDuration, _useOracle);
    }

    /// @notice Ownable renounce disabled — bricks config + emergency response (ODA-424-L8).
    /// @dev FIX: ODA-508-L8 — ownership transfers are two-step (Ownable2Step), so a mistyped
    ///      target is a harmless nomination, not an irreversible loss of config + emergency
    ///      response. Deploy flow: the batcher's `transferOwnership(protocolTreasury)`
    ///      nominates; the treasury completes the handoff with `acceptOwnership()`.
    function renounceOwnership() public pure override {
        revert OwnershipRenounceDisabled();
    }

    /**
     * @notice Set the voter rewards distributor to receive the 21.39% ShareOFT voter slice.
     * @dev If unset, we fall back to protocolTreasury.
     */
    function setve4626VoterRewardsDistributor(address _distributor) external onlyOwner {
        ve4626VoterRewardsDistributor = Ive4626VoterRewardsDistributor(_distributor);
        emit ve4626VoterRewardsDistributorUpdated(_distributor);
    }

    /**
     * @notice Set distribution threshold
     * @param _threshold Minimum OFT tokens before auto-distribution
     */
    function setDistributionThreshold(uint256 _threshold) external onlyOwner {
        distributionThreshold = _threshold;
        emit ThresholdUpdated(_threshold);
    }

    /**
     * @notice Set distribution interval
     * @param _interval Minimum time between distributions
     */
    function setDistributionInterval(uint256 _interval) external onlyOwner {
        if (_interval < MIN_DISTRIBUTION_INTERVAL || _interval > MAX_DISTRIBUTION_INTERVAL) {
            revert InvalidDistributionInterval();
        }
        distributionInterval = _interval;
        emit DistributionIntervalUpdated(_interval); // I-3: previously emitted nothing
    }

    // ================================
    // VIEW FUNCTIONS
    // ================================

    /**
     * @notice Get current fee split configuration
     */
    function getFeeSplit() external pure returns (uint256 burn, uint256 lottery, uint256 treasury, uint256 protocol) {
        return (burnShareBps, lotteryShareBps, treasuryShareBps, protocolShareBps);
    }

    /**
     * @notice Preview how pending ShareOFT fees would be distributed
     * @dev FIX: ODA-508-L6 — ALL four return values are ShareOFT (◆) units, including `toBurn`
     *      (it is derived from `pendingFees`, which is ◆). The actual vault shares (◇) burned
     *      on execution are the wrapper unwrap output: ~`toBurn * NORMALIZATION_FACTOR` (1000)
     *      minus `unwrapFee`. Do not compare `toBurn` against `totalSharesBurned` (◇) or feed
     *      it to `estimatePPSIncrease` (◇) without that conversion.
     */
    function previewDistribution()
        external
        view
        returns (uint256 toBurn, uint256 toLottery, uint256 toTreasury, uint256 toProtocol)
    {
        toLottery = (pendingFees * lotteryShareBps) / MAX_BPS;
        toTreasury = (pendingFees * treasuryShareBps) / MAX_BPS;
        toProtocol = (pendingFees * protocolShareBps) / MAX_BPS;
        toBurn = pendingFees - toLottery - toTreasury - toProtocol;
    }

    /**
     * @notice Get lifetime statistics
     * @dev ODA-508-L6 unit note: `_totalSharesBurned` is ◇ vault shares; `_totalFeesReceived`,
     *      `_totalLotteryFunded`, `_totalTreasuryEarned`, `_totalProtocolEarned`,
     *      `_pendingFees`, `_jackpotReserve` are ◆ ShareOFT; `_totalWETHFeesReceived` and
     *      `_pendingWETHFees` are WETH.
     */
    function getStats()
        external
        view
        returns (
            uint256 _totalFeesReceived,
            uint256 _totalWETHFeesReceived,
            uint256 _totalSharesBurned,
            uint256 _totalLotteryFunded,
            uint256 _totalTreasuryEarned,
            uint256 _totalProtocolEarned,
            uint256 _pendingFees,
            uint256 _pendingWETHFees,
            uint256 _jackpotReserve,
            uint256 _lastDistribution
        )
    {
        return (
            totalFeesReceived,
            totalWETHFeesReceived,
            totalSharesBurned,
            totalLotteryFunded,
            totalTreasuryEarned,
            totalProtocolEarned,
            pendingFees,
            pendingWETHFees,
            jackpotReserve,
            lastDistribution
        );
    }

    /**
     * @notice Get total pending fees (both OFT and WETH)
     */
    function getTotalPendingFees()
        external
        view
        returns (uint256 oftPending, uint256 wethPending, uint256 totalPending)
    {
        return (pendingFees, pendingWETHFees, pendingFees + pendingWETHFees);
    }

    /**
     * @notice Check if distribution is possible
     */
    function canDistribute() external view returns (bool) {
        return pendingFees >= distributionThreshold && block.timestamp >= lastDistribution + distributionInterval;
    }

    /**
     * @notice Time until next possible distribution
     */
    function timeUntilDistribution() external view returns (uint256) {
        if (block.timestamp >= lastDistribution + distributionInterval) return 0;
        return (lastDistribution + distributionInterval) - block.timestamp;
    }

    /**
     * @notice Estimate PPS increase from burning shares
     * @param sharesToBurn Amount of shares that would be burned (◇ vault-share units)
     */
    function estimatePPSIncrease(uint256 sharesToBurn) external view returns (uint256 ppsIncrease) {
        if (address(vault) == address(0)) return 0;

        uint256 totalAssets = vault.totalAssets();
        uint256 totalSupply = vault.totalSupply();

        if (totalSupply == 0 || totalSupply <= sharesToBurn) return 0;

        // FIX: ODA-508-I8 — use the vault's virtual-offset PPS formula
        // ((assets + 1) * 1e18 / (supply + 1000)) so the preview agrees with
        // `vault.pricePerShare()` exactly instead of diverging by the offset.
        uint256 currentPPS = ((totalAssets + 1) * 1e18) / (totalSupply + 1000);

        // PPS after burn
        uint256 newPPS = ((totalAssets + 1) * 1e18) / (totalSupply - sharesToBurn + 1000);

        ppsIncrease = newPPS > currentPPS ? newPPS - currentPPS : 0;
    }

    /**
     * @notice Get vault info
     */
    function getVaultInfo() external view returns (uint256 totalAssets, uint256 totalSupply, uint256 pricePerShare) {
        if (address(vault) == address(0)) return (0, 0, 0);

        totalAssets = vault.totalAssets();
        totalSupply = vault.totalSupply();
        pricePerShare = vault.pricePerShare();
    }

    /**
     * @notice Preview oracle floor for WETH → ShareOFT (◆) buyback
     */
    function previewSwap(uint256 wethAmount)
        external
        view
        returns (uint256 expectedOut, uint256 minOut, bool oracleActive)
    {
        oracleActive = useOracleSlippage && address(oracle) != address(0);

        if (!oracleActive) {
            return (0, 0, false);
        }

        // FIX: ODA-508-L7 — gate on freshness like `_calculateMinOutput` does, so the preview
        // cannot report a usable `minOut` derived from a price the executing path rejects.
        try oracle.isPriceFresh() returns (bool fresh) {
            if (!fresh) return (0, 0, false);
        } catch {
            return (0, 0, false);
        }

        try oracle.getAssetEthTWAP(oracleTwapDuration) returns (uint256 assetPerEth) {
            expectedOut = _expectedShareOftFromAssetTwap(wethAmount, assetPerEth);
            if (expectedOut == 0) return (0, 0, false);

            minOut = Math.mulDiv(expectedOut, (MAX_BPS - swapSlippageBps), MAX_BPS);
            oracleActive = true;
        } catch {
            return (0, 0, false);
        }
    }

    /**
     * @notice Get oracle info
     */
    function getOracleInfo()
        external
        view
        returns (
            address oracleAddress,
            bool isActive,
            bool priceFresh,
            int256 assetPriceUSD,
            uint32 twapDuration,
            uint256 slippageBps
        )
    {
        oracleAddress = address(oracle);
        isActive = useOracleSlippage && oracleAddress != address(0);
        twapDuration = oracleTwapDuration;
        slippageBps = swapSlippageBps;

        if (oracleAddress != address(0)) {
            try oracle.isPriceFresh() returns (bool fresh) {
                priceFresh = fresh;
            } catch {}

            try oracle.getAssetPrice() returns (int256 price, uint256) {
                assetPriceUSD = price;
            } catch {}
        }
    }

    // ================================
    // EMERGENCY
    // ================================

    // FIX: ODA-508-6 — creator-lane parity: the agent gauge had dropped the 1-day
    // queue/cancel/execute timelock and transferred in the same call.
    address public pendingEmergencyWithdrawToken;
    uint256 public pendingEmergencyWithdrawAmount;
    address public pendingEmergencyWithdrawTo;
    uint256 public pendingEmergencyWithdrawAt;

    /**
     * @notice Queue an emergency withdraw (owner only, 1-day timelock).
     * @dev Transfers nothing; `executeEmergencyWithdraw` performs the transfer after
     *      `EMERGENCY_WITHDRAW_DELAY`. `token == address(0)` sweeps native ETH force-fed
     *      via SELFDESTRUCT (ODA-508-L5).
     * @param token Token to withdraw (address(0) = native ETH)
     * @param amount Amount to withdraw
     * @param to Recipient
     */
    function emergencyWithdraw(address token, uint256 amount, address to) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        pendingEmergencyWithdrawToken = token;
        pendingEmergencyWithdrawAmount = amount;
        pendingEmergencyWithdrawTo = to;
        pendingEmergencyWithdrawAt = block.timestamp + EMERGENCY_WITHDRAW_DELAY;
        emit EmergencyWithdrawQueued(token, amount, to, pendingEmergencyWithdrawAt);
    }

    function cancelEmergencyWithdraw() external onlyOwner nonReentrant {
        address token = pendingEmergencyWithdrawToken;
        uint256 amount = pendingEmergencyWithdrawAmount;
        address to = pendingEmergencyWithdrawTo;
        if (to == address(0) || amount == 0) revert NoPendingEmergencyWithdraw();

        pendingEmergencyWithdrawToken = address(0);
        pendingEmergencyWithdrawAmount = 0;
        pendingEmergencyWithdrawTo = address(0);
        pendingEmergencyWithdrawAt = 0;
        emit EmergencyWithdrawCancelled(token, amount, to);
    }

    function executeEmergencyWithdraw() external onlyOwner nonReentrant {
        address token = pendingEmergencyWithdrawToken;
        uint256 amount = pendingEmergencyWithdrawAmount;
        address to = pendingEmergencyWithdrawTo;
        uint256 executeAfter = pendingEmergencyWithdrawAt;
        if (to == address(0) || amount == 0 || executeAfter == 0) revert NoPendingEmergencyWithdraw();
        if (block.timestamp < executeAfter) revert EmergencyWithdrawTooEarly(executeAfter);

        pendingEmergencyWithdrawToken = address(0);
        pendingEmergencyWithdrawAmount = 0;
        pendingEmergencyWithdrawTo = address(0);
        pendingEmergencyWithdrawAt = 0;

        // FIX: ODA-508-L5 — native-ETH sweep for force-fed (SELFDESTRUCT) ETH; `receive()`
        // wraps everything else, so a raw balance can only arrive via selfdestruct.
        if (token == address(0)) {
            (bool ok,) = payable(to).call{value: amount}("");
            if (!ok) revert NativeSweepFailed();
            return;
        }

        // FIX: AUDIT-2026-07-01-M01 — block jackpot custody drain while reserves remain.
        if (token == address(shareOFT) && (jackpotReserve > 0 || pendingFees > 0)) {
            revert JackpotReserveProtected();
        }
        if (token == address(shareOFT)) {
            if (amount >= accountedOFTBalance) {
                accountedOFTBalance = 0;
            } else {
                accountedOFTBalance -= amount;
            }
        }
        // ODA-424-L3: protect only earmarked pending WETH fees. Owner may withdraw
        // surplus WETH (donations / dust) so griefers cannot block rescue by
        // donating 1 wei via `receive()` after the timelock elapses.
        if (token == WETH) {
            uint256 bal = IERC20(WETH).balanceOf(address(this));
            uint256 free = bal > pendingWETHFees ? bal - pendingWETHFees : 0;
            if (amount > free) revert PendingWethFeesProtected();
        }
        IERC20(token).safeTransfer(to, amount);
    }

    /**
     * @notice Queue a write-down of the stranded WETH earmark (owner only, 1-day timelock).
     * @dev FIX: ODA-508-2 — when the sole WETH exit fails closed (oracle unavailable), the
     *      earmark is otherwise unreachable: the emergency path refuses protected WETH.
     *      Writing the earmark down converts it to surplus, which `executeEmergencyWithdraw`
     *      can then withdraw (itself behind the same delay — rescue takes two timelocks).
     * @param amount Amount of `pendingWETHFees` to write down (capped at current earmark)
     */
    function queueWriteDownPendingWETHFees(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > pendingWETHFees) amount = pendingWETHFees;
        pendingWethWriteDownAmount = amount;
        pendingWethWriteDownAt = block.timestamp + EMERGENCY_WITHDRAW_DELAY;
        emit PendingWethFeesWriteDownQueued(amount, pendingWethWriteDownAt);
    }

    function cancelWriteDownPendingWETHFees() external onlyOwner nonReentrant {
        uint256 amount = pendingWethWriteDownAmount;
        if (amount == 0) revert NoPendingWethWriteDown();
        pendingWethWriteDownAmount = 0;
        pendingWethWriteDownAt = 0;
        emit PendingWethFeesWriteDownCancelled(amount);
    }

    function executeWriteDownPendingWETHFees() external onlyOwner nonReentrant {
        uint256 amount = pendingWethWriteDownAmount;
        uint256 executeAfter = pendingWethWriteDownAt;
        if (amount == 0 || executeAfter == 0) revert NoPendingWethWriteDown();
        if (block.timestamp < executeAfter) revert WethWriteDownTooEarly(executeAfter);

        pendingWethWriteDownAmount = 0;
        pendingWethWriteDownAt = 0;

        // Re-cap: the earmark may have shrunk (partial processing) since queueing.
        if (amount > pendingWETHFees) amount = pendingWETHFees;
        pendingWETHFees -= amount;
        emit PendingWethFeesWrittenDown(amount);
    }

    function _validateCoreWiring() internal view {
        if (address(vault) != address(0) && address(agentToken) != address(0)) {
            if (vault.asset() != address(agentToken)) revert InvalidVaultAssetBinding();
        }
        if (address(wrapper) != address(0) && address(vault) != address(0)) {
            if (wrapper.vaultShares() != address(vault)) revert InvalidWrapperVaultBinding();
        }
    }
}
