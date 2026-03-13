// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CreatorLotteryManager
 * @author 0xakita.eth
 * @notice SHARED swap-based lottery service for ALL Creator Coins (hub-only, deployed on Base)
 *
 * @dev ARCHITECTURE (Hub-Centric):
 *      This is a SHARED service deployed ONLY on the hub chain (Base).
 *      It serves ALL Creator Coins by looking up their contracts from the registry.
 *      Remote chain OFTs send lottery entry messages here via LayerZero.
 *
 * @dev LOTTERY MECHANICS:
 *      1. User trades ANY share token (■AKITA, ■DRAGON, etc) on ANY chain
 *      2. Hub: local processSwapLottery() is called directly
 *         Remote: OFT sends MSG_TYPE_LOTTERY_ENTRY via LayerZero to this contract
 *      3. Win probability scales with trade size ($1 = base, $10,000 = max)
 *      4. ve4626 lockers get boosted win chances
 *      5. Winners receive % from ALL active creator vaults (diversified prize!)
 *      6. Winner callback sent to source chain OFT for UX notification
 *
 * @dev MULTI-TOKEN PRIZE PAYOUT:
 *      Winner gets shares from EVERY active creator vault on Base:
 *        - ■AKITA shares (69% of AKITA vault jackpot)
 *        - ■DRAGON shares (69% of DRAGON vault jackpot)
 *        - ■XYZ shares (69% of XYZ vault jackpot)
 *        - ... etc for ALL active creators
 *      Result: Winner gets a diversified portfolio of ALL creator tokens!
 *
 * @dev CROSS-CHAIN FLOW (Hub-Centric):
 *      Trade on Base:
 *        1. OFT calls processSwapLottery() directly
 *        2. VRF + payout happen locally
 *
 *      Trade on Remote (e.g., Arbitrum):
 *        1. Remote OFT sends MSG_TYPE_LOTTERY_ENTRY to this contract
 *        2. This contract processes VRF locally on Base
 *        3. If win: pay from ALL hub vaults
 *        4. Send MSG_TYPE_WINNER_CALLBACK to source chain OFT
 */

import {OApp, Origin, MessagingFee} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {OAppOptionsType3} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OAppOptionsType3.sol";
import {EnforcedOptionParam} from "@layerzerolabs/oapp-evm/contracts/oapp/interfaces/IOAppOptionsType3.sol";
import {OptionsBuilder} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {MessagingReceipt} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {ICreatorOracle} from "../../interfaces/ICreatorOracle.sol";

// ================================
// INTERFACES
// ================================

interface ICreatorRegistryLottery {
    // Per-creator lookups
    function getVaultForToken(address _token) external view returns (address);
    function getShareOFTForToken(address _token) external view returns (address);
    function getTokenForShareOFT(address _shareOFT) external view returns (address);
    function getOracleForToken(address _token) external view returns (address);
    function getGaugeControllerForToken(address _token) external view returns (address);
    function isCreatorCoinActive(address _token) external view returns (bool);

    // Chain infrastructure
    function getLayerZeroEndpoint(uint256 _chainId) external view returns (address);

    // Global queries
    function getAllCreatorCoins() external view returns (address[] memory);
}

interface ICreatorGaugeControllerLottery {
    function getJackpotReserve() external view returns (uint256);
    function payJackpot(address winner, uint256 shares) external;
}

interface ICreatorVRFConsumer {
    function requestRandomWords() external returns (uint256 requestId);
}

interface IChainlinkVRFIntegrator {
    function quoteFee() external view returns (MessagingFee memory);
    function requestRandomWordsPayable(uint32 targetEid) external payable returns (MessagingReceipt memory, uint64);
}

interface Ive4626BoostManager {
    function calculateBoost(address user) external view returns (uint256 boostBps);
    function getTotalProbabilityBoost(address user) external view returns (uint256 boostBps);
    function getCoverageBps(
        address user,
        address registry,
        address creatorCoin,
        address shareBalanceToken,
        uint256 creatorShareBalanceAmount,
        uint256 swapAmountUSD
    ) external view returns (uint256 coverageBps);
    function hasBoost(address user) external view returns (bool);
}

interface IVaultGaugeVoting {
    /// @notice Vault's vote-directed probability boost (PPM) from the global gauge budget.
    function getVaultGaugeProbabilityBoostPPM(address vault) external view returns (uint256);
}

contract CreatorLotteryManager is OApp, OAppOptionsType3, ReentrancyGuard, Pausable {
    using OptionsBuilder for bytes;
    using SafeERC20 for IERC20;

    // ================================
    // CONSTANTS
    // ================================

    uint256 public constant MIN_SWAP_USD = 1_000_000; // $1 (6 decimals)
    uint256 public constant MAX_SWAP_USD = 1_000_000_000_000; // $1M
    uint256 public constant BASIS_POINTS = 10_000;

    /// @notice Message types for hub-centric architecture
    uint16 public constant MSG_TYPE_LOTTERY_ENTRY = 3;
    uint16 public constant MSG_TYPE_WINNER_CALLBACK = 4;

    uint128 internal constant DEFAULT_GAS_LIMIT = 200_000;
    uint128 internal constant DEFAULT_MSG_VALUE = 0;
    uint128 internal constant DEFAULT_CALLBACK_GAS_LIMIT = 100_000;
    uint256 internal constant DEFAULT_SPONSOR_EPOCH_DURATION = 1 hours;
    uint256 internal constant DEFAULT_VRF_SPONSOR_MAX_FEE = 0.01 ether;
    uint256 internal constant DEFAULT_VRF_SPONSOR_BUDGET = 0.25 ether;
    uint256 internal constant DEFAULT_CALLBACK_SPONSOR_MAX_FEE = 0.01 ether;
    uint256 internal constant DEFAULT_CALLBACK_SPONSOR_BUDGET = 0.1 ether;

    // Safety defaults: sponsorship is opt-in and bounded.
    uint256 internal constant DEFAULT_SPONSORED_VRF_MIN_SWAP_USD = 10_000_000; // $10 (6 decimals)
    uint32 internal constant DEFAULT_VRF_MAX_SPONSORED_PER_BUYER_PER_EPOCH = 2;
    uint32 internal constant DEFAULT_VRF_MAX_SPONSORED_PER_ORIGIN_PER_EPOCH = 10;
    uint32 internal constant DEFAULT_CALLBACK_MAX_SPONSORED_PER_BUYER_PER_EPOCH = 1;
    uint32 internal constant DEFAULT_CALLBACK_MAX_SPONSORED_PER_ORIGIN_PER_EPOCH = 10;

    // ================================
    // STATE - SHARED SERVICE
    // ================================

    /// @notice Registry for looking up per-creator contracts
    ICreatorRegistryLottery public immutable registry;

    /// @notice Authorized swap contracts that can trigger lottery
    mapping(address => bool) public authorizedSwapContracts;

    /// @notice VRF providers (shared across all creators)
    ICreatorVRFConsumer public localVRFConsumer;
    IChainlinkVRFIntegrator public vrfIntegrator;
    uint32 public targetEid;
    bool public useLocalVRF;
    mapping(address => bool) public trustedVrfIntegrators;

    /// @notice Boost manager for ve4626 lockers
    Ive4626BoostManager public boostManager;

    /// @notice VaultGaugeVoting for ve(3,3) vault probability direction
    IVaultGaugeVoting public vaultGaugeVoting;

    /// @notice Lottery configuration (shared across all creators)
    struct LotteryConfig {
        uint256 minSwapAmount;
        uint256 rewardPercentage; // bps of jackpot
        bool isActive;
        uint256 baseWinChance; // PPM (parts per million)
        uint256 maxWinChance; // PPM
        uint256 usdMultiplierBps; // Bonus for slippage (10500 = 1.05x)
    }

    LotteryConfig public lotteryConfig;

    /// @notice Max acceptable oracle staleness (seconds).
    /// @dev Used as defense-in-depth; default preserves prior 2h hardcode.
    uint256 public oracleMaxStaleness = 2 hours;

    /// @notice Circuit breaker: maximum allowed price deviation (bps) within `oracleDeviationWindow`.
    /// @dev If the reference is recent and the oracle price jumps beyond this, the entry is skipped (no VRF request).
    uint256 public oracleMaxDeviationBps = 2000; // 20%
    uint256 public oracleDeviationWindow = 30 minutes;

    /// @notice Per-creator reference price used for deviation checks (USD 1e18).
    mapping(address => uint256) public lastAcceptedPriceUSD1e18;
    mapping(address => uint256) public lastAcceptedPriceTimestamp;

    /// @notice VRF request tracking - includes creator coin and source chain
    enum VRFType {
        LOCAL,
        CROSS_CHAIN
    }
    enum SponsorshipSkipReason {
        DISABLED,
        BELOW_MIN_SWAP,
        FEE_ABOVE_CAP,
        BUDGET_EXCEEDED,
        INSUFFICIENT_BALANCE,
        SEND_FAILED,
        RATE_LIMITED
    }

    struct SponsorshipPolicy {
        bool enabled;
        uint256 maxFeePerMessage;
        uint256 budgetPerEpoch;
        uint256 epochDuration;
        uint256 epochStart;
        uint256 spentInEpoch;
    }

    struct VRFRequest {
        address user;
        address creatorCoin; // Which creator coin this entry is for
        uint256 amountUSD;
        uint256 effectiveWinChancePPM;
        VRFType vrfType;
        uint32 sourceChainEid; // 0 = local (hub), non-zero = remote chain lottery entry
    }

    mapping(uint256 => VRFRequest) public vrfRequests;

    /// @notice Deferred VRF results while the contract is paused.
    /// @dev While paused, callbacks store randomness and do not settle wins/losses.
    mapping(uint256 => uint256) public pendingRandomWord;
    mapping(uint256 => bool) public hasPendingRandomWord;

    /// @notice Funding policy for cross-chain VRF requests and winner callbacks.
    SponsorshipPolicy public vrfSponsorshipPolicy;
    SponsorshipPolicy public callbackSponsorshipPolicy;
    uint256 public sponsoredVrfMinSwapAmountUSD = DEFAULT_SPONSORED_VRF_MIN_SWAP_USD;

    /// @notice Sponsorship anti-spam rate limits (count-based per epoch). 0 = unlimited.
    uint32 public vrfMaxSponsoredPerBuyerPerEpoch;
    uint32 public vrfMaxSponsoredPerOriginPerEpoch;
    uint32 public callbackMaxSponsoredPerBuyerPerEpoch;
    uint32 public callbackMaxSponsoredPerOriginPerEpoch;

    mapping(address => uint32) public vrfSponsoredCountByBuyer;
    mapping(address => uint256) public vrfBuyerEpochStart;
    mapping(bytes32 => uint32) public vrfSponsoredCountByOrigin;
    mapping(bytes32 => uint256) public vrfOriginEpochStart;

    mapping(address => uint32) public callbackSponsoredCountByBuyer;
    mapping(address => uint256) public callbackBuyerEpochStart;
    mapping(bytes32 => uint32) public callbackSponsoredCountByOrigin;
    mapping(bytes32 => uint256) public callbackOriginEpochStart;

    /// @notice Authorized remote OFT peers that can send lottery entries
    /// @dev Maps (srcEid, senderBytes32) → authorized
    mapping(uint32 => mapping(bytes32 => bool)) public authorizedRemoteOFTs;

    /// @notice Gas limit for winner callback messages
    uint128 public callbackGasLimit = DEFAULT_CALLBACK_GAS_LIMIT;

    /// @notice Total remote lottery entries received
    uint256 public totalRemoteLotteryEntries;

    /// @notice Global statistics (vault share units)
    uint256 public totalLotteryEntries;
    uint256 public totalWinners;
    uint256 public totalRewardsPaid;

    /// @notice Per-creator statistics (vault share units)
    struct CreatorStats {
        uint256 entries;
        uint256 winners;
        uint256 rewardsPaid;
    }
    mapping(address => CreatorStats) public creatorStats;

    // Guard against re-entrant payouts triggered by external vault/gauge calls.
    uint256 private _payoutLock;

    // ================================
    // EVENTS
    // ================================

    event LotteryEntryCreated(
        address indexed creatorCoin,
        address indexed user,
        uint256 swapAmountUSD,
        uint256 winChancePPM,
        uint256 requestId
    );
    event LotteryWinner(
        address indexed creatorCoin,
        address indexed user,
        uint256 swapAmountUSD,
        uint256 rewardAmount,
        uint256 requestId
    );
    event LotteryResultProcessed(
        address indexed creatorCoin,
        address indexed user,
        uint256 swapAmountUSD,
        bool won,
        uint256 rewardAmount,
        uint256 requestId
    );
    event SwapContractAuthorized(address indexed swapContract, bool authorized);
    event LotteryConfigUpdated(uint256 minSwap, uint256 rewardPercentage, bool isActive);
    event OracleMaxStalenessUpdated(uint256 maxStaleness);
    event OracleDeviationGuardUpdated(uint256 maxDeviationBps, uint256 deviationWindow);
    event CrossChainJackpotPaid(
        address indexed creatorCoin, address indexed winner, uint256 shares, uint256 tokenValue
    );
    event LotteryWon(
        address indexed creatorCoin, uint256 indexed entryId, address indexed winner, uint256 shares, uint256 tokenValue
    );
    event MultiTokenJackpotWon(address indexed triggeringCoin, address indexed winner, uint256 numVaultsPaid);
    event JackpotPayoutFailed(address indexed creatorCoin, address indexed winner, uint256 shares);
    event RemoteLotteryEntryReceived(
        uint32 indexed srcEid, address indexed buyer, address indexed tokenIn, uint256 amount, uint32 sourceChainId
    );
    event WinnerCallbackSent(
        uint32 indexed dstEid, address indexed winner, address indexed creatorCoin, uint256 totalSharesPaid
    );
    event RemoteOFTAuthorized(uint32 indexed srcEid, bytes32 sender, bool authorized);
    event CallbackGasLimitUpdated(uint128 newGasLimit);
    event VRFConsumerUpdated(address indexed consumer);
    event TargetEidUpdated(uint32 indexed targetEid);
    event VRFIntegratorUpdated(address indexed integrator, bool trusted);
    event VrfResultDeferred(uint256 indexed requestId, uint256 randomWord);
    event PendingVrfResultProcessed(uint256 indexed requestId);
    event SponsorshipPolicyUpdated(
        bytes32 indexed context, bool enabled, uint256 maxFeePerMessage, uint256 budgetPerEpoch, uint256 epochDuration
    );
    event SponsorshipRateLimitsUpdated(
        uint32 vrfMaxPerBuyerPerEpoch,
        uint32 vrfMaxPerOriginPerEpoch,
        uint32 callbackMaxPerBuyerPerEpoch,
        uint32 callbackMaxPerOriginPerEpoch
    );
    event SponsoredVrfMinSwapUpdated(uint256 minSwapAmountUSD);
    event SponsorshipSpendRecorded(
        bytes32 indexed context, uint256 amount, uint256 spentInEpoch, uint256 budgetPerEpoch, uint256 epochStart
    );
    event SponsorshipSkipped(
        bytes32 indexed context, SponsorshipSkipReason reason, uint256 feeNative, uint256 valueHint
    );

    // ================================
    // ERRORS
    // ================================

    error ZeroAddress();
    error Unauthorized();
    error InvalidAmount();
    error CallerFeeMismatch(uint256 provided, uint256 required);
    error CreatorCoinNotRegistered(address token);
    error NoOracleConfigured(address token);
    error NoVaultConfigured(address token);
    error NoGaugeConfigured(address token);
    error NoPendingVrfResult(uint256 requestId);

    // ================================
    // CONSTRUCTOR
    // ================================

    /**
     * @notice Deploy shared lottery manager
     * @param _registry CreatorRegistry address
     * @param owner_ Owner address
     */
    constructor(address _registry, address owner_)
        OApp(ICreatorRegistryLottery(_registry).getLayerZeroEndpoint(block.chainid), owner_)
        Ownable(owner_)
    {
        if (owner_ == address(0)) revert ZeroAddress();
        if (_registry == address(0)) revert ZeroAddress();

        registry = ICreatorRegistryLottery(_registry);

        // Initialize lottery config
        lotteryConfig = LotteryConfig({
            minSwapAmount: MIN_SWAP_USD,
            rewardPercentage: 6900, // 69% of jackpot
            isActive: true,
            baseWinChance: 40, // 0.004%
            maxWinChance: 150_000, // 15%
            usdMultiplierBps: 10500 // 1.05x
        });

        vrfSponsorshipPolicy = SponsorshipPolicy({
            enabled: false,
            maxFeePerMessage: DEFAULT_VRF_SPONSOR_MAX_FEE,
            budgetPerEpoch: DEFAULT_VRF_SPONSOR_BUDGET,
            epochDuration: DEFAULT_SPONSOR_EPOCH_DURATION,
            epochStart: block.timestamp,
            spentInEpoch: 0
        });

        callbackSponsorshipPolicy = SponsorshipPolicy({
            enabled: false,
            maxFeePerMessage: DEFAULT_CALLBACK_SPONSOR_MAX_FEE,
            budgetPerEpoch: DEFAULT_CALLBACK_SPONSOR_BUDGET,
            epochDuration: DEFAULT_SPONSOR_EPOCH_DURATION,
            epochStart: block.timestamp,
            spentInEpoch: 0
        });

        // Default anti-spam limits for sponsored traffic (caller-funded bypasses these).
        vrfMaxSponsoredPerBuyerPerEpoch = DEFAULT_VRF_MAX_SPONSORED_PER_BUYER_PER_EPOCH;
        vrfMaxSponsoredPerOriginPerEpoch = DEFAULT_VRF_MAX_SPONSORED_PER_ORIGIN_PER_EPOCH;
        callbackMaxSponsoredPerBuyerPerEpoch = DEFAULT_CALLBACK_MAX_SPONSORED_PER_BUYER_PER_EPOCH;
        callbackMaxSponsoredPerOriginPerEpoch = DEFAULT_CALLBACK_MAX_SPONSORED_PER_ORIGIN_PER_EPOCH;

    }

    // ================================
    // MODIFIERS
    // ================================

    modifier onlyAuthorizedSwapContract() {
        if (!authorizedSwapContracts[msg.sender]) revert Unauthorized();
        _;
    }

    // ================================
    // MAIN LOTTERY FUNCTION
    // ================================

    /**
     * @notice Process swap-based lottery entry for ANY Creator Coin
     * @param buyer User's wallet address (recipient of the swap)
     *        Supports EOAs, smart contract wallets (Coinbase Smart Wallet, Safe),
     *        and ERC-4337 accounts. Passed by the calling swap contract.
     * @param tokenIn Token swapped (■TOKEN / ShareOFT)
     * @param amountIn Amount swapped
     * @return entryId VRF request ID (0 if no entry)
     */
    function processSwapLottery(address buyer, address tokenIn, uint256 amountIn, uint256 buyerCurrentShareBalance)
        external
        payable
        nonReentrant
        onlyAuthorizedSwapContract
        whenNotPaused
        returns (uint256 entryId)
    {
        if (buyer == address(0)) revert ZeroAddress();
        if (tokenIn == address(0)) revert ZeroAddress();
        if (amountIn == 0) revert InvalidAmount();

        // Derive creator coin from tokenIn (■TOKEN)
        address creatorCoin = registry.getTokenForShareOFT(tokenIn);
        if (creatorCoin == address(0)) {
            // Silently skip unregistered tokens (no lottery entry)
            return 0;
        }

        // Verify creator coin is registered AND active
        if (!registry.isCreatorCoinActive(creatorCoin)) {
            // Silently skip inactive/unregistered creators (no lottery entry)
            return 0;
        }

        // Calculate USD value using per-creator oracle (plus reference price for circuit breakers)
        (uint256 swapValueUSD, uint256 oraclePriceUSD1e18,) = _calculateTokenUSD(creatorCoin, tokenIn, amountIn);

        if (swapValueUSD < lotteryConfig.minSwapAmount) {
            return 0;
        }

        if (!lotteryConfig.isActive) {
            return 0;
        }

        // Convert raw held share balance to USD (1e6) for coverage math.
        uint256 creatorShareBalanceUSD = 0;
        if (buyerCurrentShareBalance > 0) {
            (creatorShareBalanceUSD,,) = _calculateTokenUSD(creatorCoin, tokenIn, buyerCurrentShareBalance);
        }

        // Get vault for this creator coin (for ve(3,3) vault weighting)
        address vault = registry.getVaultForToken(creatorCoin);

        // Calculate win probability with ve(3,3) boosts
        uint256 baseWinChance = calculateWinChance(swapValueUSD);
        uint256 boostedWinChance =
            _applyBoost(buyer, creatorCoin, tokenIn, creatorShareBalanceUSD, vault, swapValueUSD, baseWinChance);

        // Request VRF
        if (useLocalVRF && address(localVRFConsumer) != address(0)) {
            // Local VRF never needs native fees; refuse value to avoid trapping ETH.
            if (msg.value != 0) revert InvalidAmount();
            entryId = _requestLocalVRF(creatorCoin, buyer, swapValueUSD, boostedWinChance);
        } else {
            entryId = _requestCrossChainVRF(creatorCoin, buyer, swapValueUSD, boostedWinChance, msg.value);
        }

        // Update reference only when an entry is actually created.
        if (entryId > 0 && oraclePriceUSD1e18 > 0) {
            lastAcceptedPriceUSD1e18[creatorCoin] = oraclePriceUSD1e18;
            lastAcceptedPriceTimestamp[creatorCoin] = block.timestamp;
        }
        return entryId;
    }

    /**
     * @notice Request cross-chain VRF (hub local call path, sourceChainEid = 0)
     */
    function _requestCrossChainVRF(
        address creatorCoin,
        address buyer,
        uint256 swapValueUSD,
        uint256 winChancePPM,
        uint256 callerFeeValue
    ) internal returns (uint256) {
        return _requestCrossChainVRFWithSource(
            creatorCoin, buyer, swapValueUSD, winChancePPM, 0, bytes32(0), callerFeeValue
        );
    }

    /**
     * @notice Request local VRF (hub local call path, sourceChainEid = 0)
     */
    function _requestLocalVRF(address creatorCoin, address buyer, uint256 swapValueUSD, uint256 winChancePPM)
        internal
        returns (uint256)
    {
        return _requestLocalVRFWithSource(creatorCoin, buyer, swapValueUSD, winChancePPM, 0);
    }

    // ================================
    // VRF CALLBACKS
    // ================================

    /**
     * @notice Local VRF callback
     */
    function receiveRandomWords(uint256 requestId, uint256[] memory randomWords) external nonReentrant {
        if (msg.sender != address(localVRFConsumer)) revert Unauthorized();
        _processVRFResult(requestId, randomWords);
    }

    /**
     * @notice Cross-chain VRF callback
     */
    function receiveRandomWords(uint256[] memory randomWords, uint256 sequence) external nonReentrant {
        if (msg.sender != address(vrfIntegrator)) revert Unauthorized();
        _processVRFResult(sequence, randomWords);
    }

    /**
     * @notice Process a deferred VRF result after unpausing.
     * @dev While paused, callbacks store randomness and skip settlement to halt jackpot outflows.
     */
    function processPendingVrfResult(uint256 requestId) external whenNotPaused nonReentrant {
        if (!hasPendingRandomWord[requestId]) revert NoPendingVrfResult(requestId);

        uint256 word = pendingRandomWord[requestId];
        delete pendingRandomWord[requestId];
        delete hasPendingRandomWord[requestId];

        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = word;
        _processVRFResult(requestId, randomWords);

        emit PendingVrfResultProcessed(requestId);
    }

    function _processVRFResult(uint256 requestId, uint256[] memory randomWords) internal {
        if (randomWords.length == 0) return;

        VRFRequest memory request = vrfRequests[requestId];
        if (request.user == address(0)) return;

        // If paused, defer settlement and preserve the request for later processing.
        if (paused()) {
            if (!hasPendingRandomWord[requestId]) {
                pendingRandomWord[requestId] = randomWords[0];
                hasPendingRandomWord[requestId] = true;
                emit VrfResultDeferred(requestId, randomWords[0]);
            }
            return;
        }

        delete vrfRequests[requestId];

        uint256 winChancePPM = request.effectiveWinChancePPM;

        if ((randomWords[0] % 1_000_000) < winChancePPM) {
            uint256 reward = _processWin(
                request.creatorCoin,
                request.user,
                request.amountUSD,
                requestId,
                request.sourceChainEid
            );
            emit LotteryResultProcessed(request.creatorCoin, request.user, request.amountUSD, true, reward, requestId);
        } else {
            emit LotteryResultProcessed(request.creatorCoin, request.user, request.amountUSD, false, 0, requestId);
        }
    }

    // ================================
    // INTERNAL FUNCTIONS
    // ================================

    /**
     * @notice Calculate USD value of tokens using per-creator oracle
     */
    function _calculateTokenUSD(address creatorCoin, address tokenIn, uint256 amount)
        internal
        view
        returns (uint256 usd1e6, uint256 priceUSD1e18, uint256 oracleTimestamp)
    {
        // Get per-creator oracle
        address oracleAddr = registry.getOracleForToken(creatorCoin);
        if (oracleAddr == address(0)) return (0, 0, 0);

        // Get per-creator shareOFT
        address shareOFT = registry.getShareOFTForToken(creatorCoin);

        // Only works for creator token or its shareOFT
        if (tokenIn != creatorCoin && tokenIn != shareOFT) return (0, 0, 0);
        if (amount == 0) return (0, 0, 0);

        ICreatorOracle oracle = ICreatorOracle(oracleAddr);
        int256 priceUSD;
        uint256 timestamp;
        // Oracle reads should never be able to revert swap processing.
        try oracle.getCreatorPrice() returns (int256 p, uint256 t) {
            priceUSD = p;
            timestamp = t;
        } catch {
            return (0, 0, 0);
        }
        if (priceUSD <= 0 || timestamp == 0) return (0, 0, 0);
        // Prevent underflow and freshness spoofing from future timestamps.
        if (timestamp > block.timestamp) return (0, 0, 0);
        uint256 maxStaleness = oracleMaxStaleness;
        if (maxStaleness > 0 && block.timestamp - timestamp > maxStaleness) return (0, 0, 0);

        // Circuit breaker: skip entries if the oracle deviates too much from the recent accepted reference.
        uint256 maxDeviationBps = oracleMaxDeviationBps;
        uint256 deviationWindow = oracleDeviationWindow;
        uint256 lastPrice = lastAcceptedPriceUSD1e18[creatorCoin];
        uint256 lastTs = lastAcceptedPriceTimestamp[creatorCoin];
        if (maxDeviationBps > 0 && deviationWindow > 0 && lastPrice > 0 && lastTs > 0) {
            if (block.timestamp - lastTs <= deviationWindow) {
                // forge-lint: disable-next-line(unsafe-typecast)
                uint256 currentPrice = uint256(priceUSD);
                uint256 diff = currentPrice > lastPrice ? currentPrice - lastPrice : lastPrice - currentPrice;
                uint256 deviationBps = FullMath.mulDiv(diff, BASIS_POINTS, lastPrice);
                if (deviationBps > maxDeviationBps) return (0, 0, 0);
            }
        }

        // forge-lint: disable-next-line(unsafe-typecast)
        priceUSD1e18 = uint256(priceUSD);
        oracleTimestamp = timestamp;

        uint256 usd1e18 = FullMath.mulDiv(amount, priceUSD1e18, 1e18);
        if (lotteryConfig.usdMultiplierBps > 0) {
            usd1e18 = FullMath.mulDiv(usd1e18, lotteryConfig.usdMultiplierBps, BASIS_POINTS);
        }
        usd1e6 = usd1e18 / 1e12;
    }

    function calculateWinChance(uint256 swapAmountUSD) public view returns (uint256 winChancePPM) {
        if (swapAmountUSD <= lotteryConfig.minSwapAmount) {
            return lotteryConfig.baseWinChance;
        }

        uint256 scaledAmount = swapAmountUSD - lotteryConfig.minSwapAmount;
        // Cap max probability scaling at $10,000 total swap value.
        // scaledAmount is (swap - minSwap), and minSwap defaults to $1 (1e6),
        // so $10,000 corresponds to (10_000 - 1) * 1e6 = 9_999_000_000.
        uint256 maxScale = 9_999_000_000; // $9,999 above minSwap ($1), 6 decimals

        if (scaledAmount >= maxScale) {
            return lotteryConfig.maxWinChance;
        }

        uint256 chanceRange = lotteryConfig.maxWinChance - lotteryConfig.baseWinChance;
        winChancePPM = lotteryConfig.baseWinChance + (scaledAmount * chanceRange / maxScale);
    }

    /**
     * @notice Apply ve(3,3) boosts to base win probability
     * @dev Personal ve4626 boosts stay coverage-scaled (full 2.5x only up to covered value).
     *      Vault gauge boost is flat additive and applies full voted PPM to every trade.
     */
    function _applyBoost(
        address user,
        address creatorCoin,
        address shareBalanceToken,
        uint256 creatorShareBalanceAmount,
        address vault,
        uint256 swapAmountUSD,
        uint256 baseWinChance
    )
        internal
        view
        returns (uint256 boostedWinChance)
    {
        boostedWinChance = baseWinChance;

        // STEP 1: Apply coverage-scaled personal ve4626 boosts
        if (address(boostManager) != address(0)) {
            uint256 coverageBps = boostManager.getCoverageBps(
                user, address(registry), creatorCoin, shareBalanceToken, creatorShareBalanceAmount, swapAmountUSD
            );

            try boostManager.calculateBoost(user) returns (uint256 boostBPS) {
                if (boostBPS > BASIS_POINTS && coverageBps > 0) {
                    uint256 extraMultiplierBps = boostBPS - BASIS_POINTS;
                    uint256 effectiveMultiplierBps =
                        BASIS_POINTS + FullMath.mulDiv(extraMultiplierBps, coverageBps, BASIS_POINTS);
                    boostedWinChance = FullMath.mulDiv(baseWinChance, effectiveMultiplierBps, BASIS_POINTS);
                }
            } catch {}

            // Additional lock-duration additive boost (also coverage-scaled).
            try boostManager.getTotalProbabilityBoost(user) returns (uint256 probBoostBps) {
                if (probBoostBps > 0 && coverageBps > 0) {
                    uint256 additionalPPM = probBoostBps * 100;
                    additionalPPM = FullMath.mulDiv(additionalPPM, coverageBps, BASIS_POINTS);
                    boostedWinChance += additionalPPM;
                }
            } catch {}
        }

        // STEP 2: Add vault gauge boost (flat additive vote-directed budget).
        if (address(vaultGaugeVoting) != address(0) && vault != address(0)) {
            try vaultGaugeVoting.getVaultGaugeProbabilityBoostPPM(vault) returns (uint256 gaugeBoostPPM) {
                if (gaugeBoostPPM > 0) {
                    boostedWinChance += gaugeBoostPPM;
                }
            } catch {}
        }

        // Cap at maximum
        if (boostedWinChance > lotteryConfig.maxWinChance) {
            boostedWinChance = lotteryConfig.maxWinChance;
        }
    }

    /**
     * @notice Process a lottery win (hub-only, all wins are paid on Base)
     * @param sourceChainEid The EID of the chain where the trade originated (0 = local hub)
     */
    function _processWin(
        address creatorCoin,
        address user,
        uint256 swapAmountUSD,
        uint256 requestId,
        uint32 sourceChainEid
    ) internal returns (uint256) {
        totalWinners++;
        creatorStats[creatorCoin].winners++;
        emit LotteryWinner(creatorCoin, user, swapAmountUSD, 0, requestId);

        // All wins are paid from hub vaults
        uint256 localPayout = _payoutLocalJackpot(creatorCoin, user, uint16(lotteryConfig.rewardPercentage));

        // If the trade originated on a remote chain, send a winner callback
        // so the user gets notified on the chain they traded on
        if (sourceChainEid != 0) {
            _sendWinnerCallback(sourceChainEid, user, creatorCoin, localPayout);
        }

        return localPayout;
    }

    // ================================
    // CROSS-CHAIN MESSAGING (Hub-Centric)
    // ================================

    /**
     * @notice Receive LayerZero messages (lottery entries from remote OFTs)
     * @dev Only accepts MSG_TYPE_LOTTERY_ENTRY from authorized remote OFTs
     */
    function _lzReceive(Origin calldata _origin, bytes32, bytes calldata _payload, address, bytes calldata)
        internal
        override
    {
        _requireNotPaused();

        // Verify sender is an authorized remote OFT
        if (!authorizedRemoteOFTs[_origin.srcEid][_origin.sender]) revert Unauthorized();

        // Decode message type
        if (_payload.length < 32) revert InvalidAmount();
        uint16 msgType = abi.decode(_payload[:32], (uint16));

        if (msgType == MSG_TYPE_LOTTERY_ENTRY) {
            _handleLotteryEntry(_origin.srcEid, _origin.sender, _payload);
        } else {
            revert InvalidAmount();
        }
    }

    /**
     * @dev Handle a lottery entry from a remote chain OFT
     *      Legacy payload: (msgType, buyer, tokenIn, amount, sourceChainId)
     *      V2 payload:     (msgType, buyer, tokenIn, amount, sourceChainId, buyerCurrentShareBalance)
     */
    function _handleLotteryEntry(uint32 srcEid, bytes32 originSender, bytes calldata _payload) internal {
        address buyer;
        address tokenIn;
        uint256 amount;
        uint32 sourceChainId;
        uint256 buyerCurrentShareBalance;

        if (_payload.length == 192) {
            (, // msgType (already checked)
                buyer,
                tokenIn,
                amount,
                sourceChainId,
                buyerCurrentShareBalance
            ) = abi.decode(_payload, (uint16, address, address, uint256, uint32, uint256));
        } else if (_payload.length == 160) {
            (, // msgType (already checked)
                buyer,
                tokenIn,
                amount,
                sourceChainId
            ) = abi.decode(_payload, (uint16, address, address, uint256, uint32));
        } else {
            revert InvalidAmount();
        }

        if (buyer == address(0) || tokenIn == address(0) || amount == 0) return;

        totalRemoteLotteryEntries++;
        emit RemoteLotteryEntryReceived(srcEid, buyer, tokenIn, amount, sourceChainId);

        // Derive creator coin from tokenIn (■TOKEN)
        address creatorCoin = registry.getTokenForShareOFT(tokenIn);
        if (creatorCoin == address(0)) return;
        if (!registry.isCreatorCoinActive(creatorCoin)) return;

        // Calculate USD value using per-creator oracle (plus reference price for circuit breakers)
        (uint256 swapValueUSD, uint256 oraclePriceUSD1e18,) = _calculateTokenUSD(creatorCoin, tokenIn, amount);
        if (swapValueUSD < lotteryConfig.minSwapAmount) return;
        if (!lotteryConfig.isActive) return;

        // Convert raw held share balance to USD (1e6) for coverage math.
        uint256 creatorShareBalanceUSD = 0;
        if (buyerCurrentShareBalance > 0) {
            (creatorShareBalanceUSD,,) = _calculateTokenUSD(creatorCoin, tokenIn, buyerCurrentShareBalance);
        }

        // Get vault for this creator coin (for ve(3,3) vault weighting)
        address vault = registry.getVaultForToken(creatorCoin);

        // Calculate win probability with ve(3,3) boosts
        uint256 baseWinChance = calculateWinChance(swapValueUSD);
        uint256 boostedWinChance = _applyBoost(
            buyer, creatorCoin, tokenIn, creatorShareBalanceUSD, vault, swapValueUSD, baseWinChance
        );

        // Request VRF with sourceChainEid so we can send callback on win
        uint256 entryId;
        if (useLocalVRF && address(localVRFConsumer) != address(0)) {
            entryId = _requestLocalVRFWithSource(creatorCoin, buyer, swapValueUSD, boostedWinChance, srcEid);
        } else {
            entryId = _requestCrossChainVRFWithSource(
                creatorCoin, buyer, swapValueUSD, boostedWinChance, srcEid, originSender, 0
            );
        }

        if (entryId > 0) {
            // Update reference only when an entry is actually created.
            if (oraclePriceUSD1e18 > 0) {
                lastAcceptedPriceUSD1e18[creatorCoin] = oraclePriceUSD1e18;
                lastAcceptedPriceTimestamp[creatorCoin] = block.timestamp;
            }
            emit LotteryEntryCreated(creatorCoin, buyer, swapValueUSD, boostedWinChance, entryId);
        }
    }

    /**
     * @notice Request local VRF with source chain tracking
     */
    function _requestLocalVRFWithSource(
        address creatorCoin,
        address buyer,
        uint256 swapValueUSD,
        uint256 winChancePPM,
        uint32 sourceChainEid
    ) internal returns (uint256) {
        if (address(localVRFConsumer) == address(0)) return 0;

        try localVRFConsumer.requestRandomWords() returns (uint256 requestId) {
            vrfRequests[requestId] = VRFRequest({
                user: buyer,
                creatorCoin: creatorCoin,
                amountUSD: swapValueUSD,
                effectiveWinChancePPM: winChancePPM,
                vrfType: VRFType.LOCAL,
                sourceChainEid: sourceChainEid
            });
            totalLotteryEntries++;
            creatorStats[creatorCoin].entries++;
            return requestId;
        } catch {
            return 0;
        }
    }

    /**
     * @notice Request cross-chain VRF with source chain tracking
     */
    function _requestCrossChainVRFWithSource(
        address creatorCoin,
        address buyer,
        uint256 swapValueUSD,
        uint256 winChancePPM,
        uint32 sourceChainEid,
        bytes32 originSender,
        uint256 callerFeeValue
    ) internal returns (uint256) {
        if (address(vrfIntegrator) == address(0) || targetEid == 0) {
            if (callerFeeValue > 0) _refundCallerFeeOrRevert(callerFeeValue);
            return 0;
        }
        if (!trustedVrfIntegrators[address(vrfIntegrator)]) {
            if (callerFeeValue > 0) _refundCallerFeeOrRevert(callerFeeValue);
            return 0;
        }

        try vrfIntegrator.quoteFee() returns (MessagingFee memory fee) {
            uint256 nativeFee = fee.nativeFee;
            bool useCallerFunds = callerFeeValue > 0;
            if (useCallerFunds && callerFeeValue != nativeFee) {
                revert CallerFeeMismatch(callerFeeValue, nativeFee);
            }
            uint256 epochStart;
            bytes32 originKey;

            if (!useCallerFunds && nativeFee > 0) {
                // Sync epoch before rate limit checks.
                _refreshSponsorshipEpoch(vrfSponsorshipPolicy);
                epochStart = vrfSponsorshipPolicy.epochStart;

                // Per-buyer cap (applies to both local and remote entries).
                if (vrfMaxSponsoredPerBuyerPerEpoch > 0) {
                    uint32 buyerCount =
                        _syncSponsoredCountByBuyer(vrfSponsoredCountByBuyer, vrfBuyerEpochStart, buyer, epochStart);
                    if (buyerCount >= vrfMaxSponsoredPerBuyerPerEpoch) {
                        emit SponsorshipSkipped(
                            _sponsorshipContext("VRF_REQUEST"),
                            SponsorshipSkipReason.RATE_LIMITED,
                            nativeFee,
                            swapValueUSD
                        );
                        return 0;
                    }
                }

                // Per-origin cap (remote-only).
                if (sourceChainEid != 0 && vrfMaxSponsoredPerOriginPerEpoch > 0) {
                    originKey = _rateLimitOriginKey(sourceChainEid, originSender);
                    uint32 originCount = _syncSponsoredCountByOrigin(
                        vrfSponsoredCountByOrigin, vrfOriginEpochStart, originKey, epochStart
                    );
                    if (originCount >= vrfMaxSponsoredPerOriginPerEpoch) {
                        emit SponsorshipSkipped(
                            _sponsorshipContext("VRF_REQUEST"),
                            SponsorshipSkipReason.RATE_LIMITED,
                            nativeFee,
                            swapValueUSD
                        );
                        return 0;
                    }
                }

                if (!_consumeSponsorship(
                        vrfSponsorshipPolicy, _sponsorshipContext("VRF_REQUEST"), nativeFee, swapValueUSD, true
                    )) {
                    return 0;
                }
            }

            try vrfIntegrator.requestRandomWordsPayable{value: nativeFee}(targetEid) returns (
                MessagingReceipt memory, uint64 sequence
            ) {
                if (!useCallerFunds && nativeFee > 0) {
                    if (vrfMaxSponsoredPerBuyerPerEpoch > 0) {
                        uint32 buyerCount =
                            _syncSponsoredCountByBuyer(vrfSponsoredCountByBuyer, vrfBuyerEpochStart, buyer, epochStart);
                        vrfSponsoredCountByBuyer[buyer] = buyerCount + 1;
                    }
                    if (sourceChainEid != 0 && vrfMaxSponsoredPerOriginPerEpoch > 0) {
                        uint32 originCount = _syncSponsoredCountByOrigin(
                            vrfSponsoredCountByOrigin, vrfOriginEpochStart, originKey, epochStart
                        );
                        vrfSponsoredCountByOrigin[originKey] = originCount + 1;
                    }
                }

                vrfRequests[uint256(sequence)] = VRFRequest({
                    user: buyer,
                    creatorCoin: creatorCoin,
                    amountUSD: swapValueUSD,
                    effectiveWinChancePPM: winChancePPM,
                    vrfType: VRFType.CROSS_CHAIN,
                    sourceChainEid: sourceChainEid
                });
                totalLotteryEntries++;
                creatorStats[creatorCoin].entries++;
                return uint256(sequence);
            } catch {
                if (useCallerFunds && nativeFee > 0) {
                    // If the caller provided the fee, never trap value on failure.
                    _refundCallerFeeOrRevert(callerFeeValue);
                } else if (nativeFee > 0) {
                    _rollbackSponsoredSpend(vrfSponsorshipPolicy, nativeFee);
                    emit SponsorshipSkipped(
                        _sponsorshipContext("VRF_REQUEST"), SponsorshipSkipReason.SEND_FAILED, nativeFee, swapValueUSD
                    );
                }
                return 0;
            }
        } catch {
            if (callerFeeValue > 0) _refundCallerFeeOrRevert(callerFeeValue);
            return 0;
        }
    }

    /**
     * @dev Send winner callback to the source chain OFT
     *      Payload: (msgType, winner, creatorCoin, totalSharesPaid)
     *      Target: the remote CreatorShareOFT that sent the lottery entry
     */
    function _sendWinnerCallback(uint32 dstEid, address winner, address creatorCoin, uint256 totalSharesPaid) internal {
        // Build callback payload (matches CreatorShareOFT._handleWinnerCallback decoder)
        bytes memory payload = abi.encode(MSG_TYPE_WINNER_CALLBACK, winner, creatorCoin, totalSharesPaid);

        bytes memory options = _buildOptions(dstEid);

        MessagingFee memory fee = _quote(dstEid, payload, options, false);
        uint256 nativeFee = fee.nativeFee;

        if (nativeFee > 0) {
            // Sync epoch before rate limit checks.
            _refreshSponsorshipEpoch(callbackSponsorshipPolicy);
            uint256 epochStart = callbackSponsorshipPolicy.epochStart;

            if (callbackMaxSponsoredPerBuyerPerEpoch > 0) {
                uint32 buyerCount = _syncSponsoredCountByBuyer(
                    callbackSponsoredCountByBuyer, callbackBuyerEpochStart, winner, epochStart
                );
                if (buyerCount >= callbackMaxSponsoredPerBuyerPerEpoch) {
                    emit SponsorshipSkipped(
                        _sponsorshipContext("WINNER_CALLBACK"), SponsorshipSkipReason.RATE_LIMITED, nativeFee, 0
                    );
                    return;
                }
            }

            if (callbackMaxSponsoredPerOriginPerEpoch > 0) {
                bytes32 originKey = _rateLimitOriginKey(dstEid, peers[dstEid]);
                uint32 originCount = _syncSponsoredCountByOrigin(
                    callbackSponsoredCountByOrigin, callbackOriginEpochStart, originKey, epochStart
                );
                if (originCount >= callbackMaxSponsoredPerOriginPerEpoch) {
                    emit SponsorshipSkipped(
                        _sponsorshipContext("WINNER_CALLBACK"), SponsorshipSkipReason.RATE_LIMITED, nativeFee, 0
                    );
                    return;
                }
            }
        }

        if (!_consumeSponsorship(
                callbackSponsorshipPolicy, _sponsorshipContext("WINNER_CALLBACK"), nativeFee, 0, false
            )) return;

        _lzSend(dstEid, payload, options, fee, payable(address(this)));

        if (nativeFee > 0) {
            uint256 epochStart = callbackSponsorshipPolicy.epochStart;
            if (callbackMaxSponsoredPerBuyerPerEpoch > 0) {
                uint32 buyerCount = _syncSponsoredCountByBuyer(
                    callbackSponsoredCountByBuyer, callbackBuyerEpochStart, winner, epochStart
                );
                callbackSponsoredCountByBuyer[winner] = buyerCount + 1;
            }
            if (callbackMaxSponsoredPerOriginPerEpoch > 0) {
                bytes32 originKey = _rateLimitOriginKey(dstEid, peers[dstEid]);
                uint32 originCount = _syncSponsoredCountByOrigin(
                    callbackSponsoredCountByOrigin, callbackOriginEpochStart, originKey, epochStart
                );
                callbackSponsoredCountByOrigin[originKey] = originCount + 1;
            }
        }

        emit WinnerCallbackSent(dstEid, winner, creatorCoin, totalSharesPaid);
        // If insufficient gas, silently skip — payout already happened on hub
    }

    function _sponsorshipContext(string memory label) internal pure returns (bytes32) {
        return keccak256(bytes(label));
    }

    /// @dev Override LayerZero default behavior to support contract-sponsored messaging fees.
    function _payNative(uint256 _nativeFee) internal override returns (uint256 nativeFee) {
        if (msg.value == 0) {
            // Sponsorship path: spend from contract balance.
            if (address(this).balance < _nativeFee) revert NotEnoughNative(msg.value);
            return _nativeFee;
        }
        if (msg.value != _nativeFee) revert NotEnoughNative(msg.value);
        return _nativeFee;
    }

    function _refreshSponsorshipEpoch(SponsorshipPolicy storage policy) internal {
        if (policy.epochDuration == 0) return;
        if (block.timestamp >= policy.epochStart + policy.epochDuration) {
            policy.epochStart = block.timestamp;
            policy.spentInEpoch = 0;
        }
    }

    function _consumeSponsorship(
        SponsorshipPolicy storage policy,
        bytes32 context,
        uint256 feeNative,
        uint256 valueHint,
        bool enforceMinSwap
    ) internal returns (bool) {
        if (feeNative == 0) return true;

        _refreshSponsorshipEpoch(policy);

        if (!policy.enabled) {
            emit SponsorshipSkipped(context, SponsorshipSkipReason.DISABLED, feeNative, valueHint);
            return false;
        }

        if (enforceMinSwap && valueHint < sponsoredVrfMinSwapAmountUSD) {
            emit SponsorshipSkipped(context, SponsorshipSkipReason.BELOW_MIN_SWAP, feeNative, valueHint);
            return false;
        }

        if (feeNative > policy.maxFeePerMessage) {
            emit SponsorshipSkipped(context, SponsorshipSkipReason.FEE_ABOVE_CAP, feeNative, valueHint);
            return false;
        }

        if (address(this).balance < feeNative) {
            emit SponsorshipSkipped(context, SponsorshipSkipReason.INSUFFICIENT_BALANCE, feeNative, valueHint);
            return false;
        }

        if (policy.spentInEpoch + feeNative > policy.budgetPerEpoch) {
            emit SponsorshipSkipped(context, SponsorshipSkipReason.BUDGET_EXCEEDED, feeNative, valueHint);
            return false;
        }

        policy.spentInEpoch += feeNative;
        emit SponsorshipSpendRecorded(context, feeNative, policy.spentInEpoch, policy.budgetPerEpoch, policy.epochStart);
        return true;
    }

    function _rollbackSponsoredSpend(SponsorshipPolicy storage policy, uint256 feeNative) internal {
        if (feeNative == 0) return;
        if (policy.spentInEpoch >= feeNative) {
            policy.spentInEpoch -= feeNative;
        } else {
            policy.spentInEpoch = 0;
        }
    }

    function _refundCallerFeeOrRevert(uint256 amount) internal {
        if (amount == 0) return;
        // Only used on the `processSwapLottery()` payable path, which is nonReentrant.
        (bool success,) = payable(msg.sender).call{value: amount}("");
        require(success);
    }

    function _rateLimitOriginKey(uint32 eid, bytes32 sender) internal pure returns (bytes32) {
        return keccak256(abi.encode(eid, sender));
    }

    function _syncSponsoredCountByBuyer(
        mapping(address => uint32) storage counts,
        mapping(address => uint256) storage epochStarts,
        address buyer,
        uint256 epochStart
    ) internal returns (uint32) {
        if (epochStarts[buyer] != epochStart) {
            epochStarts[buyer] = epochStart;
            counts[buyer] = 0;
        }
        return counts[buyer];
    }

    function _syncSponsoredCountByOrigin(
        mapping(bytes32 => uint32) storage counts,
        mapping(bytes32 => uint256) storage epochStarts,
        bytes32 originKey,
        uint256 epochStart
    ) internal returns (uint32) {
        if (epochStarts[originKey] != epochStart) {
            epochStarts[originKey] = epochStart;
            counts[originKey] = 0;
        }
        return counts[originKey];
    }

    function _buildOptions(uint32 dstEid) internal view returns (bytes memory) {
        bytes memory enforcedOpts = enforcedOptions[dstEid][MSG_TYPE_WINNER_CALLBACK];

        if (enforcedOpts.length > 0) {
            return enforcedOpts;
        }

        return OptionsBuilder.newOptions().addExecutorLzReceiveOption(callbackGasLimit, DEFAULT_MSG_VALUE);
    }

    /**
     * @notice Quote the fee for a winner callback message
     */
    function quoteWinnerCallback(uint32 dstEid, address winner, address creatorCoin, uint256 totalSharesPaid)
        external
        view
        returns (MessagingFee memory fee)
    {
        bytes memory payload = abi.encode(MSG_TYPE_WINNER_CALLBACK, winner, creatorCoin, totalSharesPaid);
        bytes memory options = _buildOptions(dstEid);
        return _quote(dstEid, payload, options, false);
    }

    /**
     * @notice Pay jackpot from ALL active creator vaults (multi-token prize!)
     * @param triggeringCoin The creator coin that triggered the lottery
     * @param winner The lottery winner
     * @param payoutBps Percentage of each vault's jackpot to pay (6900 = 69%)
     * @return totalPaidOut Total number of vaults that paid out
     */
    function _payoutLocalJackpot(address triggeringCoin, address winner, uint16 payoutBps) internal returns (uint256) {
        if (_payoutLock == 1) revert ReentrancyGuardReentrantCall();
        _payoutLock = 1;

        // Get ALL registered creator coins
        address[] memory allCreators = registry.getAllCreatorCoins();
        uint256 totalPaidOut = 0;

        // Pay from EVERY active creator vault
        for (uint256 i = 0; i < allCreators.length; i++) {
            address creatorCoin = allCreators[i];

            // Skip inactive creators
            // slither-disable-next-line calls-loop
            if (!registry.isCreatorCoinActive(creatorCoin)) continue;

            // Look up per-creator contracts
            // slither-disable-next-line calls-loop
            address vaultAddr = registry.getVaultForToken(creatorCoin);
            // slither-disable-next-line calls-loop
            address gaugeAddr = registry.getGaugeControllerForToken(creatorCoin);

            if (vaultAddr == address(0) || gaugeAddr == address(0)) continue;

            ICreatorGaugeControllerLottery gaugeController = ICreatorGaugeControllerLottery(gaugeAddr);

            // slither-disable-next-line calls-loop
            uint256 jackpotShares = gaugeController.getJackpotReserve();

            if (jackpotShares == 0) continue;

            uint256 rewardShares = (jackpotShares * payoutBps) / BASIS_POINTS;

            if (rewardShares > 0) {
                // slither-disable-next-line calls-loop
                // slither-disable-next-line reentrancy-no-eth
                try gaugeController.payJackpot(winner, rewardShares) {
                    totalRewardsPaid += rewardShares;
                    creatorStats[creatorCoin].rewardsPaid += rewardShares;
                    totalPaidOut++;

                    emit LotteryWon(creatorCoin, 0, winner, rewardShares, 0);
                    emit CrossChainJackpotPaid(creatorCoin, winner, rewardShares, 0);
                } catch {
                    emit JackpotPayoutFailed(creatorCoin, winner, rewardShares);
                }
            }
        }

        // Emit special event for multi-token win
        if (totalPaidOut > 0) {
            emit MultiTokenJackpotWon(triggeringCoin, winner, totalPaidOut);
        }
        _payoutLock = 0;
        return totalPaidOut;
    }

    // ================================
    // ADMIN FUNCTIONS
    // ================================

    function setAuthorizedSwapContract(address swapContract, bool authorized) external onlyOwner {
        if (swapContract == address(0)) revert ZeroAddress();
        authorizedSwapContracts[swapContract] = authorized;
        emit SwapContractAuthorized(swapContract, authorized);
    }

    function setLocalVRFConsumer(address _consumer) external onlyOwner {
        localVRFConsumer = ICreatorVRFConsumer(_consumer);
        emit VRFConsumerUpdated(_consumer);
    }

    function setVRFIntegrator(address _integrator) external onlyOwner {
        vrfIntegrator = IChainlinkVRFIntegrator(_integrator);
        if (_integrator != address(0)) {
            trustedVrfIntegrators[_integrator] = true;
        }
        emit VRFIntegratorUpdated(_integrator, _integrator != address(0));
    }

    function setTargetEid(uint32 _eid) external onlyOwner {
        targetEid = _eid;
        emit TargetEidUpdated(_eid);
    }

    function setUseLocalVRF(bool _useLocal) external onlyOwner {
        useLocalVRF = _useLocal;
    }

    function setSponsoredVrfMinSwapAmountUSD(uint256 _minSwapAmountUSD) external onlyOwner {
        if (_minSwapAmountUSD < MIN_SWAP_USD || _minSwapAmountUSD > MAX_SWAP_USD) revert InvalidAmount();
        sponsoredVrfMinSwapAmountUSD = _minSwapAmountUSD;
        emit SponsoredVrfMinSwapUpdated(_minSwapAmountUSD);
    }

    function setVrfSponsorshipPolicy(
        bool enabled,
        uint256 maxFeePerMessage,
        uint256 budgetPerEpoch,
        uint256 epochDuration
    ) external onlyOwner {
        if (epochDuration == 0) revert InvalidAmount();
        _refreshSponsorshipEpoch(vrfSponsorshipPolicy);
        vrfSponsorshipPolicy.enabled = enabled;
        vrfSponsorshipPolicy.maxFeePerMessage = maxFeePerMessage;
        vrfSponsorshipPolicy.budgetPerEpoch = budgetPerEpoch;
        vrfSponsorshipPolicy.epochDuration = epochDuration;
        if (vrfSponsorshipPolicy.epochStart == 0) {
            vrfSponsorshipPolicy.epochStart = block.timestamp;
        }

        emit SponsorshipPolicyUpdated(
            _sponsorshipContext("VRF_REQUEST"), enabled, maxFeePerMessage, budgetPerEpoch, epochDuration
        );
    }

    function setCallbackSponsorshipPolicy(
        bool enabled,
        uint256 maxFeePerMessage,
        uint256 budgetPerEpoch,
        uint256 epochDuration
    ) external onlyOwner {
        if (epochDuration == 0) revert InvalidAmount();
        _refreshSponsorshipEpoch(callbackSponsorshipPolicy);
        callbackSponsorshipPolicy.enabled = enabled;
        callbackSponsorshipPolicy.maxFeePerMessage = maxFeePerMessage;
        callbackSponsorshipPolicy.budgetPerEpoch = budgetPerEpoch;
        callbackSponsorshipPolicy.epochDuration = epochDuration;
        if (callbackSponsorshipPolicy.epochStart == 0) {
            callbackSponsorshipPolicy.epochStart = block.timestamp;
        }

        emit SponsorshipPolicyUpdated(
            _sponsorshipContext("WINNER_CALLBACK"), enabled, maxFeePerMessage, budgetPerEpoch, epochDuration
        );
    }

    /**
     * @notice Configure sponsorship anti-spam rate limits (count-based per epoch).
     * @dev A value of 0 means unlimited.
     */
    function setSponsorshipRateLimits(
        uint32 _vrfMaxPerBuyerPerEpoch,
        uint32 _vrfMaxPerOriginPerEpoch,
        uint32 _callbackMaxPerBuyerPerEpoch,
        uint32 _callbackMaxPerOriginPerEpoch
    ) external onlyOwner {
        vrfMaxSponsoredPerBuyerPerEpoch = _vrfMaxPerBuyerPerEpoch;
        vrfMaxSponsoredPerOriginPerEpoch = _vrfMaxPerOriginPerEpoch;
        callbackMaxSponsoredPerBuyerPerEpoch = _callbackMaxPerBuyerPerEpoch;
        callbackMaxSponsoredPerOriginPerEpoch = _callbackMaxPerOriginPerEpoch;

        emit SponsorshipRateLimitsUpdated(
            _vrfMaxPerBuyerPerEpoch,
            _vrfMaxPerOriginPerEpoch,
            _callbackMaxPerBuyerPerEpoch,
            _callbackMaxPerOriginPerEpoch
        );
    }

    function setBoostManager(address _manager) external onlyOwner {
        boostManager = Ive4626BoostManager(_manager);
    }

    /**
     * @notice Set VaultGaugeVoting for ve(3,3) probability direction
     * @param _vaultGaugeVoting Address of the VaultGaugeVoting contract
     */
    function setVaultGaugeVoting(address _vaultGaugeVoting) external onlyOwner {
        vaultGaugeVoting = IVaultGaugeVoting(_vaultGaugeVoting);
    }

    function setLotteryConfig(
        uint256 _minSwap,
        uint256 _rewardPercentage,
        bool _isActive,
        uint256 _baseWinChance,
        uint256 _maxWinChance,
        uint256 _usdMultiplierBps
    ) external onlyOwner {
        if (_minSwap < MIN_SWAP_USD || _minSwap > MAX_SWAP_USD) revert InvalidAmount();
        if (_rewardPercentage > BASIS_POINTS) revert InvalidAmount();
        if (_maxWinChance > 200_000) revert InvalidAmount();
        if (_baseWinChance > _maxWinChance) revert InvalidAmount();
        if (_usdMultiplierBps < 10000 || _usdMultiplierBps > 15000) revert InvalidAmount();

        lotteryConfig.minSwapAmount = _minSwap;
        lotteryConfig.rewardPercentage = _rewardPercentage;
        lotteryConfig.isActive = _isActive;
        lotteryConfig.baseWinChance = _baseWinChance;
        lotteryConfig.maxWinChance = _maxWinChance;
        lotteryConfig.usdMultiplierBps = _usdMultiplierBps;

        emit LotteryConfigUpdated(_minSwap, _rewardPercentage, _isActive);
    }

    function setOracleMaxStaleness(uint256 _maxStaleness) external onlyOwner {
        oracleMaxStaleness = _maxStaleness;
        emit OracleMaxStalenessUpdated(_maxStaleness);
    }

    function setOracleDeviationGuard(uint256 _maxDeviationBps, uint256 _deviationWindow) external onlyOwner {
        if (_maxDeviationBps > BASIS_POINTS) revert InvalidAmount();
        oracleMaxDeviationBps = _maxDeviationBps;
        oracleDeviationWindow = _deviationWindow;
        emit OracleDeviationGuardUpdated(_maxDeviationBps, _deviationWindow);
    }

    /**
     * @notice Set enforced options for winner callback messages
     */
    function setCallbackOptions(uint32 dstEid, uint128 gasLimit, uint128 msgValue) external onlyOwner {
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(gasLimit, msgValue);

        EnforcedOptionParam[] memory params = new EnforcedOptionParam[](1);
        params[0] = EnforcedOptionParam({eid: dstEid, msgType: MSG_TYPE_WINNER_CALLBACK, options: options});

        _setEnforcedOptions(params);
    }

    /**
     * @notice Authorize a remote OFT as a valid lottery entry sender
     * @param srcEid The source chain EID
     * @param sender The bytes32-encoded address of the remote OFT
     * @param authorized Whether to authorize or deauthorize
     */
    function setAuthorizedRemoteOFT(uint32 srcEid, bytes32 sender, bool authorized) external onlyOwner {
        authorizedRemoteOFTs[srcEid][sender] = authorized;
        emit RemoteOFTAuthorized(srcEid, sender, authorized);
    }

    /**
     * @notice Batch authorize remote OFTs
     */
    function batchSetAuthorizedRemoteOFTs(uint32[] calldata srcEids, bytes32[] calldata senders, bool authorized)
        external
        onlyOwner
    {
        if (srcEids.length != senders.length) revert InvalidAmount();
        for (uint256 i; i < srcEids.length;) {
            authorizedRemoteOFTs[srcEids[i]][senders[i]] = authorized;
            emit RemoteOFTAuthorized(srcEids[i], senders[i], authorized);
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Set the gas limit for winner callback messages
     */
    function setCallbackGasLimit(uint128 _gasLimit) external onlyOwner {
        callbackGasLimit = _gasLimit;
        emit CallbackGasLimitUpdated(_gasLimit);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ================================
    // VIEW FUNCTIONS
    // ================================

    function getWinChance(uint256 swapAmountUSD) external view returns (uint256) {
        return calculateWinChance(swapAmountUSD);
    }

    /**
     * @notice Get global lottery stats
     */
    function getGlobalStats() external view returns (uint256 entries, uint256 winners, uint256 rewards) {
        return (totalLotteryEntries, totalWinners, totalRewardsPaid);
    }

    /**
     * @notice Get lottery stats for a specific creator coin
     */
    function getCreatorLotteryStats(address creatorCoin)
        external
        view
        returns (uint256 entries, uint256 winners, uint256 rewardsPaid, uint256 jackpotBalance)
    {
        CreatorStats storage stats = creatorStats[creatorCoin];

        // Get jackpot balance from per-creator contracts
        address vaultAddr = registry.getVaultForToken(creatorCoin);
        address gaugeAddr = registry.getGaugeControllerForToken(creatorCoin);

        if (vaultAddr != address(0) && gaugeAddr != address(0)) {
            ICreatorGaugeControllerLottery gaugeController = ICreatorGaugeControllerLottery(gaugeAddr);
            jackpotBalance = gaugeController.getJackpotReserve();
        }

        return (stats.entries, stats.winners, stats.rewardsPaid, jackpotBalance);
    }

    /**
     * @notice Get remote lottery entry statistics
     */
    function getRemoteLotteryStats() external view returns (uint256) {
        return totalRemoteLotteryEntries;
    }

    // ================================
    // EMERGENCY
    // ================================

    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            (bool ok,) = payable(owner()).call{value: amount}("");
            if (!ok) revert InvalidAmount();
        } else {
            IERC20(token).safeTransfer(owner(), amount);
        }
    }

    receive() external payable {}
}
