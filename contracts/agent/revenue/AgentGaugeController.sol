// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IOracle4626} from "@4626/shared/interfaces/oracles/IOracle4626.sol";

interface IAgentOVault {
    function burnSharesForPriceIncrease(uint256 shares) external;
    function pricePerShare() external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function totalAssets() external view returns (uint256);
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function asset() external view returns (address);
}

interface IAgentOVaultWrapper {
    function wrap(uint256 amount) external returns (uint256);
    function unwrap(uint256 amount) external returns (uint256);
    function vaultShares() external view returns (address);
    function previewWrap(uint256 amount, address user) external view returns (uint256);
}

interface ILotteryManager4626 {
    function addToJackpot(address token, uint256 amount) external;
}

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
}

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface Ive4626GaugeVoting {
    function getVaultWeight(address vault) external view returns (uint256);
    function getTotalWeight() external view returns (uint256);
    function getVaultWeightBps(address vault) external view returns (uint256);
    function currentEpoch() external view returns (uint256);
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
contract AgentGaugeController is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================
    // CONSTANTS
    // ================================

    uint256 public constant MAX_BPS = 10000;
    uint256 public constant LOTTERY_MANAGER_UPDATE_TIMELOCK = 1 days;

    /// @notice WETH on Base
    address public constant WETH = 0x4200000000000000000000000000000000000006;

    /// @notice Uniswap V3 Router on Base (for WETH → AgentToken swaps)
    address public constant SWAP_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;

    /// @notice Default swap fee tier (0.3%)
    uint24 public constant DEFAULT_SWAP_FEE = 3000;

    // Uniswap v3 math constants for sqrtPriceLimitX96 bounds.
    uint256 private constant Q192 = 1 << 192;
    uint160 private constant MIN_SQRT_RATIO = 4295128739;
    uint160 private constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

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

    /// @notice Lottery manager for jackpot
    ILotteryManager4626 public lotteryManager;
    ILotteryManager4626 public pendingLotteryManager;
    uint256 public pendingLotteryManagerAt;

    /// @notice Agent's treasury wallet
    address public agentTreasury;

    /// @notice Protocol multisig (4626 treasury)
    address public protocolTreasury;

    /// @notice Swap fee tier for WETH → AgentToken
    uint24 public swapFeeTier = DEFAULT_SWAP_FEE;

    /// @notice Slippage tolerance for swaps (in bps, default 100 = 1%)
    uint256 public swapSlippageBps = 100;

    /// @notice Oracle for price-based slippage protection
    IOracle4626 public oracle;

    /// @notice TWAP duration for oracle price (default 30 min)
    uint32 public oracleTwapDuration = 1800;

    /// @notice Whether to use oracle for slippage (if false, uses 0 minimum)
    bool public useOracleSlippage = true;

    // FIX: G-12 — fallback minimum output percentage when oracle is disabled/unavailable
    // Expressed in bps (e.g., 9000 = 90% of input value assumed 1:1 as floor)
    uint256 public fallbackMinOutputBps = 0;

    /// @notice ve4626GaugeVoting for ve(3,3) probability direction
    Ive4626GaugeVoting public ve4626GaugeVoting;

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

    /// @notice Total vault shares burned (lifetime)
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

    /// @notice Deprecated: auto-swap on intake is permanently disabled (MEV). Kept for storage/ABI layout.
    bool public autoProcessWethFees;

    /// @notice Allowlisted routers for keeper WETH→◆ buyback calldata.
    mapping(address => bool) public allowedSwapRouters;

    // ================================
    // EVENTS
    // ================================

    event FeesReceived(address indexed from, uint256 oftAmount);
    event WETHFeesReceived(address indexed from, uint256 wethAmount);
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
    event SwapConfigUpdated(uint24 feeTier, uint256 slippageBps);
    event OracleSet(address indexed oracle);
    event OracleConfigUpdated(uint32 twapDuration, bool useOracle);
    event ve4626GaugeVotingUpdated(address indexed ve4626GaugeVoting);
    event ve4626VoterRewardsDistributorUpdated(address indexed distributor);

    event WethFeeKeeperUpdated(address indexed oldKeeper, address indexed newKeeper);
    event WethProcessingConfigUpdated(uint256 maxPermissionlessWethProcess, bool autoProcessWethFees);

    // ================================
    // ERRORS
    // ================================

    error ZeroAddress();
    error NothingToDistribute();
    error TooSoon();
    error VaultNotSet();
    error WrapperNotSet();
    error AgentTokenNotSet();
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
    error PendingOftFeesProtected();
    error PendingWethFeesProtected();
    error NoPendingLotteryManager();
    error LotteryManagerUpdateTimelockActive(uint256 executeAfter);
    error FallbackMinOutputDisabled();
    error OwnershipRenounceDisabled();
    error InvalidFeeTier();
    error InvalidDistributionInterval();
    error InvalidTwapDuration();
    error RouterNotAllowed();
    error RoutedSwapRequired();

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

        // FIX: L-03 (4626-351) — constant WETH / SWAP_ROUTER addresses above
        // are hardcoded to Base (chain id 8453). Deploying this controller to
        // any other chain would silently succeed but every swap path would
        // target addresses that do not exist on that chain, bricking fee
        // routing. Assert chain id at construction so misdeployment fails
        // fast rather than on the first swap attempt.
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

        // Pull OFT tokens from sender
        shareOFT.safeTransferFrom(msg.sender, address(this), amount);
        pendingFees += amount;
        // FIX: G-11 — track OFT balance
        accountedOFTBalance += amount;
        totalFeesReceived += amount;

        emit FeesReceived(msg.sender, amount);

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

        shareOFT.safeTransferFrom(msg.sender, address(this), amount);
        pendingFees += amount;
        // FIX: G-11 — track OFT balance
        accountedOFTBalance += amount;
        totalFeesReceived += amount;

        emit FeesReceived(msg.sender, amount);
    }

    /**
     * @notice Account for OFT tokens that arrived via cross-chain fee flush
     * @dev When remote AgentShareOFTs flush fees via OFT send(), the tokens
     *      are minted directly to this contract by LayerZero's _credit().
     *      This function sweeps the unaccounted balance into pendingFees.
     *
     *      Permissionless — anyone can trigger this (keeper, owner, etc.)
     */
    // FIX: G-11 — track explicitly how much OFT the contract expects to hold
    uint256 public accountedOFTBalance;

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

        // Pull WETH from sender (the tax hook)
        IERC20(WETH).safeTransferFrom(msg.sender, address(this), amount);
        pendingWETHFees += amount;
        totalWETHFeesReceived += amount;

        emit WETHFeesReceived(msg.sender, amount);
        // MEV: never auto-swap on intake. Keepr submits `processWETHFeesWithRoute` privately.
    }

    /**
     * @notice Receive native ETH (e.g., from tax hook that sends ETH directly)
     */
    receive() external payable {
        if (msg.value == 0) return;

        // Wrap ETH to WETH
        IWETH(WETH).deposit{value: msg.value}();
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
        if (oracleMin == 0) revert MinOutputUnavailable();
        uint256 minOut = minShareOftOut > oracleMin ? minShareOftOut : oracleMin;

        pendingWETHFees -= wethAmount;

        uint256 oftBefore = shareOFT.balanceOf(address(this));
        uint256 wethBefore = IERC20(WETH).balanceOf(address(this));

        IERC20(WETH).forceApprove(router, wethAmount);
        (bool ok,) = router.call(swapCalldata);
        IERC20(WETH).forceApprove(router, 0);
        if (!ok) revert SwapFailed();

        uint256 wethAfter = IERC20(WETH).balanceOf(address(this));
        if (wethAfter > wethBefore || wethBefore - wethAfter != wethAmount) revert SwapFailed();

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

    /**
     * @notice Derive sqrtPriceLimitX96 from an oracle-derived minOut.
     * @dev Uniswap v3 price is expressed as sqrt(token1/token0) Q64.96, where token0/token1 are sorted by address.
     *      We compute a limit price from `minAmountOut / amountIn` (or its inverse), scale to Q192, then sqrt.
     *      - If WETH is token0: swap is token0->token1 (zeroForOne), price decreases, so we enforce a MIN price.
     *      - If WETH is token1: swap is token1->token0 (oneForZero), price increases, so we enforce a MAX price.
     */
    function _sqrtPriceLimitX96(uint256 amountIn, uint256 minAmountOut)
        internal
        view
        returns (uint160 sqrtPriceLimitX96)
    {
        if (amountIn == 0 || minAmountOut == 0) return 0;

        address tokenIn = WETH;
        address tokenOut = address(agentToken);
        bool tokenInIsToken0 = tokenIn < tokenOut;

        // Uniswap pool bounds require: MIN_SQRT_RATIO < limit < MAX_SQRT_RATIO
        uint160 minLimit = MIN_SQRT_RATIO + 1;
        uint160 maxLimit = MAX_SQRT_RATIO - 1;

        uint256 priceX192 = tokenInIsToken0
            ? Math.mulDiv(minAmountOut, Q192, amountIn)  // token1/token0 (min)
            : Math.mulDiv(amountIn, Q192, minAmountOut); // token1/token0 (max)

        uint256 sqrtP = tokenInIsToken0 ? Math.sqrt(priceX192, Math.Rounding.Ceil) : Math.sqrt(priceX192);

        if (sqrtP <= minLimit) return minLimit;
        if (sqrtP >= maxLimit) return maxLimit;
        return uint160(sqrtP);
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

    /**
     * @notice Internal function to distribute vault shares from the WETH/tax-hook path
     * @dev Wraps lottery + voter slices to ShareOFT; burns the burn slice as vault shares.
     */
    function _distributeVaultShares(uint256 vaultSharesReceived) internal {
        if (vaultSharesReceived == 0) return;
        if (address(vault) == address(0)) revert VaultNotSet();

        lastWethDistribution = block.timestamp;

        uint256 toBurn = (vaultSharesReceived * burnShareBps) / MAX_BPS;
        uint256 toLotteryVs = (vaultSharesReceived * lotteryShareBps) / MAX_BPS;
        uint256 toTreasuryVs = (vaultSharesReceived * treasuryShareBps) / MAX_BPS;
        uint256 toVotersVs = vaultSharesReceived - toBurn - toLotteryVs - toTreasuryVs;

        uint256 toLotteryOft;
        uint256 toVotersOft;

        if (toLotteryVs > 0) {
            toLotteryOft = _wrapVaultSharesToShareOft(toLotteryVs);
            if (toLotteryOft > 0) {
                jackpotReserve += toLotteryOft;
                totalLotteryFunded += toLotteryOft;
                accountedOFTBalance += toLotteryOft;
            }
        }

        if (toTreasuryVs > 0 && agentTreasury != address(0)) {
            vaultShares.safeTransfer(agentTreasury, toTreasuryVs);
            totalTreasuryEarned += toTreasuryVs;
        } else if (toTreasuryVs > 0) {
            uint256 treasuryOft = _wrapVaultSharesToShareOft(toTreasuryVs);
            if (treasuryOft > 0) {
                jackpotReserve += treasuryOft;
                totalLotteryFunded += treasuryOft;
                accountedOFTBalance += treasuryOft;
                toLotteryOft += treasuryOft;
            }
        }

        if (toVotersVs > 0) {
            toVotersOft = _wrapVaultSharesToShareOft(toVotersVs);
            _routeVoterShareOft(toVotersOft);
        }

        if (toBurn > 0) {
            vaultShares.forceApprove(address(vault), toBurn);
            vault.burnSharesForPriceIncrease(toBurn);
            totalSharesBurned += toBurn;
            emit SharesBurned(toBurn, vault.pricePerShare());
        }

        emit FeesDistributed(toBurn, toLotteryOft, toTreasuryVs, toVotersOft, vault.pricePerShare());
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

    function _wrapVaultSharesToShareOft(uint256 vaultShareAmount) internal returns (uint256 oftOut) {
        if (vaultShareAmount == 0) return 0;
        if (address(wrapper) == address(0)) revert WrapperNotSet();

        vaultShares.forceApprove(address(wrapper), vaultShareAmount);
        oftOut = IAgentOVaultWrapper(address(wrapper)).wrap(vaultShareAmount);
    }

    function _burnShareOftSlice(uint256 oftAmount) internal returns (uint256 vaultSharesBurned) {
        if (oftAmount == 0) return 0;
        if (address(wrapper) == address(0)) revert WrapperNotSet();

        // ODA-467-[1] (agent lane parity): bridged ShareOFT has no wrap accounting.
        shareOFT.forceApprove(address(wrapper), oftAmount);
        try wrapper.unwrap(oftAmount) returns (uint256 unwrapped) {
            vaultSharesBurned = unwrapped;
        } catch {
            shareOFT.forceApprove(address(wrapper), 0);
            jackpotReserve += oftAmount;
            totalLotteryFunded += oftAmount;
            accountedOFTBalance += oftAmount;
            return 0;
        }

        vaultShares.forceApprove(address(vault), vaultSharesBurned);
        vault.burnSharesForPriceIncrease(vaultSharesBurned);
        totalSharesBurned += vaultSharesBurned;

        emit SharesBurned(vaultSharesBurned, vault.pricePerShare());
    }

    function _routeVoterShareOft(uint256 toVoters) internal {
        if (toVoters == 0) return;

        if (address(ve4626VoterRewardsDistributor) != address(0)) {
            uint256 balanceBefore = shareOFT.balanceOf(address(this));
            shareOFT.forceApprove(address(ve4626VoterRewardsDistributor), toVoters);
            try ve4626VoterRewardsDistributor.notifyRewards(address(vault), address(shareOFT), toVoters) {
                uint256 balanceAfter = shareOFT.balanceOf(address(this));
                uint256 spent = balanceBefore > balanceAfter ? balanceBefore - balanceAfter : 0;
                if (spent > toVoters) spent = toVoters;

                if (spent > 0) {
                    totalProtocolEarned += spent;
                }

                uint256 remainder = toVoters - spent;
                if (remainder > 0) {
                    if (protocolTreasury != address(0)) {
                        shareOFT.safeTransfer(protocolTreasury, remainder);
                        totalProtocolEarned += remainder;
                    } else {
                        jackpotReserve += remainder;
                        totalLotteryFunded += remainder;
                        accountedOFTBalance += remainder;
                    }
                }
                // Clear allowance on success too, so a partial-spend distributor
                // cannot retain stale spend permissions between distributions.
                shareOFT.forceApprove(address(ve4626VoterRewardsDistributor), 0);
            } catch {
                shareOFT.forceApprove(address(ve4626VoterRewardsDistributor), 0);
                if (protocolTreasury != address(0)) {
                    shareOFT.safeTransfer(protocolTreasury, toVoters);
                    totalProtocolEarned += toVoters;
                } else {
                    jackpotReserve += toVoters;
                    totalLotteryFunded += toVoters;
                    accountedOFTBalance += toVoters;
                }
            }
        } else if (protocolTreasury != address(0)) {
            shareOFT.safeTransfer(protocolTreasury, toVoters);
            totalProtocolEarned += toVoters;
        } else {
            jackpotReserve += toVoters;
            totalLotteryFunded += toVoters;
            accountedOFTBalance += toVoters;
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
     * @param winner Winner's address
     * @param amount Amount of ShareOFT to pay
     */
    function payJackpot(address winner, uint256 amount) external nonReentrant {
        if (msg.sender != address(lotteryManager)) revert OnlyLotteryManager();
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
     * @notice Set the lottery manager
     * @dev First set is immediate (deploy wiring). Later non-zero reassignments are
     *      timelocked (ODA-424-M2). ODA-467-2: address(0) revokes immediately and
     *      cancels any pending update.
     * @param _lotteryManager Lottery manager address
     */
    function setLotteryManager(address _lotteryManager) external onlyOwner {
        if (_lotteryManager == address(0)) {
            pendingLotteryManager = ILotteryManager4626(address(0));
            pendingLotteryManagerAt = 0;
            lotteryManager = ILotteryManager4626(address(0));
            emit LotteryManagerSet(address(0));
            return;
        }
        if (address(lotteryManager) == address(0)) {
            lotteryManager = ILotteryManager4626(_lotteryManager);
            emit LotteryManagerSet(_lotteryManager);
            return;
        }
        pendingLotteryManager = ILotteryManager4626(_lotteryManager);
        pendingLotteryManagerAt = block.timestamp + LOTTERY_MANAGER_UPDATE_TIMELOCK;
        emit LotteryManagerUpdateQueued(_lotteryManager, pendingLotteryManagerAt);
    }

    function executeLotteryManagerUpdate() external onlyOwner {
        uint256 executeAfter = pendingLotteryManagerAt;
        if (executeAfter == 0) revert NoPendingLotteryManager();
        if (block.timestamp < executeAfter) revert LotteryManagerUpdateTimelockActive(executeAfter);

        ILotteryManager4626 next = pendingLotteryManager;
        pendingLotteryManager = ILotteryManager4626(address(0));
        pendingLotteryManagerAt = 0;
        lotteryManager = next;
        emit LotteryManagerSet(address(next));
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
        agentToken = IERC20(_agentToken);
        _validateCoreWiring();
        emit AgentTokenSet(_agentToken);
    }

    /**
     * @notice Set swap configuration for WETH → AgentToken
     * @param _feeTier Uniswap fee tier (100, 500, 3000, 10000)
     * @param _slippageBps Slippage tolerance in basis points
     */
    function setSwapConfig(uint24 _feeTier, uint256 _slippageBps) external onlyOwner {
        if (_slippageBps > 1000) revert InvalidSlippage(); // Max 10% slippage
        // ODA-467-6: whitelist Uniswap v3 fee tiers only.
        if (_feeTier != 100 && _feeTier != 500 && _feeTier != 3000 && _feeTier != 10000) {
            revert InvalidFeeTier();
        }
        swapFeeTier = _feeTier;
        swapSlippageBps = _slippageBps;
        emit SwapConfigUpdated(_feeTier, _slippageBps);
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
     * @notice Configure keeper WETH buyback batch cap.
     * @param _maxPermissionlessWethProcess Max WETH per keeper `processWETHFeesWithRoute` (0 disables keeper swaps).
     * @param _autoProcessWethFees Ignored — auto-process on intake is permanently disabled (MEV).
     */
    function setWethProcessingConfig(uint256 _maxPermissionlessWethProcess, bool _autoProcessWethFees)
        external
        onlyOwner
    {
        maxPermissionlessWethProcess = _maxPermissionlessWethProcess;
        if (_autoProcessWethFees) {
            // no-op: intake auto-swap removed
        }
        autoProcessWethFees = false;
        emit WethProcessingConfigUpdated(_maxPermissionlessWethProcess, false);
    }

    /**
     * @notice Allowlist a router for WETH→◆ buyback calldata execution.
     */
    function setAllowedSwapRouter(address router, bool allowed) external onlyOwner {
        if (router == address(0)) revert ZeroAddress();
        allowedSwapRouters[router] = allowed;
        emit SwapRouterAllowlistUpdated(router, allowed);
    }

    /**
     * @notice Set the oracle for price-based slippage protection
     * @param _oracle AgentOracle address
     */
    function setOracle(address _oracle) external onlyOwner {
        // ODA-424-L10: disallow zero; disable slippage via `setOracleConfig(_, false)`.
        if (_oracle == address(0)) revert ZeroAddress();
        oracle = IOracle4626(_oracle);
        emit OracleSet(_oracle);
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

    // ODA-424-M1: unit-mismatched fallback removed; only clearing to 0 is allowed.
    function setFallbackMinOutputBps(uint256 _bps) external onlyOwner {
        if (_bps != 0) revert FallbackMinOutputDisabled();
        fallbackMinOutputBps = 0;
    }

    /// @notice Ownable renounce disabled — bricks config + emergency response (ODA-424-L8).
    function renounceOwnership() public pure override {
        revert OwnershipRenounceDisabled();
    }

    /**
     * @notice Set ve4626GaugeVoting for ve(3,3) probability direction
     * @param _ve4626GaugeVoting Address of the ve4626GaugeVoting contract
     */
    function setve4626GaugeVoting(address _ve4626GaugeVoting) external onlyOwner {
        ve4626GaugeVoting = Ive4626GaugeVoting(_ve4626GaugeVoting);
        emit ve4626GaugeVotingUpdated(_ve4626GaugeVoting);
    }

    /**
     * @notice Set the voter rewards distributor to receive the 21.39% ShareOFT voter slice.
     * @dev If unset, we fall back to protocolTreasury (or jackpot if that is unset).
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
        if (_interval > MAX_DISTRIBUTION_INTERVAL) revert InvalidDistributionInterval();
        distributionInterval = _interval;
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
     * @dev Lottery and voter amounts are ShareOFT (◆); burn preview is approximate vault-share units after unwrap.
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
     * @param sharesToBurn Amount of shares that would be burned
     */
    function estimatePPSIncrease(uint256 sharesToBurn) external view returns (uint256 ppsIncrease) {
        if (address(vault) == address(0)) return 0;

        uint256 totalAssets = vault.totalAssets();
        uint256 totalSupply = vault.totalSupply();

        if (totalSupply == 0 || totalSupply <= sharesToBurn) return 0;

        // Current PPS
        uint256 currentPPS = (totalAssets * 1e18) / totalSupply;

        // PPS after burn
        uint256 newPPS = (totalAssets * 1e18) / (totalSupply - sharesToBurn);

        ppsIncrease = newPPS - currentPPS;
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

    /**
     * @notice Emergency withdraw (owner only)
     * @param token Token to withdraw
     * @param amount Amount to withdraw
     * @param to Recipient
     */
    function emergencyWithdraw(address token, uint256 amount, address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        // FIX: AUDIT-2026-07-01-M01 — block jackpot custody drain while reserves remain.
        if (token == address(shareOFT) && (jackpotReserve > 0 || pendingFees > 0)) {
            revert JackpotReserveProtected();
        }
        if (token == address(shareOFT)) {
            if (pendingFees > 0) revert PendingOftFeesProtected();
            if (amount >= accountedOFTBalance) {
                accountedOFTBalance = 0;
            } else {
                accountedOFTBalance -= amount;
            }
        }
        // ODA-424-L3: protect only earmarked pending WETH; surplus remains withdrawable.
        if (token == WETH) {
            uint256 bal = IERC20(WETH).balanceOf(address(this));
            uint256 free = bal > pendingWETHFees ? bal - pendingWETHFees : 0;
            if (amount > free) revert PendingWethFeesProtected();
        }
        IERC20(token).safeTransfer(to, amount);
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
