// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

interface ICreatorOVault {
    function burnSharesForPriceIncrease(uint256 shares) external;
    function pricePerShare() external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function totalAssets() external view returns (uint256);
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function asset() external view returns (address);
}

interface ICreatorOVaultWrapper {
    function unwrap(uint256 amount) external returns (uint256);
    function vaultShares() external view returns (address);
}

interface ICreatorLotteryManager {
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

interface ICreatorOracle {
    function getCreatorPrice() external view returns (int256 price, uint256 timestamp);
    function getEthPrice() external view returns (int256 price, uint256 timestamp);
    function getCreatorEthTWAP(uint32 duration) external view returns (uint256 price);
    function isPriceFresh() external view returns (bool);
}

interface IVaultGaugeVoting {
    function getVaultWeight(address vault) external view returns (uint256);
    function getTotalWeight() external view returns (uint256);
    function getVaultWeightBps(address vault) external view returns (uint256);
    function currentEpoch() external view returns (uint256);
}

interface IVoterRewardsDistributor {
    function notifyRewards(address vault, address token, uint256 amount) external;
}

/**
 * @title CreatorGaugeController
 * @author 0xakita.eth
 * @notice Fee splitter and gauge controller for creator vaults.
 * @dev Routes swap fees to lottery, burn, and protocol allocations.
 */
contract CreatorGaugeController is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================
    // CONSTANTS
    // ================================

    uint256 public constant MAX_BPS = 10000;

    /// @notice WETH on Base
    address public constant WETH = 0x4200000000000000000000000000000000000006;

    /// @notice Uniswap V3 Router on Base (for WETH → CreatorCoin swaps)
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

    /// @notice The ShareOFT token (e.g., ■AKITA) - what we receive as fees
    IERC20 public immutable shareOFT;

    /// @notice The underlying Creator Coin (e.g., akita)
    IERC20 public creatorCoin;

    /// @notice The wrapper to unwrap OFT → vault shares
    ICreatorOVaultWrapper public wrapper;

    /// @notice The ERC-4626 vault (e.g., ▢AKITA)
    ICreatorOVault public vault;

    /// @notice Vault shares token (same as vault address, but as IERC20)
    IERC20 public vaultShares;

    /// @notice Lottery manager for jackpot
    ICreatorLotteryManager public lotteryManager;

    /// @notice Creator's treasury wallet
    address public creatorTreasury;

    /// @notice Protocol multisig (4626 treasury)
    address public protocolTreasury;

    /// @notice Swap fee tier for WETH → CreatorCoin
    uint24 public swapFeeTier = DEFAULT_SWAP_FEE;

    /// @notice Slippage tolerance for swaps (in bps, default 100 = 1%)
    uint256 public swapSlippageBps = 100;

    /// @notice Oracle for price-based slippage protection
    ICreatorOracle public oracle;

    /// @notice TWAP duration for oracle price (default 30 min)
    uint32 public oracleTwapDuration = 1800;

    /// @notice Whether to use oracle for slippage (if false, uses 0 minimum)
    bool public useOracleSlippage = true;

    /// @notice VaultGaugeVoting for ve(3,3) probability direction
    IVaultGaugeVoting public vaultGaugeVoting;

    /// @notice Voter rewards distributor (receives the 9.61% voter slice)
    IVoterRewardsDistributor public voterRewardsDistributor;

    // ================================
    // FEE SPLIT (in basis points)
    // ================================

    /// @notice Percentage to burn (increases PPS for all holders)
    uint256 public constant BURN_SHARE_BPS = 2139; // 21.39% - ve(3,3) passive value accrual

    /// @notice Percentage to lottery reserve (jackpot)
    uint256 public constant LOTTERY_SHARE_BPS = 6900; // 69% - vote-directed probability pool

    /// @notice Percentage to creator treasury
    uint256 public constant CREATOR_SHARE_BPS = 0; // 0% - creators earn via appreciation + bribes

    /// @notice Percentage to protocol treasury (multisig)
    uint256 public constant PROTOCOL_SHARE_BPS = 961; // 9.61% - platform operations

    // ================================
    // ACCUMULATION & DISTRIBUTION
    // ================================

    /// @notice Pending OFT fees to distribute
    uint256 public pendingFees;

    /// @notice Minimum amount before auto-distribution
    uint256 public distributionThreshold = 100e18; // 100 OFT tokens

    /// @notice Last distribution timestamp
    uint256 public lastDistribution;

    /// @notice Minimum time between distributions
    uint256 public distributionInterval = 1 hours;

    // ================================
    // JACKPOT RESERVE
    // ================================

    /// @notice Vault shares held as jackpot reserve
    uint256 public jackpotReserve;

    // ================================
    // LIFETIME STATS
    // ================================

    /// @notice Total vault shares burned (lifetime)
    uint256 public totalSharesBurned;

    /// @notice Total distributed to lottery (lifetime)
    uint256 public totalLotteryFunded;

    /// @notice Total distributed to creator (lifetime)
    uint256 public totalCreatorEarned;

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

    /// @notice Maximum WETH amount that permissionless callers may process in a single call.
    /// @dev Default: 0 (permissionless processing disabled).
    uint256 public maxPermissionlessWethProcess;

    /// @notice If true, `receiveWETHFees()` may auto-process (only up to the permissionless cap).
    /// @dev Default: false (intake should not trigger public mempool swaps).
    bool public autoProcessWethFees;

    // ================================
    // EVENTS
    // ================================

    event FeesReceived(address indexed from, uint256 oftAmount);
    event WETHFeesReceived(address indexed from, uint256 wethAmount);
    event FeesDistributed(
        uint256 sharesBurned, uint256 toLottery, uint256 toCreator, uint256 toProtocol, uint256 newPricePerShare
    );
    event WETHFeesProcessed(uint256 wethAmount, uint256 creatorCoinReceived, uint256 sharesReceived);
    event SharesBurned(uint256 shares, uint256 newPPS);
    event JackpotPaid(address indexed winner, uint256 shares);

    event VaultSet(address indexed vault);
    event WrapperSet(address indexed wrapper);
    event LotteryManagerSet(address indexed manager);
    event CreatorTreasurySet(address indexed treasury);
    event ProtocolTreasurySet(address indexed treasury);
    event CreatorCoinSet(address indexed coin);
    event ThresholdUpdated(uint256 newThreshold);
    event SwapConfigUpdated(uint24 feeTier, uint256 slippageBps);
    event OracleSet(address indexed oracle);
    event OracleConfigUpdated(uint32 twapDuration, bool useOracle);
    event VaultGaugeVotingUpdated(address indexed vaultGaugeVoting);
    event VoterRewardsDistributorUpdated(address indexed distributor);

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
    error CreatorCoinNotSet();
    error InsufficientJackpot();
    error OnlyLotteryManager();
    error SwapFailed();
    error InvalidSlippage();
    error MinOutputUnavailable();
    error NotAuthorized();

    // ================================
    // CONSTRUCTOR
    // ================================

    /**
     * @notice Create gauge controller for a Creator Coin vault
     * @param _shareOFT The ShareOFT token address (e.g., ■AKITA)
     * @param _creatorTreasury Creator's treasury wallet
     * @param _protocolTreasury Protocol multisig (4626 treasury)
     * @param _owner Owner (usually the creator)
     */
    constructor(address _shareOFT, address _creatorTreasury, address _protocolTreasury, address _owner)
        Ownable(_owner)
    {
        if (_shareOFT == address(0)) revert ZeroAddress();
        if (_protocolTreasury == address(0)) revert ZeroAddress();

        shareOFT = IERC20(_shareOFT);
        creatorTreasury = _creatorTreasury;
        protocolTreasury = _protocolTreasury;
    }

    // ================================
    // RECEIVE FEES
    // ================================

    /**
     * @notice Receive fees from CreatorShareOFT buy transactions
     * @dev Called by ShareOFT when buy fees are collected
     *      Fees arrive as OFT tokens (e.g., ■AKITA)
     * @param amount Amount of OFT tokens received
     */
    function receiveFees(uint256 amount) external nonReentrant {
        if (amount == 0) return;

        // Pull OFT tokens from sender
        shareOFT.safeTransferFrom(msg.sender, address(this), amount);
        pendingFees += amount;
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
        totalFeesReceived += amount;

        emit FeesReceived(msg.sender, amount);
    }

    /**
     * @notice Account for OFT tokens that arrived via cross-chain fee flush
     * @dev When remote CreatorShareOFTs flush fees via OFT send(), the tokens
     *      are minted directly to this contract by LayerZero's _credit().
     *      This function sweeps the unaccounted balance into pendingFees.
     *
     *      Permissionless — anyone can trigger this (keeper, owner, etc.)
     */
    function receiveBridgedFees() external nonReentrant {
        uint256 balance = shareOFT.balanceOf(address(this));

        // Unaccounted = balance minus what we already know about
        // (pendingFees + jackpotReserve are held as vault shares or OFT,
        //  but only pendingFees are in OFT form — jackpotReserve is vault shares)
        uint256 accounted = pendingFees;
        if (balance <= accounted) return;

        uint256 bridgedAmount = balance - accounted;
        pendingFees += bridgedAmount;
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
     * @dev Called when swaps happen on the ■AKITA/ETH pool with tax hook
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

        // Default: do not auto-swap on fee intake (public mempool MEV risk).
        // If enabled, only process up to the permissionless cap to avoid large public swaps.
        if (!autoProcessWethFees) return;

        uint256 cap = maxPermissionlessWethProcess;
        if (cap == 0) return;

        // Auto-process if we have enough and enough time has passed
        if (
            pendingWETHFees >= distributionThreshold / 10 // Lower threshold for WETH
                && block.timestamp >= lastDistribution + distributionInterval
        ) {
            uint256 amountToProcess = pendingWETHFees > cap ? cap : pendingWETHFees;

            // Keep fee intake permissionless even during oracle outages.
            // If oracle-derived protection is unavailable, leave fees pending.
            if (_calculateMinOutput(amountToProcess) > 0) {
                _processWETHFees(amountToProcess);
            }
        }
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
     * @notice Process pending WETH fees: WETH → CreatorCoin → Vault → Distribute
     */
    function processWETHFees() external nonReentrant {
        uint256 amountToProcess = _wethAmountToProcessForCaller(msg.sender);
        if (amountToProcess == 0) return;
        _processWETHFees(amountToProcess);
    }

    function _wethAmountToProcessForCaller(address caller) internal view returns (uint256 amountToProcess) {
        uint256 pending = pendingWETHFees;
        if (pending == 0) return 0;

        if (caller == owner() || caller == wethFeeKeeper) {
            return pending;
        }

        uint256 cap = maxPermissionlessWethProcess;
        if (cap == 0) revert NotAuthorized();
        return pending > cap ? cap : pending;
    }

    function _processWETHFees(uint256 wethAmount) internal {
        if (wethAmount == 0) return;
        if (pendingWETHFees < wethAmount) revert SwapFailed();
        if (address(vault) == address(0)) revert VaultNotSet();
        if (address(creatorCoin) == address(0)) revert CreatorCoinNotSet();

        // Optimistically decrement; any revert restores state.
        pendingWETHFees -= wethAmount;

        // Step 1: Calculate minimum output using oracle (if enabled)
        uint256 minAmountOut = _calculateMinOutput(wethAmount);
        if (minAmountOut == 0) revert MinOutputUnavailable();

        // Derive an on-chain price bound from the oracle-derived minOut.
        // This forces the swap to revert if the pool price is pushed beyond the acceptable range.
        uint160 sqrtPriceLimitX96 = _sqrtPriceLimitX96(wethAmount, minAmountOut);

        // Step 2: Swap WETH → CreatorCoin
        IERC20(WETH).forceApprove(SWAP_ROUTER, wethAmount);

        uint256 wethBefore = IERC20(WETH).balanceOf(address(this));

        uint256 creatorCoinReceived = ISwapRouter(SWAP_ROUTER)
            .exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                tokenIn: WETH,
                tokenOut: address(creatorCoin),
                fee: swapFeeTier,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: wethAmount,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: sqrtPriceLimitX96
            })
            );

        // Defense-in-depth: exactInputSingle should always spend `amountIn`.
        uint256 wethAfter = IERC20(WETH).balanceOf(address(this));
        if (wethAfter > wethBefore || wethBefore - wethAfter != wethAmount) revert SwapFailed();

        if (creatorCoinReceived == 0) revert SwapFailed();

        // Step 3: Deposit CreatorCoin → Vault (receive vault shares)
        creatorCoin.forceApprove(address(vault), creatorCoinReceived);
        uint256 sharesReceived = vault.deposit(creatorCoinReceived, address(this));

        emit WETHFeesProcessed(wethAmount, creatorCoinReceived, sharesReceived);

        // Step 4: Distribute the vault shares
        _distributeVaultShares(sharesReceived);
    }

    /**
     * @notice Calculate minimum output for WETH → CreatorCoin swap using oracle
     * @param wethAmount Amount of WETH to swap
     * @return minOut Minimum Creator Coin to receive (0 if oracle disabled/unavailable)
     */
    function _calculateMinOutput(uint256 wethAmount) internal view returns (uint256 minOut) {
        // Skip oracle if disabled or not set
        if (!useOracleSlippage || address(oracle) == address(0)) {
            return 0;
        }

        // Require freshness; if stale/unavailable, fail closed and leave fees pending.
        try oracle.isPriceFresh() returns (bool fresh) {
            if (!fresh) return 0;
        } catch {
            return 0;
        }

        // Try to get TWAP price from oracle
        try oracle.getCreatorEthTWAP(oracleTwapDuration) returns (uint256 creatorPerEth) {
            if (creatorPerEth == 0) return 0;

            // Expected output = wethAmount * creatorPerEth / 1e18
            uint256 expectedOut = Math.mulDiv(wethAmount, creatorPerEth, 1e18);

            // Apply slippage tolerance
            minOut = Math.mulDiv(expectedOut, (MAX_BPS - swapSlippageBps), MAX_BPS);
        } catch {
            // Oracle failed, return 0 (no slippage protection)
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
        address tokenOut = address(creatorCoin);
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

    /**
     * @notice Force distribution (owner only, bypasses time check)
     */
    function forceDistribute() external nonReentrant onlyOwner {
        if (pendingFees == 0) revert NothingToDistribute();
        _distributeInternal();
    }

    function _distribute() internal {
        if (pendingFees == 0) revert NothingToDistribute();
        if (block.timestamp < lastDistribution + distributionInterval) revert TooSoon();

        _distributeInternal();
    }

    function _distributeInternal() internal {
        if (address(wrapper) == address(0)) revert WrapperNotSet();
        if (address(vault) == address(0)) revert VaultNotSet();

        uint256 oftAmount = pendingFees;
        pendingFees = 0;
        lastDistribution = block.timestamp;

        // Step 1: Unwrap OFT → vault shares
        shareOFT.forceApprove(address(wrapper), oftAmount);
        uint256 vaultSharesReceived = wrapper.unwrap(oftAmount);

        // Step 2: Distribute the vault shares
        _distributeVaultShares(vaultSharesReceived);
    }

    /**
     * @notice Internal function to distribute vault shares according to fee split
     * @dev Called from both OFT fee path and WETH fee path
     *      DEFAULT SPLIT (bps): burn=2139, lottery=6900, creator=0, protocol=961
     * @param vaultSharesReceived Amount of vault shares to distribute
     */
    function _distributeVaultShares(uint256 vaultSharesReceived) internal {
        if (vaultSharesReceived == 0) return;
        if (address(vault) == address(0)) revert VaultNotSet();

        lastDistribution = block.timestamp;

        // Calculate splits (in vault shares)
        uint256 toBurn = (vaultSharesReceived * BURN_SHARE_BPS) / MAX_BPS;
        uint256 toLottery = (vaultSharesReceived * LOTTERY_SHARE_BPS) / MAX_BPS;
        uint256 toCreator = (vaultSharesReceived * CREATOR_SHARE_BPS) / MAX_BPS;
        uint256 toProtocol = vaultSharesReceived - toBurn - toLottery - toCreator;

        // Burn shares (increases PPS for all holders) - disabled by default
        if (toBurn > 0) {
            vaultShares.forceApprove(address(vault), toBurn);
            vault.burnSharesForPriceIncrease(toBurn);
            totalSharesBurned += toBurn;

            emit SharesBurned(toBurn, vault.pricePerShare());
        }

        // Add to jackpot reserve (lotteryShareBps default: 6900)
        if (toLottery > 0) {
            jackpotReserve += toLottery;
            totalLotteryFunded += toLottery;
        }

        // Send to creator (creatorShareBps default: 0)
        if (toCreator > 0 && creatorTreasury != address(0)) {
            vaultShares.safeTransfer(creatorTreasury, toCreator);
            totalCreatorEarned += toCreator;
        } else if (toCreator > 0) {
            // If no treasury set, add to jackpot
            jackpotReserve += toCreator;
            toLottery += toCreator;
            toCreator = 0;
        }

        // Voter rewards (9.61% default): route to ve4626 voters (bribes/fees)
        if (toProtocol > 0 && address(voterRewardsDistributor) != address(0)) {
            vaultShares.forceApprove(address(voterRewardsDistributor), toProtocol);
            voterRewardsDistributor.notifyRewards(address(vault), address(vaultShares), toProtocol);
            totalProtocolEarned += toProtocol; // legacy name: tracks total voter rewards routed
        } else if (toProtocol > 0 && protocolTreasury != address(0)) {
            // Fallback: if distributor isn't configured, send to protocol treasury
            vaultShares.safeTransfer(protocolTreasury, toProtocol);
            totalProtocolEarned += toProtocol;
        } else if (toProtocol > 0) {
            // Final fallback: add to jackpot
            jackpotReserve += toProtocol;
            toLottery += toProtocol;
            toProtocol = 0;
        }

        uint256 newPPS = vault.pricePerShare();

        emit FeesDistributed(toBurn, toLottery, toCreator, toProtocol, newPPS);
    }

    // ================================
    // JACKPOT (FOR LOTTERY)
    // ================================

    /**
     * @notice Pay jackpot to lottery winner
     * @dev Only callable by lottery manager
     * @param winner Winner's address
     * @param shares Amount of vault shares to pay
     */
    function payJackpot(address winner, uint256 shares) external nonReentrant {
        if (msg.sender != address(lotteryManager)) revert OnlyLotteryManager();
        if (shares > jackpotReserve) revert InsufficientJackpot();
        if (winner == address(0)) revert ZeroAddress();

        jackpotReserve -= shares;
        vaultShares.safeTransfer(winner, shares);

        emit JackpotPaid(winner, shares);
    }

    /**
     * @notice Get available jackpot
     */
    function getJackpotReserve() external view returns (uint256) {
        return jackpotReserve;
    }

    // ================================
    // ADMIN - CONFIGURATION
    // ================================

    /**
     * @notice Set the vault address
     * @param _vault CreatorOVault address
     */
    function setVault(address _vault) external onlyOwner {
        if (_vault == address(0)) revert ZeroAddress();
        vault = ICreatorOVault(_vault);
        vaultShares = IERC20(_vault); // Vault is also the share token
        emit VaultSet(_vault);
    }

    /**
     * @notice Set the wrapper address
     * @param _wrapper CreatorOVaultWrapper address
     */
    function setWrapper(address _wrapper) external onlyOwner {
        if (_wrapper == address(0)) revert ZeroAddress();
        wrapper = ICreatorOVaultWrapper(_wrapper);
        emit WrapperSet(_wrapper);
    }

    /**
     * @notice Set the lottery manager
     * @param _lotteryManager Lottery manager address
     */
    function setLotteryManager(address _lotteryManager) external onlyOwner {
        lotteryManager = ICreatorLotteryManager(_lotteryManager);
        emit LotteryManagerSet(_lotteryManager);
    }

    /**
     * @notice Set creator treasury
     * @param _treasury Creator's treasury wallet
     */
    function setCreatorTreasury(address _treasury) external onlyOwner {
        creatorTreasury = _treasury;
        emit CreatorTreasurySet(_treasury);
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
     * @notice Set the creator coin address
     * @param _creatorCoin Creator coin address (e.g., akita)
     */
    function setCreatorCoin(address _creatorCoin) external onlyOwner {
        if (_creatorCoin == address(0)) revert ZeroAddress();
        creatorCoin = IERC20(_creatorCoin);
        emit CreatorCoinSet(_creatorCoin);
    }

    /**
     * @notice Set swap configuration for WETH → CreatorCoin
     * @param _feeTier Uniswap fee tier (100, 500, 3000, 10000)
     * @param _slippageBps Slippage tolerance in basis points
     */
    function setSwapConfig(uint24 _feeTier, uint256 _slippageBps) external onlyOwner {
        if (_slippageBps > 1000) revert InvalidSlippage(); // Max 10% slippage
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
     * @notice Configure permissionless WETH processing and auto-processing on intake.
     * @param _maxPermissionlessWethProcess Max WETH per permissionless `processWETHFees()` call (0 disables).
     * @param _autoProcessWethFees If true, `receiveWETHFees()` may auto-process (only up to the cap).
     */
    function setWethProcessingConfig(uint256 _maxPermissionlessWethProcess, bool _autoProcessWethFees)
        external
        onlyOwner
    {
        maxPermissionlessWethProcess = _maxPermissionlessWethProcess;
        autoProcessWethFees = _autoProcessWethFees;
        emit WethProcessingConfigUpdated(_maxPermissionlessWethProcess, _autoProcessWethFees);
    }

    /**
     * @notice Set the oracle for price-based slippage protection
     * @param _oracle CreatorOracle address
     */
    function setOracle(address _oracle) external onlyOwner {
        oracle = ICreatorOracle(_oracle);
        emit OracleSet(_oracle);
    }

    /**
     * @notice Configure oracle settings
     * @param _twapDuration TWAP duration in seconds
     * @param _useOracle Whether to use oracle for slippage protection
     */
    function setOracleConfig(uint32 _twapDuration, bool _useOracle) external onlyOwner {
        require(_twapDuration >= 60 && _twapDuration <= 7200, "Invalid duration");
        oracleTwapDuration = _twapDuration;
        useOracleSlippage = _useOracle;
        emit OracleConfigUpdated(_twapDuration, _useOracle);
    }

    /**
     * @notice Set VaultGaugeVoting for ve(3,3) probability direction
     * @param _vaultGaugeVoting Address of the VaultGaugeVoting contract
     */
    function setVaultGaugeVoting(address _vaultGaugeVoting) external onlyOwner {
        vaultGaugeVoting = IVaultGaugeVoting(_vaultGaugeVoting);
        emit VaultGaugeVotingUpdated(_vaultGaugeVoting);
    }

    /**
     * @notice Set the voter rewards distributor to receive the 9.61% voter slice.
     * @dev If unset, we fall back to protocolTreasury (or jackpot if that is unset).
     */
    function setVoterRewardsDistributor(address _distributor) external onlyOwner {
        voterRewardsDistributor = IVoterRewardsDistributor(_distributor);
        emit VoterRewardsDistributorUpdated(_distributor);
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
        distributionInterval = _interval;
    }

    // ================================
    // VIEW FUNCTIONS
    // ================================

    /**
     * @notice Get current fee split configuration
     */
    function getFeeSplit() external view returns (uint256 burn, uint256 lottery, uint256 creator, uint256 protocol) {
        return (BURN_SHARE_BPS, LOTTERY_SHARE_BPS, CREATOR_SHARE_BPS, PROTOCOL_SHARE_BPS);
    }

    /**
     * @notice Preview how pending fees would be distributed
     * @dev Returns in vault shares (after unwrapping)
     */
    function previewDistribution()
        external
        view
        returns (uint256 toBurn, uint256 toLottery, uint256 toCreator, uint256 toProtocol)
    {
        // Note: In reality, unwrap may have fees, so this is approximate
        uint256 estimatedShares = pendingFees; // 1:1 if no unwrap fee
        toBurn = (estimatedShares * BURN_SHARE_BPS) / MAX_BPS;
        toLottery = (estimatedShares * LOTTERY_SHARE_BPS) / MAX_BPS;
        toCreator = (estimatedShares * CREATOR_SHARE_BPS) / MAX_BPS;
        toProtocol = estimatedShares - toBurn - toLottery - toCreator;
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
            uint256 _totalCreatorEarned,
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
            totalCreatorEarned,
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
     * @notice Preview WETH → CreatorCoin swap output with slippage protection
     * @param wethAmount Amount of WETH to swap
     * @return expectedOut Expected Creator Coin output (from oracle)
     * @return minOut Minimum output after slippage
     * @return oracleActive Whether oracle slippage is active
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

        try oracle.getCreatorEthTWAP(oracleTwapDuration) returns (uint256 creatorPerEth) {
            if (creatorPerEth == 0) return (0, 0, false);

            expectedOut = Math.mulDiv(wethAmount, creatorPerEth, 1e18);
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
            int256 creatorPriceUSD,
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

            try oracle.getCreatorPrice() returns (int256 price, uint256) {
                creatorPriceUSD = price;
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
        IERC20(token).safeTransfer(to, amount);
    }
}
