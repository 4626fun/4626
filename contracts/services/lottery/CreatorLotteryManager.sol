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
 *      3. Win probability scales with trade size ($1 = base, $1000 = max)
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
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {MessagingReceipt} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";
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
    function getLayerZeroEndpoint(uint16 _chainId) external view returns (address);

    // Global queries
    function getAllCreatorCoins() external view returns (address[] memory);
}

interface ICreatorGaugeControllerLottery {
    function getJackpotReserve(address vault) external view returns (uint256);
    function payJackpot(address vault, address winner, uint256 shares) external;
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

    uint256 public constant MIN_SWAP_USD = 1_000_000;      // $1 (6 decimals)
    uint256 public constant MAX_SWAP_USD = 1_000_000_000_000; // $1M
    uint256 public constant BASIS_POINTS = 10_000;

    /// @notice Message types for hub-centric architecture
    uint16 public constant MSG_TYPE_LOTTERY_ENTRY = 3;
    uint16 public constant MSG_TYPE_WINNER_CALLBACK = 4;

    uint128 public constant DEFAULT_GAS_LIMIT = 200_000;
    uint128 public constant DEFAULT_MSG_VALUE = 0;
    uint128 public constant DEFAULT_CALLBACK_GAS_LIMIT = 100_000;
    
    /// @notice Maximum boost for ve4626 lockers (2.5x = 25000 bps)
    uint256 public constant MAX_VE_BOOST = 25000;

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

    /// @notice Minimum vault weight in bps (vaults with 0 votes get this minimum)
    uint256 public minVaultWeightBps = 100; // 1% minimum

    /// @notice Lottery configuration (shared across all creators)
    struct LotteryConfig {
        uint256 minSwapAmount;
        uint256 rewardPercentage;  // bps of jackpot
        bool isActive;
        uint256 baseWinChance;     // PPM (parts per million)
        uint256 maxWinChance;      // PPM
        uint256 usdMultiplierBps;  // Bonus for slippage (10500 = 1.05x)
    }

    LotteryConfig public lotteryConfig;

    /// @notice VRF request tracking - includes creator coin and source chain
    enum VRFType { LOCAL, CROSS_CHAIN }

    struct VRFRequest {
        address user;
        address creatorCoin;     // Which creator coin this entry is for
        uint256 amountUSD;
        VRFType vrfType;
        uint32 sourceChainEid;   // 0 = local (hub), non-zero = remote chain lottery entry
    }

    mapping(uint256 => VRFRequest) public vrfRequests;

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
    event CrossChainJackpotPaid(address indexed creatorCoin, address indexed winner, uint256 shares, uint256 tokenValue);
    event LotteryWon(address indexed creatorCoin, uint256 indexed entryId, address indexed winner, uint256 shares, uint256 tokenValue);
    event MultiTokenJackpotWon(address indexed triggeringCoin, address indexed winner, uint256 numVaultsPaid);
    event RemoteLotteryEntryReceived(
        uint32 indexed srcEid,
        address indexed buyer,
        address indexed tokenIn,
        uint256 amount,
        uint32 sourceChainId
    );
    event WinnerCallbackSent(
        uint32 indexed dstEid,
        address indexed winner,
        address indexed creatorCoin,
        uint256 totalSharesPaid
    );
    event RemoteOFTAuthorized(uint32 indexed srcEid, bytes32 sender, bool authorized);
    event CallbackGasLimitUpdated(uint128 newGasLimit);
    event VRFConsumerUpdated(address indexed consumer);
    event TargetEidUpdated(uint32 indexed targetEid);
    event VRFIntegratorUpdated(address indexed integrator, bool trusted);
    event BoostManagerUpdated(address indexed manager);
    event VaultGaugeVotingUpdated(address indexed vaultGaugeVoting);
    event MinVaultWeightUpdated(uint256 minWeightBps);

    // ================================
    // ERRORS
    // ================================

    error ZeroAddress();
    error Unauthorized();
    error InvalidAmount();
    error CreatorCoinNotRegistered(address token);
    error NoOracleConfigured(address token);
    error NoVaultConfigured(address token);
    error NoGaugeConfigured(address token);

    // ================================
    // CONSTRUCTOR
    // ================================

    /**
     * @notice Deploy shared lottery manager
     * @param _registry CreatorRegistry address
     * @param owner_ Owner address
     */
    constructor(
        address _registry,
        address owner_
    ) OApp(
        ICreatorRegistryLottery(_registry).getLayerZeroEndpoint(uint16(block.chainid)),
        owner_
    ) Ownable(owner_) {
        if (owner_ == address(0)) revert ZeroAddress();
        if (_registry == address(0)) revert ZeroAddress();

        registry = ICreatorRegistryLottery(_registry);

        // Initialize lottery config
        lotteryConfig = LotteryConfig({
            minSwapAmount: MIN_SWAP_USD,
            rewardPercentage: 6900, // 69% of jackpot
            isActive: true,
            baseWinChance: 40,      // 0.004%
            maxWinChance: 40000,    // 4%
            usdMultiplierBps: 10500 // 1.05x
        });
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
    function processSwapLottery(
        address buyer,
        address tokenIn,
        uint256 amountIn
    ) external payable nonReentrant onlyAuthorizedSwapContract whenNotPaused returns (uint256 entryId) {
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

        // Calculate USD value using per-creator oracle
        uint256 swapValueUSD = _calculateTokenUSD(creatorCoin, tokenIn, amountIn);

        if (swapValueUSD < lotteryConfig.minSwapAmount) {
            return 0;
        }

        if (!lotteryConfig.isActive) {
            return 0;
        }

        // Get vault for this creator coin (for ve(3,3) vault weighting)
        address vault = registry.getVaultForToken(creatorCoin);

        // Calculate win probability with ve(3,3) boosts
        uint256 baseWinChance = calculateWinChance(swapValueUSD);
        uint256 boostedWinChance = _applyBoost(buyer, vault, swapValueUSD, baseWinChance);

        // Request VRF
        if (useLocalVRF && address(localVRFConsumer) != address(0)) {
            return _requestLocalVRF(creatorCoin, buyer, swapValueUSD, boostedWinChance);
        } else {
            return _requestCrossChainVRF(creatorCoin, buyer, swapValueUSD, boostedWinChance);
        }
    }

    /**
     * @notice Request cross-chain VRF (hub local call path, sourceChainEid = 0)
     */
    function _requestCrossChainVRF(
        address creatorCoin,
        address buyer,
        uint256 swapValueUSD,
        uint256 winChancePPM
    ) internal returns (uint256) {
        return _requestCrossChainVRFWithSource(creatorCoin, buyer, swapValueUSD, winChancePPM, 0);
    }

    /**
     * @notice Request local VRF (hub local call path, sourceChainEid = 0)
     */
    function _requestLocalVRF(
        address creatorCoin,
        address buyer,
        uint256 swapValueUSD,
        uint256 winChancePPM
    ) internal returns (uint256) {
        return _requestLocalVRFWithSource(creatorCoin, buyer, swapValueUSD, winChancePPM, 0);
    }

    // ================================
    // VRF CALLBACKS
    // ================================

    /**
     * @notice Local VRF callback
     */
    function receiveRandomWords(uint256 requestId, uint256[] memory randomWords) external nonReentrant {
        require(msg.sender == address(localVRFConsumer), "Only VRF consumer");
        _processVRFResult(requestId, randomWords);
    }

    /**
     * @notice Cross-chain VRF callback
     */
    function receiveRandomWords(uint256[] memory randomWords, uint256 sequence) external nonReentrant {
        require(msg.sender == address(vrfIntegrator), "Only VRF integrator");
        _processVRFResult(sequence, randomWords);
    }

    function _processVRFResult(uint256 requestId, uint256[] memory randomWords) internal {
        if (randomWords.length == 0) return;

        VRFRequest memory request = vrfRequests[requestId];
        if (request.user == address(0)) return;

        delete vrfRequests[requestId];

        uint256 winChancePPM = calculateWinChance(request.amountUSD);
        uint256 randomResult = randomWords[0] % 1_000_000;

        if (randomResult < winChancePPM) {
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
    function _calculateTokenUSD(
        address creatorCoin,
        address tokenIn,
        uint256 amount
    ) internal view returns (uint256 usd1e6) {
        // Get per-creator oracle
        address oracleAddr = registry.getOracleForToken(creatorCoin);
        if (oracleAddr == address(0)) return 0;
        
        // Get per-creator shareOFT
        address shareOFT = registry.getShareOFTForToken(creatorCoin);
        
        // Only works for creator token or its shareOFT
        if (tokenIn != creatorCoin && tokenIn != shareOFT) return 0;
        if (amount == 0) return 0;

        ICreatorOracle oracle = ICreatorOracle(oracleAddr);
        (int256 priceUSD, uint256 timestamp) = oracle.getCreatorPrice();
        if (priceUSD <= 0 || timestamp == 0) return 0;
        if (block.timestamp - timestamp > 7200) return 0;

        // forge-lint: disable-next-line(unsafe-typecast)
        uint256 usd1e18 = Math.mulDiv(amount, uint256(priceUSD), 1e18);
        if (lotteryConfig.usdMultiplierBps > 0) {
            usd1e18 = Math.mulDiv(usd1e18, lotteryConfig.usdMultiplierBps, BASIS_POINTS);
        }
        usd1e6 = usd1e18 / 1e12;
    }

    function calculateWinChance(uint256 swapAmountUSD) public view returns (uint256 winChancePPM) {
        if (swapAmountUSD <= lotteryConfig.minSwapAmount) {
            return lotteryConfig.baseWinChance;
        }

        uint256 scaledAmount = swapAmountUSD - lotteryConfig.minSwapAmount;
        uint256 maxScale = 1_000_000_000; // $1000

        if (scaledAmount >= maxScale) {
            return lotteryConfig.maxWinChance;
        }

        uint256 chanceRange = lotteryConfig.maxWinChance - lotteryConfig.baseWinChance;
        winChancePPM = lotteryConfig.baseWinChance + (scaledAmount * chanceRange / maxScale);
    }

    /**
     * @notice Apply ve(3,3) boosts to base win probability
     * @param user The user who made the swap
     * @param vault The vault where the swap occurred (for gauge allocation)
     * @param swapAmountUSD Swap size in USD (1e6)
     * @param baseWinChance Base win chance in PPM
     * @return boostedWinChance Final win chance after all boosts
     *
     * @dev ve(3,3) PROBABILITY MODEL (current implementation):
     *      FinalPPM = BasePPM × PersonalBoost + LockDurationBoostPPM + VaultGaugeBoostPPM
     *
     * Where:
     * - BasePPM: derived from swap size
     * - PersonalBoost: ve4626 (up to 2.5x)
     * - LockDurationBoostPPM: additional additive boost from lock duration
     * - VaultGaugeBoostPPM: additive boost allocated from a bounded weekly gauge budget
     */
    function _applyBoost(
        address user,
        address vault,
        uint256 swapAmountUSD,
        uint256 baseWinChance
    ) internal view returns (uint256 boostedWinChance) {
        boostedWinChance = baseWinChance;

        // STEP 1: Apply personal ve4626 boost (up to 2.5x)
        if (address(boostManager) != address(0)) {
            try boostManager.calculateBoost(user) returns (uint256 boostBPS) {
                if (boostBPS > 10000) {
                    boostBPS = boostBPS > MAX_VE_BOOST ? MAX_VE_BOOST : boostBPS;
                    boostedWinChance = (baseWinChance * boostBPS) / 10000;
                }
            } catch {}

            // Additional probability boost from lock duration
            try boostManager.getTotalProbabilityBoost(user) returns (uint256 probBoostBps) {
                if (probBoostBps > 0) {
                    uint256 additionalPPM = probBoostBps * 100;
                    boostedWinChance += additionalPPM;
                }
            } catch {}
        }

        // STEP 2: Add vault gauge boost (vote-directed probability budget)
        // The gauge returns a bounded PPM boost for this vault. We scale it by swap size so
        // tiny swaps don't fully capture the weekly budget (anti-spam).
        if (address(vaultGaugeVoting) != address(0) && vault != address(0)) {
            try vaultGaugeVoting.getVaultGaugeProbabilityBoostPPM(vault) returns (uint256 gaugeBoostPPM) {
                if (gaugeBoostPPM > 0) {
                    boostedWinChance += _scaleGaugeBoostBySwapSize(gaugeBoostPPM, swapAmountUSD);
                }
            } catch {}
        }

        // Cap at maximum
        if (boostedWinChance > lotteryConfig.maxWinChance) {
            boostedWinChance = lotteryConfig.maxWinChance;
        }
    }

    function _scaleGaugeBoostBySwapSize(uint256 gaugeBoostPPM, uint256 swapAmountUSD) internal view returns (uint256) {
        // Mirror the same linear scaling region used by calculateWinChance()
        uint256 minSwap = lotteryConfig.minSwapAmount;
        if (swapAmountUSD <= minSwap) return 0;

        uint256 scaledAmount = swapAmountUSD - minSwap;
        uint256 maxScale = 1_000_000_000; // $1000 (6 decimals)
        if (scaledAmount >= maxScale) return gaugeBoostPPM;

        // Linear ramp from 0 → full boost over the first $1000 above minSwap
        return (gaugeBoostPPM * scaledAmount) / maxScale;
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
    function _lzReceive(
        Origin calldata _origin,
        bytes32,
        bytes calldata _payload,
        address,
        bytes calldata
    ) internal override {
        // Verify sender is an authorized remote OFT
        require(
            authorizedRemoteOFTs[_origin.srcEid][_origin.sender],
            "Unauthorized remote OFT"
        );

        // Decode message type
        require(_payload.length >= 32, "Invalid payload");
        uint16 msgType = abi.decode(_payload[:32], (uint16));

        if (msgType == MSG_TYPE_LOTTERY_ENTRY) {
            _handleLotteryEntry(_origin.srcEid, _payload);
        } else {
            revert("Unknown message type");
        }
    }

    /**
     * @dev Handle a lottery entry from a remote chain OFT
     *      Payload: (msgType, buyer, tokenIn, amount, sourceChainId)
     */
    function _handleLotteryEntry(uint32 srcEid, bytes calldata _payload) internal {
        (
            , // msgType (already checked)
            address buyer,
            address tokenIn,
            uint256 amount,
            uint32 sourceChainId
        ) = abi.decode(_payload, (uint16, address, address, uint256, uint32));

        if (buyer == address(0) || tokenIn == address(0) || amount == 0) return;

        totalRemoteLotteryEntries++;
        emit RemoteLotteryEntryReceived(srcEid, buyer, tokenIn, amount, sourceChainId);

        // Derive creator coin from tokenIn (■TOKEN)
        address creatorCoin = registry.getTokenForShareOFT(tokenIn);
        if (creatorCoin == address(0)) return;
        if (!registry.isCreatorCoinActive(creatorCoin)) return;

        // Calculate USD value using per-creator oracle
        uint256 swapValueUSD = _calculateTokenUSD(creatorCoin, tokenIn, amount);
        if (swapValueUSD < lotteryConfig.minSwapAmount) return;
        if (!lotteryConfig.isActive) return;

        // Get vault for this creator coin (for ve(3,3) vault weighting)
        address vault = registry.getVaultForToken(creatorCoin);

        // Calculate win probability with ve(3,3) boosts
        uint256 baseWinChance = calculateWinChance(swapValueUSD);
        uint256 boostedWinChance = _applyBoost(buyer, vault, swapValueUSD, baseWinChance);

        // Request VRF with sourceChainEid so we can send callback on win
        uint256 entryId;
        if (useLocalVRF && address(localVRFConsumer) != address(0)) {
            entryId = _requestLocalVRFWithSource(creatorCoin, buyer, swapValueUSD, boostedWinChance, srcEid);
        } else {
            entryId = _requestCrossChainVRFWithSource(creatorCoin, buyer, swapValueUSD, boostedWinChance, srcEid);
        }

        if (entryId > 0) {
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
        uint256 /* winChancePPM */,
        uint32 sourceChainEid
    ) internal returns (uint256) {
        if (address(localVRFConsumer) == address(0)) return 0;

        try localVRFConsumer.requestRandomWords() returns (uint256 requestId) {
            vrfRequests[requestId] = VRFRequest({
                user: buyer,
                creatorCoin: creatorCoin,
                amountUSD: swapValueUSD,
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
        uint256 /* winChancePPM */,
        uint32 sourceChainEid
    ) internal returns (uint256) {
        if (address(vrfIntegrator) == address(0) || targetEid == 0) return 0;
        if (!trustedVrfIntegrators[address(vrfIntegrator)]) return 0;

        try vrfIntegrator.quoteFee() returns (MessagingFee memory fee) {
            if (address(this).balance >= fee.nativeFee) {
                try vrfIntegrator.requestRandomWordsPayable{value: fee.nativeFee}(targetEid) returns (
                    MessagingReceipt memory,
                    uint64 sequence
                ) {
                    vrfRequests[uint256(sequence)] = VRFRequest({
                        user: buyer,
                        creatorCoin: creatorCoin,
                        amountUSD: swapValueUSD,
                        vrfType: VRFType.CROSS_CHAIN,
                        sourceChainEid: sourceChainEid
                    });
                    totalLotteryEntries++;
                    creatorStats[creatorCoin].entries++;
                    return uint256(sequence);
                } catch {
                    return 0;
                }
            }
        } catch {
            return 0;
        }
        return 0;
    }

    /**
     * @dev Send winner callback to the source chain OFT
     *      Payload: (msgType, winner, creatorCoin, totalSharesPaid)
     *      Target: the remote CreatorShareOFT that sent the lottery entry
     */
    function _sendWinnerCallback(
        uint32 dstEid,
        address winner,
        address creatorCoin,
        uint256 totalSharesPaid
    ) internal {
        // Build callback payload (matches CreatorShareOFT._handleWinnerCallback decoder)
        bytes memory payload = abi.encode(
            MSG_TYPE_WINNER_CALLBACK,
            winner,
            creatorCoin,
            totalSharesPaid
        );

        bytes memory options = _buildOptions(dstEid);

        MessagingFee memory fee = _quote(dstEid, payload, options, false);

        // Only send if contract has enough gas, don't block payout
        if (address(this).balance >= fee.nativeFee) {
            _lzSend(dstEid, payload, options, fee, payable(address(this)));
            emit WinnerCallbackSent(dstEid, winner, creatorCoin, totalSharesPaid);
        }
        // If insufficient gas, silently skip — payout already happened on hub
    }

    function _buildOptions(uint32 dstEid) internal view returns (bytes memory) {
        bytes memory enforcedOpts = enforcedOptions[dstEid][MSG_TYPE_WINNER_CALLBACK];

        if (enforcedOpts.length > 0) {
            return enforcedOpts;
        }

        return OptionsBuilder.newOptions()
            .addExecutorLzReceiveOption(callbackGasLimit, DEFAULT_MSG_VALUE);
    }

    /**
     * @notice Quote the fee for a winner callback message
     */
    function quoteWinnerCallback(
        uint32 dstEid,
        address winner,
        address creatorCoin,
        uint256 totalSharesPaid
    ) external view returns (MessagingFee memory fee) {
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
    function _payoutLocalJackpot(
        address triggeringCoin,
        address winner,
        uint16 payoutBps
    ) internal returns (uint256) {
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
            uint256 jackpotShares = gaugeController.getJackpotReserve(vaultAddr);

            if (jackpotShares == 0) continue;

            uint256 rewardShares = (jackpotShares * payoutBps) / BASIS_POINTS;

            if (rewardShares > 0) {
                totalRewardsPaid += rewardShares;
                creatorStats[creatorCoin].rewardsPaid += rewardShares;
                totalPaidOut++;

                emit LotteryWon(creatorCoin, 0, winner, rewardShares, 0);
                emit CrossChainJackpotPaid(creatorCoin, winner, rewardShares, 0);

                // slither-disable-next-line calls-loop
                // slither-disable-next-line reentrancy-no-eth
                gaugeController.payJackpot(vaultAddr, winner, rewardShares);
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

    function setBoostManager(address _manager) external onlyOwner {
        boostManager = Ive4626BoostManager(_manager);
        emit BoostManagerUpdated(_manager);
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
     * @notice Set minimum vault weight in bps
     * @param _minWeightBps Minimum weight (e.g., 100 = 1%)
     */
    function setMinVaultWeightBps(uint256 _minWeightBps) external onlyOwner {
        require(_minWeightBps <= 1000, "Max 10%"); // Cap at 10%
        minVaultWeightBps = _minWeightBps;
        emit MinVaultWeightUpdated(_minWeightBps);
    }

    function setLotteryConfig(
        uint256 _minSwap,
        uint256 _rewardPercentage,
        bool _isActive,
        uint256 _baseWinChance,
        uint256 _maxWinChance,
        uint256 _usdMultiplierBps
    ) external onlyOwner {
        require(_minSwap >= MIN_SWAP_USD && _minSwap <= MAX_SWAP_USD, "Invalid min");
        require(_rewardPercentage <= BASIS_POINTS, "Invalid reward");
        require(_maxWinChance <= 100_000, "Max too high");
        require(_baseWinChance <= _maxWinChance, "Base > max");
        require(_usdMultiplierBps >= 10000 && _usdMultiplierBps <= 15000, "Invalid multiplier");

        lotteryConfig.minSwapAmount = _minSwap;
        lotteryConfig.rewardPercentage = _rewardPercentage;
        lotteryConfig.isActive = _isActive;
        lotteryConfig.baseWinChance = _baseWinChance;
        lotteryConfig.maxWinChance = _maxWinChance;
        lotteryConfig.usdMultiplierBps = _usdMultiplierBps;

        emit LotteryConfigUpdated(_minSwap, _rewardPercentage, _isActive);
    }

    /**
     * @notice Set enforced options for winner callback messages
     */
    function setCallbackOptions(
        uint32 dstEid,
        uint128 gasLimit,
        uint128 msgValue
    ) external onlyOwner {
        bytes memory options = OptionsBuilder.newOptions()
            .addExecutorLzReceiveOption(gasLimit, msgValue);

        EnforcedOptionParam[] memory params = new EnforcedOptionParam[](1);
        params[0] = EnforcedOptionParam({
            eid: dstEid,
            msgType: MSG_TYPE_WINNER_CALLBACK,
            options: options
        });

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
    function batchSetAuthorizedRemoteOFTs(
        uint32[] calldata srcEids,
        bytes32[] calldata senders,
        bool authorized
    ) external onlyOwner {
        require(srcEids.length == senders.length, "Length mismatch");
        for (uint256 i; i < srcEids.length;) {
            authorizedRemoteOFTs[srcEids[i]][senders[i]] = authorized;
            emit RemoteOFTAuthorized(srcEids[i], senders[i], authorized);
            unchecked { ++i; }
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
    function getGlobalStats() external view returns (
        uint256 entries,
        uint256 winners,
        uint256 rewards
    ) {
        return (totalLotteryEntries, totalWinners, totalRewardsPaid);
    }

    /**
     * @notice Get lottery stats for a specific creator coin
     */
    function getCreatorLotteryStats(address creatorCoin) external view returns (
        uint256 entries,
        uint256 winners,
        uint256 rewardsPaid,
        uint256 jackpotBalance
    ) {
        CreatorStats storage stats = creatorStats[creatorCoin];
        
        // Get jackpot balance from per-creator contracts
        address vaultAddr = registry.getVaultForToken(creatorCoin);
        address gaugeAddr = registry.getGaugeControllerForToken(creatorCoin);
        
        if (vaultAddr != address(0) && gaugeAddr != address(0)) {
            ICreatorGaugeControllerLottery gaugeController = ICreatorGaugeControllerLottery(gaugeAddr);
            jackpotBalance = gaugeController.getJackpotReserve(vaultAddr);
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
            (bool ok, ) = payable(owner()).call{value: amount}("");
            require(ok, "Failed");
        } else {
            IERC20(token).safeTransfer(owner(), amount);
        }
    }

    receive() external payable {}
}
