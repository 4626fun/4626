// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

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

    /// @notice Hard cap on the number of *active* creator coins evaluated in
    /// a single jackpot payout. Caps the gas cost of
    /// _payoutLocalJackpotInner() so the function cannot be bricked by a
    /// growing registry (M-06 / 4626-315). Remainder active coins roll to
    /// the next jackpot via the payout cursor.
    uint256 public constant MAX_JACKPOT_PAYOUT_ITERATIONS = 128;

    /// @notice Hard cap on the number of registry slots scanned in a single
    /// jackpot payout, regardless of active/inactive status. Because
    /// registeredTokens is append-only and inactive entries are never
    /// removed, a long prefix of inactive coins would otherwise consume the
    /// active cap without paying any active creator. The slot cap bounds the
    /// worst-case all-inactive loop while the cursor carries progress into
    /// the next call until an active creator is found. Set materially higher
    /// than MAX_JACKPOT_PAYOUT_ITERATIONS so natural inactive density does
    /// not starve active creators.
    uint256 public constant MAX_JACKPOT_PAYOUT_SLOT_SCANS = 1024;

    /// @notice Message types for hub-centric architecture
    uint16 public constant MSG_TYPE_LOTTERY_ENTRY = 3;
    uint16 public constant MSG_TYPE_WINNER_CALLBACK = 4;

    /// @notice Delay between proposing and committing a boost-source change
    /// once `timelockArmed` is true. See `proposeBoostManager` /
    /// `proposeVaultGaugeVoting` and docs/security/amoe-pr3-handoff.md.
    /// @dev `internal` on main to save EIP-170 budget; the same constant is
    ///      exposed `public` on the admin module for off-chain consumers and
    ///      is also surfaced via `getBoostSourceTimelockState`.
    uint256 internal constant BOOST_SOURCE_TIMELOCK = 24 hours;

    uint128 internal constant DEFAULT_GAS_LIMIT = 200_000;
    uint128 internal constant DEFAULT_MSG_VALUE = 0;
    uint128 internal constant DEFAULT_CALLBACK_GAS_LIMIT = 100_000;
    uint256 internal constant DEFAULT_SPONSOR_EPOCH_DURATION = 1 hours;
    uint256 internal constant DEFAULT_VRF_SPONSOR_MAX_FEE = 0.01 ether;
    uint256 internal constant DEFAULT_VRF_SPONSOR_BUDGET = 0.25 ether;
    uint256 internal constant DEFAULT_CALLBACK_SPONSOR_MAX_FEE = 0.01 ether;
    uint256 internal constant DEFAULT_CALLBACK_SPONSOR_BUDGET = 0.1 ether;
    bytes32 internal constant VRF_REQUEST_CONTEXT =
        0xd84f4bdfe2e4cf43345263bca820ebe0fd153da9fd7f53871b6103ba604a4430;
    bytes32 internal constant WINNER_CALLBACK_CONTEXT =
        0x197005c8271d0fbeff8e5770b1fa02e04e4ba94e019fc8ea71c55fd52eb21205;

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
        // Tunable lottery-odds boost knob applied inside `_calculateTokenUSD`
        // to every paid-path token→USD conversion (swap input + balance read).
        // Bounds [10_000, 15_000]: 10_000 = neutral (1.00x, no effect),
        // > 10_000 inflates lottery PPM as a marketing/engagement boost.
        // Production must set this to 10_000 at deploy via setLotteryConfig.
        // Historically labeled "slippage bonus" but it does not function as one:
        // applies uniformly to balance reads, only scales upward, and
        // directly inflates `winChancePPM = swapValueUSD / 250_000` rather
        // than truing-up an executed value. AMOE bypasses this multiplier
        // entirely because `pointsBurnedAsUSD` is already an end-value USD
        // figure (no token→USD conversion). At the production setting of
        // 10_000, AMOE and paid paths produce identical PPM at equal notional.
        uint256 usdMultiplierBps;
    }

    LotteryConfig public lotteryConfig;

    /// @notice Max acceptable oracle staleness (seconds).
    /// @dev Used as defense-in-depth; default preserves prior 2h hardcode.
    uint256 public oracleMaxStaleness = 2 hours;

    // FIX: CLM-02 — grace period after which VRF results are rejected as stale
    uint256 public vrfResultGracePeriod = 30 minutes;

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
    enum CallbackDropReason {
        BUYER_RATE_LIMITED,
        ORIGIN_RATE_LIMITED,
        SPONSORSHIP_UNAVAILABLE
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
        // FIX: CLM-02 — track request creation time to reject stale VRF results
        uint256 requestTimestamp;
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
    address private immutable _adminModule;

    // ================================
    // STATE — AMOE LINEAR PARITY (PR 1)
    // ================================
    //
    // The fields below are appended at the END of contract storage so the slot
    // layout remains a strict superset of the audited version. The mirror in
    // CreatorLotteryManagerAdminModule appends the same fields in the same
    // order so delegatecall continues to read/write identical slots.
    //
    // baseCeilingPPM: pre-boost win-chance cap. Default 40_000 PPM = 4%.
    //   The new linear formula is `winChancePPM = swapValueUSD / 250_000`,
    //   capped at baseCeilingPPM. The legacy `lotteryConfig.baseWinChance`
    //   field is retained for slot/ABI parity but is no longer read.
    // authorizedAmoeRelayer: the only address allowed to call
    //   `processAmoeEntry`. Single-address allowlist (rather than a mapping)
    //   to keep the audit surface minimal. The relayer is the same trusted
    //   off-chain key that today signs AMOE submissions in lotteryAmoe.ts.
    /// @notice Pre-boost win-chance ceiling (PPM). The linear formula is
    /// `winChancePPM = swapValueUSD / 250_000` capped at this value.
    /// Default 40_000 PPM (= 4% at $10K swap).
    uint256 public baseCeilingPPM;

    /// @notice Trusted relayer authorized to call `processAmoeEntry`.
    /// Off-chain points-to-USD accounting is trusted to this key in PR 1;
    /// PR 4 (zkMetal-bound pointsBurned) will move that trust into a
    /// circuit-bound public input. See docs/security/amoe-pr1-handoff.md.
    address public authorizedAmoeRelayer;

    // ================================
    // STATE — BOOST-SOURCE TIMELOCK (PR 3)
    // ================================
    //
    // Appended at the end of contract storage; mirrored in
    // CreatorLotteryManagerAdminModule in the same order so delegatecall
    // continues to read/write identical slots. See docs/security/amoe-pr3-handoff.md.
    //
    // Threat model: a compromised owner key swapping in a malicious
    // boostManager / vaultGaugeVoting could lift any user's odds up to the
    // absolute `lotteryConfig.maxWinChance` cap (default 15%) in a single tx.
    // The timelock forces a 24h pending-then-effective window so off-chain
    // monitoring + emergency response (or `disableBoostSources`) can react.
    //
    // Until `armBoostSourceTimelock()` is called, the legacy single-call
    // setters (`setBoostManager`, `setVaultGaugeVoting`) continue to work for
    // operational bootstrap. Once armed they revert and the
    // propose/commit/cancel flow is the only path forward.

    /// @dev Pending replacement for `boostManager`, set by `proposeBoostManager`.
    /// Read via `getPendingBoostSources()` to keep main-contract bytecode
    /// under EIP-170; the storage layout is mirrored in the admin module.
    address internal _pendingBoostManager;
    uint256 internal _pendingBoostManagerEffectiveAt;
    address internal _pendingVaultGaugeVoting;
    uint256 internal _pendingVaultGaugeVotingEffectiveAt;

    /// @dev Once true, the legacy `setBoostManager` / `setVaultGaugeVoting`
    /// setters revert and the timelocked propose/commit/cancel flow is the
    /// only path. One-way switch (no disarm). Read via `isTimelockArmed()`.
    bool internal _timelockArmed;

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
    // FIX: CLM-03 — compact reason code to reduce bytecode from repeated string literals
    event WinnerCallbackDropped(
        uint32 indexed dstEid,
        address indexed winner,
        address indexed creatorCoin,
        uint256 totalSharesPaid,
        uint8 reason
    );
    // FIX: CLM-09 — event for invalid payloads (replaces revert to avoid bricking LZ lane)
    event InvalidPayloadReceived(uint32 indexed srcEid, uint256 payloadLength);
    // FIX: CLM-02 — event for stale VRF results that are discarded
    event StaleVRFResultDiscarded(uint256 indexed requestId, uint256 requestTimestamp, uint256 gracePeriod);

    // PR 1 — AMOE Linear Parity events.
    // Note: AMOE entries also emit `LotteryEntryCreated` (same shape as paid path).
    // `AmoeEntryRecorded` is intentionally omitted to keep runtime bytecode under EIP-170.
    // Off-chain: filter LotteryEntryCreated and cross-reference msg.sender / relayer
    // (or watch for any future AMOE-specific event added in PR 4 once we have headroom).
    event AuthorizedAmoeRelayerUpdated(address indexed previousRelayer, address indexed newRelayer);
    event BaseCeilingPPMUpdated(uint256 previousCeilingPPM, uint256 newCeilingPPM);

    // PR 3 — Boost-source timelock events.
    event BoostManagerProposed(address indexed previous, address indexed proposed, uint256 effectiveAt);
    event BoostManagerProposalCancelled(address indexed cancelled);
    event BoostManagerUpdated(address indexed previous, address indexed newManager);
    event VaultGaugeVotingProposed(address indexed previous, address indexed proposed, uint256 effectiveAt);
    event VaultGaugeVotingProposalCancelled(address indexed cancelled);
    event VaultGaugeVotingUpdated(address indexed previous, address indexed newGauge);
    event BoostSourceTimelockArmed();
    event BoostSourcesDisabled(address indexed previousBoostManager, address indexed previousVaultGaugeVoting);

    // ================================
    // ERRORS
    // ================================

    error ZeroAddress();
    error Unauthorized();
    error InvalidAmount();
    error CallerFeeMismatch(uint256 provided, uint256 required);
    error NoPendingVrfResult(uint256 requestId);
    error ETHRefundFailed();

    // PR 3 — Boost-source timelock errors.
    error TimelockNotArmed();
    error TimelockAlreadyArmed();
    error TimelockNotExpired();
    error NoPendingProposal();
    error LegacySetterDisabled();

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
            baseWinChance: 40, // legacy slot — retained for layout parity but no longer read by calculateWinChance
            maxWinChance: 150_000, // 15% absolute (post-boost) cap
            // Constructor default. Production rollout sets this to 10_000
            // via `setLotteryConfig` for paid/AMOE PPM parity at equal
            // notional. See storage-field comment for full rationale.
            usdMultiplierBps: 10500
        });

        // PR 1 — AMOE Linear Parity: pre-boost ceiling. 40_000 PPM = 4% at $10K swap.
        baseCeilingPPM = 40_000;

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
        _adminModule = address(new CreatorLotteryManagerAdminModule(_registry, owner_));
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

        (entryId, ) = _boostAndDispatchVRF(buyer, creatorCoin, tokenIn, creatorShareBalanceUSD, swapValueUSD, msg.value);

        // Update reference only when an entry is actually created.
        if (entryId > 0 && oraclePriceUSD1e18 > 0) {
            lastAcceptedPriceUSD1e18[creatorCoin] = oraclePriceUSD1e18;
            lastAcceptedPriceTimestamp[creatorCoin] = block.timestamp;
        }
        return entryId;
    }

    /// @dev Shared boost + VRF dispatch path. Used by both `processSwapLottery`
    ///      and `processAmoeEntry` to keep their behavior identical at the
    ///      boost / VRF layer (Option B2 boost parity).
    function _boostAndDispatchVRF(
        address buyer,
        address creatorCoin,
        address shareBalanceToken,
        uint256 creatorShareBalanceUSD,
        uint256 swapValueUSD,
        uint256 callerFeeValue
    ) internal returns (uint256 entryId, uint256 boostedWinChanceOut) {
        address vault = registry.getVaultForToken(creatorCoin);
        uint256 baseWinChance = calculateWinChance(swapValueUSD);
        uint256 boostedWinChance = _applyBoost(
            buyer, creatorCoin, shareBalanceToken, creatorShareBalanceUSD, vault, swapValueUSD, baseWinChance
        );

        if (useLocalVRF && address(localVRFConsumer) != address(0)) {
            if (callerFeeValue != 0) revert InvalidAmount();
            entryId = _requestLocalVRF(creatorCoin, buyer, swapValueUSD, boostedWinChance);
        } else {
            entryId = _requestCrossChainVRF(creatorCoin, buyer, swapValueUSD, boostedWinChance, callerFeeValue);
        }

        // Return tuple via storage of effective PPM via the assigned VRF request.
        // Note: callers (processSwapLottery / processAmoeEntry) decide whether
        // to emit LotteryEntryCreated to preserve historical event semantics.
        boostedWinChanceOut = boostedWinChance;
    }

    // ================================
    // AMOE ENTRY PATH (PR 1 — Linear Parity)
    // ================================

    /**
     * @notice Process an Alternative Method Of Entry (AMOE) lottery entry.
     * @dev Gated to a single trusted off-chain relayer (`authorizedAmoeRelayer`).
     *      The relayer is responsible for converting points-burned to a USD
     *      value (1e6 / USDC units) before calling. PR 1 trusts that key for
     *      points-to-USD accounting; PR 4 will move that trust into a
     *      zkMetal-bound public input. See docs/security/amoe-pr1-handoff.md.
     *
     *      Boost flow mirrors `processSwapLottery` so AMOE entries get the
     *      same ve4626 personal + vault gauge boost parity (Option B2). The
     *      `pointsBurnedAsUSD` value is treated identically to a paid swap
     *      value for the purpose of `calculateWinChance` and `_applyBoost`.
     *
     *      Defense-in-depth: enforces `pointsBurnedAsUSD >= minSwapAmount`
     *      on-chain even though the relayer also enforces it off-chain.
     *
     * @param buyer The user receiving the lottery entry.
     * @param creatorCoin The creator coin the entry is for.
     * @param pointsBurnedAsUSD Off-chain-computed USD value of burnt points (1e6 units).
     * @return entryId VRF request ID (0 if no entry).
     */
    function processAmoeEntry(address buyer, address creatorCoin, uint256 pointsBurnedAsUSD)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 entryId)
    {
        // Relayer gate — single-address allowlist. Combined check rejects
        // both unauthorized callers and the disabled-relayer (address(0)) case.
        address relayer = authorizedAmoeRelayer;
        if (relayer == address(0) || msg.sender != relayer) revert Unauthorized();
        if (buyer == address(0) || creatorCoin == address(0)) revert ZeroAddress();
        if (pointsBurnedAsUSD == 0) revert InvalidAmount();

        // Verify creator coin is registered AND active. Silent skip preserves
        // off-chain idempotency on inactive creators.
        if (!registry.isCreatorCoinActive(creatorCoin)) {
            return 0;
        }

        // Defense-in-depth: floor matches paid path.
        if (pointsBurnedAsUSD < lotteryConfig.minSwapAmount) {
            return 0;
        }

        if (!lotteryConfig.isActive) {
            return 0;
        }

        // Option B2 — full boost parity with paid swaps. ve4626 personal
        // multiplier and lock-duration additive boosts are gated by
        // `getCoverageBps(creatorShareBalanceUSD, swapAmountUSD)`, so
        // passing 0 here would silently disable both branches for AMOE
        // entrants who actually hold the creator's coins. The paid path
        // reads `balanceOf(buyer)` from the OFT before calling
        // `processSwapLottery` (CreatorShareOFT line 704); mirror that
        // read so AMOE odds match paid odds at equal `pointsBurnedAsUSD`
        // and equal share balance. Vault gauge boost is independent and
        // applies regardless.
        uint256 creatorShareBalanceUSD = 0;
        uint256 buyerShareBalance = IERC20(creatorCoin).balanceOf(buyer);
        if (buyerShareBalance > 0) {
            // Same call shape as `processSwapLottery` (line 554). If the
            // per-creator oracle reverts here it would also revert on the
            // paid path — failure mode is symmetric, no new behavior.
            (creatorShareBalanceUSD,,) = _calculateTokenUSD(creatorCoin, creatorCoin, buyerShareBalance);
        }

        uint256 boostedWinChance;
        (entryId, boostedWinChance) = _boostAndDispatchVRF(
            buyer, creatorCoin, creatorCoin, creatorShareBalanceUSD, pointsBurnedAsUSD, 0
        );

        if (entryId > 0) {
            emit LotteryEntryCreated(creatorCoin, buyer, pointsBurnedAsUSD, boostedWinChance, entryId);
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

    // FIX: CLM-01 — namespace helpers to prevent local/cross-chain VRF request ID collision
    function _localVrfKey(uint256 requestId) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode("LOCAL", requestId)));
    }

    function _crossChainVrfKey(uint256 sequence) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode("CC", sequence)));
    }

    /**
     * @notice Local VRF callback
     */
    function receiveRandomWords(uint256 requestId, uint256[] memory randomWords) external nonReentrant {
        if (msg.sender != address(localVRFConsumer)) revert Unauthorized();
        // FIX: CLM-01 — use namespaced key
        _processVRFResult(_localVrfKey(requestId), randomWords);
    }

    /**
     * @notice Cross-chain VRF callback
     */
    function receiveRandomWords(uint256[] memory randomWords, uint256 sequence) external nonReentrant {
        if (msg.sender != address(vrfIntegrator)) revert Unauthorized();
        // FIX: CLM-01 — use namespaced key
        _processVRFResult(_crossChainVrfKey(sequence), randomWords);
    }

    /**
     * @notice Process a deferred VRF result after unpausing.
     * @dev While paused, callbacks store randomness and skip settlement to halt jackpot outflows.
     */
    // FIX: CLM-08 — restrict to owner to prevent adversarial front-running of pending results on unpause
    function processPendingVrfResult(uint256 requestId) external onlyOwner whenNotPaused nonReentrant {
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

        // FIX: CLM-02 — reject stale VRF results that arrive after grace period
        if (vrfResultGracePeriod > 0 && request.requestTimestamp > 0
            && block.timestamp > request.requestTimestamp + vrfResultGracePeriod) {
            delete vrfRequests[requestId];
            emit StaleVRFResultDiscarded(requestId, request.requestTimestamp, vrfResultGracePeriod);
            return;
        }

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

        // FIX: CLM-07 — deviation guard applies unconditionally when valid reference exists
        // (previously only checked within deviationWindow, leaving first entry after gap unprotected)
        uint256 maxDeviationBps = oracleMaxDeviationBps;
        uint256 lastPrice = lastAcceptedPriceUSD1e18[creatorCoin];
        uint256 lastTs = lastAcceptedPriceTimestamp[creatorCoin];
        if (maxDeviationBps > 0 && lastPrice > 0 && lastTs > 0) {
            // forge-lint: disable-next-line(unsafe-typecast)
            uint256 currentPrice = uint256(priceUSD);
            uint256 diff = currentPrice > lastPrice ? currentPrice - lastPrice : lastPrice - currentPrice;
            uint256 deviationBps = FullMath.mulDiv(diff, BASIS_POINTS, lastPrice);
            if (deviationBps > maxDeviationBps) return (0, 0, 0);
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

    /// @notice Linear pre-boost win chance (PR 1 — AMOE Linear Parity).
    /// @dev Formula: `winChancePPM = swapValueUSD / 250_000`, capped at
    ///      `baseCeilingPPM`. swapValueUSD is in 1e6 (USDC) units, so:
    ///        $1     → 1_000_000  / 250_000 =     4 PPM   (0.0004%)
    ///        $10    → 10_000_000 / 250_000 =    40 PPM   (0.004%)
    ///        $100   → 100_000_000 / 250_000 =   400 PPM   (0.04%)
    ///        $1_000 → 1_000_000_000 / 250_000 = 4_000 PPM (0.4%)
    ///        $10_000 → 10_000_000_000 / 250_000 = 40_000 PPM (4% — base ceiling)
    ///
    ///      The legacy `lotteryConfig.baseWinChance` field is retained for
    ///      slot/ABI parity but is no longer read. `lotteryConfig.maxWinChance`
    ///      remains the absolute (post-boost) cap and is enforced in `_applyBoost`.
    function calculateWinChance(uint256 swapAmountUSD) public view returns (uint256 winChancePPM) {
        if (swapAmountUSD < lotteryConfig.minSwapAmount) {
            return 0;
        }

        winChancePPM = swapAmountUSD / 250_000;

        uint256 ceiling = baseCeilingPPM;
        if (winChancePPM > ceiling) {
            winChancePPM = ceiling;
        }
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

        // STEP 2: Add vault gauge boost (vote-directed budget).
        // Scale by swap size so tiny swaps cannot fully consume gauge probability budget.
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
        uint256 minSwap = lotteryConfig.minSwapAmount;
        if (swapAmountUSD <= minSwap) return 0;

        uint256 scaledAmount = swapAmountUSD - minSwap;
        uint256 maxScale = 9_999_000_000; // $9,999 above minSwap ($1), 6 decimals
        if (scaledAmount >= maxScale) return gaugeBoostPPM;

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
            // FIX: CLM-09 — emit event instead of reverting to avoid bricking the LZ inbound lane
            emit InvalidPayloadReceived(srcEid, _payload.length);
            return;
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
            // FIX: CLM-01 — store under namespaced key to avoid cross-chain collision
            uint256 namespacedKey = _localVrfKey(requestId);
            vrfRequests[namespacedKey] = VRFRequest({
                user: buyer,
                creatorCoin: creatorCoin,
                amountUSD: swapValueUSD,
                effectiveWinChancePPM: winChancePPM,
                vrfType: VRFType.LOCAL,
                sourceChainEid: sourceChainEid,
                requestTimestamp: block.timestamp
            });
            totalLotteryEntries++;
            creatorStats[creatorCoin].entries++;
            return namespacedKey;
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
            // FIX: CLM-06 — accept >= nativeFee to avoid griefing via fee front-running
            if (useCallerFunds && callerFeeValue < nativeFee) {
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
                            VRF_REQUEST_CONTEXT, SponsorshipSkipReason.RATE_LIMITED, nativeFee, swapValueUSD
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
                            VRF_REQUEST_CONTEXT, SponsorshipSkipReason.RATE_LIMITED, nativeFee, swapValueUSD
                        );
                        return 0;
                    }
                }

                if (!_consumeSponsorship(vrfSponsorshipPolicy, VRF_REQUEST_CONTEXT, nativeFee, swapValueUSD, true)) {
                    return 0;
                }
            }

            // FIX: CLM-05 — increment rate-limit counters BEFORE external call to close TOCTOU window
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

            try vrfIntegrator.requestRandomWordsPayable{value: nativeFee}(targetEid) returns (
                MessagingReceipt memory, uint64 sequence
            ) {

                // FIX: CLM-01 — store under namespaced key to avoid local collision
                uint256 namespacedKey = _crossChainVrfKey(uint256(sequence));
                vrfRequests[namespacedKey] = VRFRequest({
                    user: buyer,
                    creatorCoin: creatorCoin,
                    amountUSD: swapValueUSD,
                    effectiveWinChancePPM: winChancePPM,
                    vrfType: VRFType.CROSS_CHAIN,
                    sourceChainEid: sourceChainEid,
                    requestTimestamp: block.timestamp
                });
                totalLotteryEntries++;
                creatorStats[creatorCoin].entries++;
                // FIX: CLM-06 — refund excess ETH when caller overpaid
                if (useCallerFunds && callerFeeValue > nativeFee) {
                    _refundCallerFeeOrRevert(callerFeeValue - nativeFee);
                }
                return namespacedKey;
            } catch {
                // FIX: CLM-05 — rollback optimistic rate-limit increments on failure
                if (!useCallerFunds && nativeFee > 0) {
                    if (vrfMaxSponsoredPerBuyerPerEpoch > 0) {
                        uint32 curCount = vrfSponsoredCountByBuyer[buyer];
                        if (curCount > 0) vrfSponsoredCountByBuyer[buyer] = curCount - 1;
                    }
                    if (sourceChainEid != 0 && vrfMaxSponsoredPerOriginPerEpoch > 0) {
                        uint32 curOriginCount = vrfSponsoredCountByOrigin[originKey];
                        if (curOriginCount > 0) vrfSponsoredCountByOrigin[originKey] = curOriginCount - 1;
                    }
                }
                if (useCallerFunds && nativeFee > 0) {
                    // If the caller provided the fee, never trap value on failure.
                    _refundCallerFeeOrRevert(callerFeeValue);
                } else if (nativeFee > 0) {
                    _rollbackSponsoredSpend(vrfSponsorshipPolicy, nativeFee);
                    emit SponsorshipSkipped(
                        VRF_REQUEST_CONTEXT, SponsorshipSkipReason.SEND_FAILED, nativeFee, swapValueUSD
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
                        WINNER_CALLBACK_CONTEXT, SponsorshipSkipReason.RATE_LIMITED, nativeFee, 0
                    );
                    // FIX: CLM-03 — emit event instead of silent drop
                    emit WinnerCallbackDropped(
                        dstEid, winner, creatorCoin, totalSharesPaid, uint8(CallbackDropReason.BUYER_RATE_LIMITED)
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
                        WINNER_CALLBACK_CONTEXT, SponsorshipSkipReason.RATE_LIMITED, nativeFee, 0
                    );
                    // FIX: CLM-03 — emit event instead of silent drop
                    emit WinnerCallbackDropped(
                        dstEid, winner, creatorCoin, totalSharesPaid, uint8(CallbackDropReason.ORIGIN_RATE_LIMITED)
                    );
                    return;
                }
            }
        }

        // FIX: CLM-03 — emit event when sponsorship is not consumed
        if (!_consumeSponsorship(callbackSponsorshipPolicy, WINNER_CALLBACK_CONTEXT, nativeFee, 0, false)) {
            emit WinnerCallbackDropped(
                dstEid, winner, creatorCoin, totalSharesPaid, uint8(CallbackDropReason.SPONSORSHIP_UNAVAILABLE)
            );
            return;
        }

        // FIX: M-05 (4626-314) — CEI ordering. Increment rate-limit counters
        // BEFORE the external _lzSend so a reentering LayerZero hook or
        // callback cannot observe pre-increment counter state and bypass the
        // per-buyer / per-origin caps. The counters are consumed in the same
        // `if (nativeFee > 0)` branch as before; only the ordering changed.
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

        _lzSend(dstEid, payload, options, fee, payable(address(this)));

        emit WinnerCallbackSent(dstEid, winner, creatorCoin, totalSharesPaid);
        // If insufficient gas, silently skip — payout already happened on hub
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
        if (!success) revert ETHRefundFailed();
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
     * @notice Pay jackpot from ALL active creator vaults (multi-token prize!)
     * @param triggeringCoin The creator coin that triggered the lottery
     * @param winner The lottery winner
     * @param payoutBps Percentage of each vault's jackpot to pay (6900 = 69%)
     * @return totalPaidOut Total number of vaults that paid out
     */
    // FIX: CLM-04 — wrap entire payout in try/catch pattern to ensure _payoutLock always resets
    function _payoutLocalJackpot(address triggeringCoin, address winner, uint16 payoutBps) internal returns (uint256) {
        if (_payoutLock == 1) revert ReentrancyGuardReentrantCall();
        _payoutLock = 1;

        uint256 totalPaidOut = _payoutLocalJackpotInner(triggeringCoin, winner, payoutBps);

        _payoutLock = 0;
        return totalPaidOut;
    }

    /// @notice Cursor that advances through the creator-coin registry between
    /// jackpot payouts so that when the registry is larger than
    /// MAX_JACKPOT_PAYOUT_ITERATIONS, all coins eventually receive payouts
    /// across successive jackpots rather than being starved behind the cap.
    /// Incremented after each payout in _payoutLocalJackpotInner (M-06).
    uint256 public jackpotPayoutCursor;

    /// @notice Emitted when the per-call iteration cap truncated the payout.
    /// Off-chain monitors can use this to reconcile that the remaining coins
    /// will be reached on subsequent jackpots via the advancing cursor.
    /// @param totalRegistrySize Full registry size at the time of the call.
    /// @param startIndex First registry index visited (pre-wrap).
    /// @param activeIterated Number of *active* creator coins actually evaluated.
    /// @param slotsScanned Number of registry slots scanned (active + inactive).
    event JackpotPayoutCapped(
        uint256 totalRegistrySize,
        uint256 startIndex,
        uint256 activeIterated,
        uint256 slotsScanned
    );

    function _payoutLocalJackpotInner(address triggeringCoin, address winner, uint16 payoutBps) internal returns (uint256 totalPaidOut) {
        // FIX: CLM-04 — registry calls wrapped in try/catch to prevent permanent lock
        address[] memory allCreators;
        try registry.getAllCreatorCoins() returns (address[] memory result) {
            allCreators = result;
        } catch {
            return 0;
        }

        uint256 registrySize = allCreators.length;
        if (registrySize == 0) {
            return 0;
        }

        // M-06: cap the per-call iteration count so the payout cannot be
        // bricked by a growing registry. The cap is applied to *active*
        // creators actually evaluated, not to raw slot visits, so a long
        // prefix of inactive entries at the front of registeredTokens (it
        // is append-only) cannot starve active creators of payouts.
        //
        // To keep the loop bounded in the worst case where every slot is
        // inactive, we also cap total slot scans at
        // MAX_JACKPOT_PAYOUT_SLOT_SCANS. If the scan budget is exhausted
        // before the active cap fills, the cursor advances past the last
        // slot scanned so subsequent jackpots continue where this one
        // stopped and eventually reach every active creator.
        uint256 activeCap = registrySize < MAX_JACKPOT_PAYOUT_ITERATIONS
            ? registrySize
            : MAX_JACKPOT_PAYOUT_ITERATIONS;
        uint256 slotCap = registrySize < MAX_JACKPOT_PAYOUT_SLOT_SCANS
            ? registrySize
            : MAX_JACKPOT_PAYOUT_SLOT_SCANS;
        uint256 startIndex = jackpotPayoutCursor % registrySize;

        uint256 activeIterated;
        uint256 slotsScanned;

        // Pay from every active creator vault within the iteration window.
        // Loop variable k counts slot visits; activeIterated counts active
        // creators whose gauge was actually queried.
        for (uint256 k = 0; k < slotCap; k++) {
            if (activeIterated >= activeCap) break;

            uint256 i = (startIndex + k) % registrySize;
            address creatorCoin = allCreators[i];
            slotsScanned = k + 1;

            // Skip inactive creators
            // slither-disable-next-line calls-loop
            bool isActive;
            try registry.isCreatorCoinActive(creatorCoin) returns (bool result) {
                isActive = result;
            } catch {
                continue;
            }
            if (!isActive) continue;
            activeIterated++;

            // Look up per-creator contracts
            // slither-disable-next-line calls-loop
            address vaultAddr;
            address gaugeAddr;
            try registry.getVaultForToken(creatorCoin) returns (address result) {
                vaultAddr = result;
            } catch {
                continue;
            }
            // slither-disable-next-line calls-loop
            try registry.getGaugeControllerForToken(creatorCoin) returns (address result) {
                gaugeAddr = result;
            } catch {
                continue;
            }

            if (vaultAddr == address(0) || gaugeAddr == address(0)) continue;

            ICreatorGaugeControllerLottery gaugeController = ICreatorGaugeControllerLottery(gaugeAddr);

            // slither-disable-next-line calls-loop
            uint256 jackpotShares;
            try gaugeController.getJackpotReserve() returns (uint256 result) {
                jackpotShares = result;
            } catch {
                continue;
            }

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

        // Advance the cursor past the last slot actually scanned. Using
        // unchecked add is safe: the cursor is taken modulo registrySize
        // on every read.
        unchecked {
            jackpotPayoutCursor = startIndex + slotsScanned;
        }

        // Emit a capped event if either bound actually bit. This lets the
        // off-chain monitor detect starvation (e.g. many inactive slots
        // accumulating) and prioritise registry compaction.
        if (activeIterated < registrySize || slotsScanned < registrySize) {
            if (activeIterated >= activeCap || slotsScanned >= slotCap) {
                emit JackpotPayoutCapped(registrySize, startIndex, activeIterated, slotsScanned);
            }
        }

        // Emit special event for multi-token win
        if (totalPaidOut > 0) {
            emit MultiTokenJackpotWon(triggeringCoin, winner, totalPaidOut);
        }
    }

    // ================================
    // ADMIN FUNCTIONS
    // ================================

    function _delegateAdmin() internal {
        (bool ok, bytes memory data) = _adminModule.delegatecall(msg.data);
        if (!ok) {
            assembly {
                revert(add(data, 0x20), mload(data))
            }
        }
    }

    function setAuthorizedSwapContract(address swapContract, bool authorized) external {
        swapContract;
        authorized;
        _delegateAdmin();
    }

    function setLocalVRFConsumer(address _consumer) external {
        _consumer;
        _delegateAdmin();
    }

    function setVRFIntegrator(address _integrator) external {
        _integrator;
        _delegateAdmin();
    }

    function setTargetEid(uint32 _eid) external {
        _eid;
        _delegateAdmin();
    }

    function setUseLocalVRF(bool _useLocal) external {
        _useLocal;
        _delegateAdmin();
    }

    function setSponsoredVrfMinSwapAmountUSD(uint256 _minSwapAmountUSD) external {
        _minSwapAmountUSD;
        _delegateAdmin();
    }

    function setVrfSponsorshipPolicy(
        bool enabled,
        uint256 maxFeePerMessage,
        uint256 budgetPerEpoch,
        uint256 epochDuration
    ) external {
        enabled;
        maxFeePerMessage;
        budgetPerEpoch;
        epochDuration;
        _delegateAdmin();
    }

    function setCallbackSponsorshipPolicy(
        bool enabled,
        uint256 maxFeePerMessage,
        uint256 budgetPerEpoch,
        uint256 epochDuration
    ) external {
        enabled;
        maxFeePerMessage;
        budgetPerEpoch;
        epochDuration;
        _delegateAdmin();
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
    ) external {
        _vrfMaxPerBuyerPerEpoch;
        _vrfMaxPerOriginPerEpoch;
        _callbackMaxPerBuyerPerEpoch;
        _callbackMaxPerOriginPerEpoch;
        _delegateAdmin();
    }

    function setBoostManager(address _manager) external {
        _manager;
        _delegateAdmin();
    }

    /**
     * @notice Set VaultGaugeVoting for ve(3,3) probability direction
     * @param _vaultGaugeVoting Address of the VaultGaugeVoting contract
     */
    function setVaultGaugeVoting(address _vaultGaugeVoting) external {
        _vaultGaugeVoting;
        _delegateAdmin();
    }

    // PR 1 — AMOE Linear Parity admin stubs.
    function setAuthorizedAmoeRelayer(address _relayer) external {
        _relayer;
        _delegateAdmin();
    }

    function setBaseCeilingPPM(uint256 _ceilingPPM) external {
        _ceilingPPM;
        _delegateAdmin();
    }

    // PR 3 — Boost-source timelock admin stubs. Bodies live in the admin module.
    function proposeBoostManager(address _manager) external {
        _manager;
        _delegateAdmin();
    }

    function commitBoostManager() external {
        _delegateAdmin();
    }

    function cancelBoostManagerProposal() external {
        _delegateAdmin();
    }

    function proposeVaultGaugeVoting(address _gauge) external {
        _gauge;
        _delegateAdmin();
    }

    function commitVaultGaugeVoting() external {
        _delegateAdmin();
    }

    function cancelVaultGaugeVotingProposal() external {
        _delegateAdmin();
    }

    function armBoostSourceTimelock() external {
        _delegateAdmin();
    }

    function disableBoostSources() external {
        _delegateAdmin();
    }

    function setLotteryConfig(
        uint256 _minSwap,
        uint256 _rewardPercentage,
        bool _isActive,
        uint256 _baseWinChance,
        uint256 _maxWinChance,
        uint256 _usdMultiplierBps
    ) external {
        _minSwap;
        _rewardPercentage;
        _isActive;
        _baseWinChance;
        _maxWinChance;
        _usdMultiplierBps;
        _delegateAdmin();
    }

    function setOracleMaxStaleness(uint256 _maxStaleness) external {
        _maxStaleness;
        _delegateAdmin();
    }

    // FIX: CLM-02 — allow owner to configure VRF result grace period
    function setVrfResultGracePeriod(uint256 _gracePeriod) external {
        _gracePeriod;
        _delegateAdmin();
    }

    function setOracleDeviationGuard(uint256 _maxDeviationBps, uint256 _deviationWindow) external {
        _maxDeviationBps;
        _deviationWindow;
        _delegateAdmin();
    }

    /**
     * @notice Set enforced options for winner callback messages
     */
    function setCallbackOptions(uint32 dstEid, uint128 gasLimit, uint128 msgValue) external {
        dstEid;
        gasLimit;
        msgValue;
        _delegateAdmin();
    }

    /**
     * @notice Authorize a remote OFT as a valid lottery entry sender
     * @param srcEid The source chain EID
     * @param sender The bytes32-encoded address of the remote OFT
     * @param authorized Whether to authorize or deauthorize
     */
    function setAuthorizedRemoteOFT(uint32 srcEid, bytes32 sender, bool authorized) external {
        srcEid;
        sender;
        authorized;
        _delegateAdmin();
    }

    /**
     * @notice Batch authorize remote OFTs
     */
    function batchSetAuthorizedRemoteOFTs(uint32[] calldata srcEids, bytes32[] calldata senders, bool authorized)
        external
    {
        srcEids;
        senders;
        authorized;
        _delegateAdmin();
    }

    /**
     * @notice Set the gas limit for winner callback messages
     */
    function setCallbackGasLimit(uint128 _gasLimit) external {
        _gasLimit;
        _delegateAdmin();
    }

    function pause() external {
        _delegateAdmin();
    }

    function unpause() external {
        _delegateAdmin();
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

    // ================================
    // EMERGENCY
    // ================================

    // FIX: CLM-12 — only allow emergency withdraw when paused to prevent draining active sponsorship funds
    function emergencyWithdraw(address token, uint256 amount) external {
        token;
        amount;
        _delegateAdmin();
    }

    receive() external payable {}
}

contract CreatorLotteryManagerAdminModule is OApp, OAppOptionsType3, ReentrancyGuard, Pausable {
    using OptionsBuilder for bytes;
    using SafeERC20 for IERC20;

    uint256 public constant MIN_SWAP_USD = 1_000_000;
    uint256 public constant MAX_SWAP_USD = 1_000_000_000_000;
    uint256 public constant BASIS_POINTS = 10_000;
    uint16 public constant MSG_TYPE_WINNER_CALLBACK = 4;

    uint128 internal constant DEFAULT_MSG_VALUE = 0;
    bytes32 internal constant VRF_REQUEST_CONTEXT =
        0xd84f4bdfe2e4cf43345263bca820ebe0fd153da9fd7f53871b6103ba604a4430;
    bytes32 internal constant WINNER_CALLBACK_CONTEXT =
        0x197005c8271d0fbeff8e5770b1fa02e04e4ba94e019fc8ea71c55fd52eb21205;

    ICreatorRegistryLottery public immutable registry;

    mapping(address => bool) public authorizedSwapContracts;
    ICreatorVRFConsumer public localVRFConsumer;
    IChainlinkVRFIntegrator public vrfIntegrator;
    uint32 public targetEid;
    bool public useLocalVRF;
    mapping(address => bool) public trustedVrfIntegrators;
    Ive4626BoostManager public boostManager;
    IVaultGaugeVoting public vaultGaugeVoting;

    struct LotteryConfig {
        uint256 minSwapAmount;
        uint256 rewardPercentage;
        bool isActive;
        uint256 baseWinChance;
        uint256 maxWinChance;
        uint256 usdMultiplierBps;
    }

    LotteryConfig public lotteryConfig;
    uint256 public oracleMaxStaleness;
    uint256 public vrfResultGracePeriod;
    uint256 public oracleMaxDeviationBps;
    uint256 public oracleDeviationWindow;
    mapping(address => uint256) public lastAcceptedPriceUSD1e18;
    mapping(address => uint256) public lastAcceptedPriceTimestamp;

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
        address creatorCoin;
        uint256 amountUSD;
        uint256 effectiveWinChancePPM;
        VRFType vrfType;
        uint32 sourceChainEid;
        uint256 requestTimestamp;
    }

    mapping(uint256 => VRFRequest) public vrfRequests;
    mapping(uint256 => uint256) public pendingRandomWord;
    mapping(uint256 => bool) public hasPendingRandomWord;

    SponsorshipPolicy public vrfSponsorshipPolicy;
    SponsorshipPolicy public callbackSponsorshipPolicy;
    uint256 public sponsoredVrfMinSwapAmountUSD;

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

    mapping(uint32 => mapping(bytes32 => bool)) public authorizedRemoteOFTs;
    uint128 public callbackGasLimit;
    uint256 public totalRemoteLotteryEntries;
    uint256 public totalLotteryEntries;
    uint256 public totalWinners;
    uint256 public totalRewardsPaid;

    struct CreatorStats {
        uint256 entries;
        uint256 winners;
        uint256 rewardsPaid;
    }
    mapping(address => CreatorStats) public creatorStats;
    uint256 private _payoutLock;

    // ================================
    // STATE — AMOE LINEAR PARITY (PR 1) — MIRROR
    // ================================
    //
    // These fields MUST mirror the slot order of CreatorLotteryManager so the
    // delegatecall storage layout stays consistent. See the same block in the
    // main contract for semantics.
    /// @notice Pre-boost win-chance ceiling (PPM). Default 40_000 = 4%.
    uint256 public baseCeilingPPM;

    /// @notice Trusted relayer authorized to call `processAmoeEntry`.
    address public authorizedAmoeRelayer;

    // ================================
    // STATE — BOOST-SOURCE TIMELOCK (PR 3) — MIRROR
    // ================================
    /// @dev Pending replacement for `boostManager`. Public view via `getPendingBoostSources()`.
    address internal _pendingBoostManager;
    uint256 internal _pendingBoostManagerEffectiveAt;
    address internal _pendingVaultGaugeVoting;
    uint256 internal _pendingVaultGaugeVotingEffectiveAt;
    /// @dev Once true, legacy single-call setters revert. Read via `isTimelockArmed()`.
    bool internal _timelockArmed;

    address private immutable _self;

    event SwapContractAuthorized(address indexed swapContract, bool authorized);
    event LotteryConfigUpdated(uint256 minSwap, uint256 rewardPercentage, bool isActive);
    event OracleMaxStalenessUpdated(uint256 maxStaleness);
    event OracleDeviationGuardUpdated(uint256 maxDeviationBps, uint256 deviationWindow);
    event RemoteOFTAuthorized(uint32 indexed srcEid, bytes32 sender, bool authorized);
    event CallbackGasLimitUpdated(uint128 newGasLimit);
    event VRFConsumerUpdated(address indexed consumer);
    event TargetEidUpdated(uint32 indexed targetEid);
    event VRFIntegratorUpdated(address indexed integrator, bool trusted);
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

    // PR 1 — AMOE Linear Parity events (mirror of main contract).
    event AuthorizedAmoeRelayerUpdated(address indexed previousRelayer, address indexed newRelayer);
    event BaseCeilingPPMUpdated(uint256 previousCeilingPPM, uint256 newCeilingPPM);

    // PR 3 — Boost-source timelock events (mirror of main contract).
    event BoostManagerProposed(address indexed previous, address indexed proposed, uint256 effectiveAt);
    event BoostManagerProposalCancelled(address indexed cancelled);
    event BoostManagerUpdated(address indexed previous, address indexed newManager);
    event VaultGaugeVotingProposed(address indexed previous, address indexed proposed, uint256 effectiveAt);
    event VaultGaugeVotingProposalCancelled(address indexed cancelled);
    event VaultGaugeVotingUpdated(address indexed previous, address indexed newGauge);
    event BoostSourceTimelockArmed();
    event BoostSourcesDisabled(address indexed previousBoostManager, address indexed previousVaultGaugeVoting);

    /// @notice Mirror of main-contract `BOOST_SOURCE_TIMELOCK`.
    uint256 public constant BOOST_SOURCE_TIMELOCK = 24 hours;

    error ZeroAddress();
    error InvalidAmount();
    error OnlyDelegateCall();

    // PR 3 — Boost-source timelock errors.
    error TimelockNotArmed();
    error TimelockAlreadyArmed();
    error TimelockNotExpired();
    error NoPendingProposal();
    error LegacySetterDisabled();

    constructor(address _registry, address owner_)
        OApp(ICreatorRegistryLottery(_registry).getLayerZeroEndpoint(block.chainid), owner_)
        Ownable(owner_)
    {
        registry = ICreatorRegistryLottery(_registry);
        _self = address(this);
    }

    modifier onlyDelegateCall() {
        if (address(this) == _self) revert OnlyDelegateCall();
        _;
    }

    function setAuthorizedSwapContract(address swapContract, bool authorized) external onlyDelegateCall onlyOwner {
        if (swapContract == address(0)) revert ZeroAddress();
        authorizedSwapContracts[swapContract] = authorized;
        emit SwapContractAuthorized(swapContract, authorized);
    }

    function setLocalVRFConsumer(address _consumer) external onlyDelegateCall onlyOwner {
        localVRFConsumer = ICreatorVRFConsumer(_consumer);
        emit VRFConsumerUpdated(_consumer);
    }

    function setVRFIntegrator(address _integrator) external onlyDelegateCall onlyOwner {
        address oldIntegrator = address(vrfIntegrator);
        if (oldIntegrator != address(0)) {
            trustedVrfIntegrators[oldIntegrator] = false;
        }
        vrfIntegrator = IChainlinkVRFIntegrator(_integrator);
        if (_integrator != address(0)) {
            trustedVrfIntegrators[_integrator] = true;
        }
        emit VRFIntegratorUpdated(_integrator, _integrator != address(0));
    }

    function setTargetEid(uint32 _eid) external onlyDelegateCall onlyOwner {
        targetEid = _eid;
        emit TargetEidUpdated(_eid);
    }

    function setUseLocalVRF(bool _useLocal) external onlyDelegateCall onlyOwner {
        useLocalVRF = _useLocal;
    }

    function setSponsoredVrfMinSwapAmountUSD(uint256 _minSwapAmountUSD) external onlyDelegateCall onlyOwner {
        if (_minSwapAmountUSD < MIN_SWAP_USD || _minSwapAmountUSD > MAX_SWAP_USD) revert InvalidAmount();
        sponsoredVrfMinSwapAmountUSD = _minSwapAmountUSD;
        emit SponsoredVrfMinSwapUpdated(_minSwapAmountUSD);
    }

    function setVrfSponsorshipPolicy(
        bool enabled,
        uint256 maxFeePerMessage,
        uint256 budgetPerEpoch,
        uint256 epochDuration
    ) external onlyDelegateCall onlyOwner {
        if (epochDuration == 0) revert InvalidAmount();
        _refreshSponsorshipEpoch(vrfSponsorshipPolicy);
        vrfSponsorshipPolicy.enabled = enabled;
        vrfSponsorshipPolicy.maxFeePerMessage = maxFeePerMessage;
        vrfSponsorshipPolicy.budgetPerEpoch = budgetPerEpoch;
        vrfSponsorshipPolicy.epochDuration = epochDuration;
        if (vrfSponsorshipPolicy.epochStart == 0) {
            vrfSponsorshipPolicy.epochStart = block.timestamp;
        }

        emit SponsorshipPolicyUpdated(VRF_REQUEST_CONTEXT, enabled, maxFeePerMessage, budgetPerEpoch, epochDuration);
    }

    function setCallbackSponsorshipPolicy(
        bool enabled,
        uint256 maxFeePerMessage,
        uint256 budgetPerEpoch,
        uint256 epochDuration
    ) external onlyDelegateCall onlyOwner {
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
            WINNER_CALLBACK_CONTEXT, enabled, maxFeePerMessage, budgetPerEpoch, epochDuration
        );
    }

    function setSponsorshipRateLimits(
        uint32 _vrfMaxPerBuyerPerEpoch,
        uint32 _vrfMaxPerOriginPerEpoch,
        uint32 _callbackMaxPerBuyerPerEpoch,
        uint32 _callbackMaxPerOriginPerEpoch
    ) external onlyDelegateCall onlyOwner {
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

    /// @notice Legacy single-call setter for `boostManager`.
    /// @dev Disabled once `armBoostSourceTimelock()` has been called. Until
    ///      then, this preserves the original ops bootstrap path so initial
    ///      deploys can wire up the boost source without going through the
    ///      24h timelock dance. Once armed, callers must use
    ///      `proposeBoostManager` + `commitBoostManager`.
    function setBoostManager(address _manager) external onlyDelegateCall onlyOwner {
        if (_timelockArmed) revert LegacySetterDisabled();
        address previous = address(boostManager);
        boostManager = Ive4626BoostManager(_manager);
        emit BoostManagerUpdated(previous, _manager);
    }

    /// @notice Legacy single-call setter for `vaultGaugeVoting`.
    /// @dev Disabled once `armBoostSourceTimelock()` has been called.
    function setVaultGaugeVoting(address _vaultGaugeVoting) external onlyDelegateCall onlyOwner {
        if (_timelockArmed) revert LegacySetterDisabled();
        address previous = address(vaultGaugeVoting);
        vaultGaugeVoting = IVaultGaugeVoting(_vaultGaugeVoting);
        emit VaultGaugeVotingUpdated(previous, _vaultGaugeVoting);
    }

    // ================================
    // PR 3 — Boost-source timelock
    // ================================

    /// @notice Engage the boost-source timelock. One-way switch.
    /// @dev After this is called, `setBoostManager` / `setVaultGaugeVoting`
    ///      revert with `LegacySetterDisabled` and the only path forward is
    ///      `proposeBoostManager` + (24h delay) + `commitBoostManager`
    ///      (and the symmetric pair for `vaultGaugeVoting`). The emergency
    ///      `disableBoostSources()` circuit breaker remains available with no
    ///      timelock.
    function armBoostSourceTimelock() external onlyDelegateCall onlyOwner {
        if (_timelockArmed) revert TimelockAlreadyArmed();
        _timelockArmed = true;
        emit BoostSourceTimelockArmed();
    }

    /// @notice Propose a new `boostManager`. Effective after `BOOST_SOURCE_TIMELOCK`
    ///         has elapsed, via `commitBoostManager()`. Owner can cancel during
    ///         the window via `cancelBoostManagerProposal()`.
    /// @dev Requires `timelockArmed`. Pass `address(0)` to propose disabling the
    ///      personal boost source entirely (still subject to the same delay).
    function proposeBoostManager(address _manager) external onlyDelegateCall onlyOwner {
        if (!_timelockArmed) revert TimelockNotArmed();
        uint256 effectiveAt = block.timestamp + BOOST_SOURCE_TIMELOCK;
        _pendingBoostManager = _manager;
        _pendingBoostManagerEffectiveAt = effectiveAt;
        emit BoostManagerProposed(address(boostManager), _manager, effectiveAt);
    }

    /// @notice Commit a previously proposed `boostManager` once the timelock has elapsed.
    function commitBoostManager() external onlyDelegateCall onlyOwner {
        uint256 effectiveAt = _pendingBoostManagerEffectiveAt;
        if (effectiveAt == 0) revert NoPendingProposal();
        if (block.timestamp < effectiveAt) revert TimelockNotExpired();
        address previous = address(boostManager);
        address proposed = _pendingBoostManager;
        boostManager = Ive4626BoostManager(proposed);
        // Clear pending state so the slot is reusable for the next proposal.
        _pendingBoostManager = address(0);
        _pendingBoostManagerEffectiveAt = 0;
        emit BoostManagerUpdated(previous, proposed);
    }



    /// @notice Propose a new `vaultGaugeVoting`. Symmetric to `proposeBoostManager`.
    function proposeVaultGaugeVoting(address _gauge) external onlyDelegateCall onlyOwner {
        if (!_timelockArmed) revert TimelockNotArmed();
        uint256 effectiveAt = block.timestamp + BOOST_SOURCE_TIMELOCK;
        _pendingVaultGaugeVoting = _gauge;
        _pendingVaultGaugeVotingEffectiveAt = effectiveAt;
        emit VaultGaugeVotingProposed(address(vaultGaugeVoting), _gauge, effectiveAt);
    }

    /// @notice Commit a previously proposed `vaultGaugeVoting` once the timelock has elapsed.
    function commitVaultGaugeVoting() external onlyDelegateCall onlyOwner {
        uint256 effectiveAt = _pendingVaultGaugeVotingEffectiveAt;
        if (effectiveAt == 0) revert NoPendingProposal();
        if (block.timestamp < effectiveAt) revert TimelockNotExpired();
        address previous = address(vaultGaugeVoting);
        address proposed = _pendingVaultGaugeVoting;
        vaultGaugeVoting = IVaultGaugeVoting(proposed);
        _pendingVaultGaugeVoting = address(0);
        _pendingVaultGaugeVotingEffectiveAt = 0;
        emit VaultGaugeVotingUpdated(previous, proposed);
    }

    /// @notice Cancel an in-flight `boostManager` proposal during the timelock window.
    function cancelBoostManagerProposal() external onlyDelegateCall onlyOwner {
        if (_pendingBoostManagerEffectiveAt == 0) revert NoPendingProposal();
        address cancelled = _pendingBoostManager;
        _pendingBoostManager = address(0);
        _pendingBoostManagerEffectiveAt = 0;
        emit BoostManagerProposalCancelled(cancelled);
    }

    /// @notice Cancel an in-flight `vaultGaugeVoting` proposal during the timelock window.
    function cancelVaultGaugeVotingProposal() external onlyDelegateCall onlyOwner {
        if (_pendingVaultGaugeVotingEffectiveAt == 0) revert NoPendingProposal();
        address cancelled = _pendingVaultGaugeVoting;
        _pendingVaultGaugeVoting = address(0);
        _pendingVaultGaugeVotingEffectiveAt = 0;
        emit VaultGaugeVotingProposalCancelled(cancelled);
    }

    /// @notice Emergency circuit breaker: zero out both boost sources atomically,
    ///         no timelock. Use during incident response when a malicious
    ///         proposal has already been committed and the next safe state is
    ///         "no boost at all".
    /// @dev Also clears any in-flight pending proposals so a queued malicious
    ///      address can't be committed after the breaker is pulled.
    function disableBoostSources() external onlyDelegateCall onlyOwner {
        address prevBoost = address(boostManager);
        address prevGauge = address(vaultGaugeVoting);
        boostManager = Ive4626BoostManager(address(0));
        vaultGaugeVoting = IVaultGaugeVoting(address(0));
        // Clear any pending proposals so they can't be committed post-breaker.
        _pendingBoostManager = address(0);
        _pendingBoostManagerEffectiveAt = 0;
        _pendingVaultGaugeVoting = address(0);
        _pendingVaultGaugeVotingEffectiveAt = 0;
        emit BoostSourcesDisabled(prevBoost, prevGauge);
    }

    // ================================
    // PR 3 — Boost-source timelock views
    // ================================
    //
    // Single combined getter for the entire timelock state, exposed only on
    // the admin module to keep main-contract bytecode under EIP-170. The main
    // contract delegates to this via `_delegateAdmin()`.

    /// @notice Read the entire boost-source timelock state in one call.
    /// @return pendingBoostMgr The pending replacement for `boostManager`, or address(0).
    /// @return boostMgrEffectiveAt Timestamp at which `commitBoostManager` may run, or 0 if no proposal.
    /// @return pendingGauge The pending replacement for `vaultGaugeVoting`, or address(0).
    /// @return gaugeEffectiveAt Timestamp at which `commitVaultGaugeVoting` may run, or 0 if no proposal.
    /// @return armed Whether the timelock has been armed (legacy setters disabled).
    function getBoostSourceTimelockState()
        external
        view
        returns (
            address pendingBoostMgr,
            uint256 boostMgrEffectiveAt,
            address pendingGauge,
            uint256 gaugeEffectiveAt,
            bool armed
        )
    {
        return (
            _pendingBoostManager,
            _pendingBoostManagerEffectiveAt,
            _pendingVaultGaugeVoting,
            _pendingVaultGaugeVotingEffectiveAt,
            _timelockArmed
        );
    }

    // PR 1 — AMOE Linear Parity admin impls.

    /// @notice Set the trusted off-chain relayer for AMOE entries.
    /// @dev Single-address allowlist. Pass address(0) to disable AMOE entirely.
    function setAuthorizedAmoeRelayer(address _relayer) external onlyDelegateCall onlyOwner {
        address previous = authorizedAmoeRelayer;
        authorizedAmoeRelayer = _relayer;
        emit AuthorizedAmoeRelayerUpdated(previous, _relayer);
    }

    /// @notice Set the pre-boost win-chance ceiling (PPM).
    /// @dev Bounded by `lotteryConfig.maxWinChance` (so a misconfigured ceiling
    ///      cannot widen the absolute cap) and by 100_000 PPM (10%) as a hard
    ///      sanity ceiling on the *unboosted* chance — if you ever need more,
    ///      raise this constant deliberately in a future audit.
    function setBaseCeilingPPM(uint256 _ceilingPPM) external onlyDelegateCall onlyOwner {
        if (_ceilingPPM == 0) revert InvalidAmount();
        if (_ceilingPPM > lotteryConfig.maxWinChance) revert InvalidAmount();
        if (_ceilingPPM > 100_000) revert InvalidAmount();
        uint256 previous = baseCeilingPPM;
        baseCeilingPPM = _ceilingPPM;
        emit BaseCeilingPPMUpdated(previous, _ceilingPPM);
    }

    function setLotteryConfig(
        uint256 _minSwap,
        uint256 _rewardPercentage,
        bool _isActive,
        uint256 _baseWinChance,
        uint256 _maxWinChance,
        uint256 _usdMultiplierBps
    ) external onlyDelegateCall onlyOwner {
        if (_minSwap < MIN_SWAP_USD || _minSwap > MAX_SWAP_USD) revert InvalidAmount();
        if (_rewardPercentage > BASIS_POINTS) revert InvalidAmount();
        if (_maxWinChance > 200_000) revert InvalidAmount();
        if (_baseWinChance > _maxWinChance) revert InvalidAmount();
        if (_usdMultiplierBps < 10_000 || _usdMultiplierBps > 15_000) revert InvalidAmount();
        // PR 1 — AMOE Linear Parity invariant: never let maxWinChance drop
        // below the active pre-boost ceiling, otherwise calculateWinChance could
        // exceed _applyBoost's cap.
        if (baseCeilingPPM > 0 && _maxWinChance < baseCeilingPPM) revert InvalidAmount();

        lotteryConfig.minSwapAmount = _minSwap;
        lotteryConfig.rewardPercentage = _rewardPercentage;
        lotteryConfig.isActive = _isActive;
        lotteryConfig.baseWinChance = _baseWinChance;
        lotteryConfig.maxWinChance = _maxWinChance;
        lotteryConfig.usdMultiplierBps = _usdMultiplierBps;

        emit LotteryConfigUpdated(_minSwap, _rewardPercentage, _isActive);
    }

    function setOracleMaxStaleness(uint256 _maxStaleness) external onlyDelegateCall onlyOwner {
        oracleMaxStaleness = _maxStaleness;
        emit OracleMaxStalenessUpdated(_maxStaleness);
    }

    function setVrfResultGracePeriod(uint256 _gracePeriod) external onlyDelegateCall onlyOwner {
        if (_gracePeriod > 0 && _gracePeriod < 5 minutes) revert InvalidAmount();
        vrfResultGracePeriod = _gracePeriod;
    }

    function setOracleDeviationGuard(uint256 _maxDeviationBps, uint256 _deviationWindow)
        external
        onlyDelegateCall
        onlyOwner
    {
        if (_maxDeviationBps > BASIS_POINTS) revert InvalidAmount();
        oracleMaxDeviationBps = _maxDeviationBps;
        oracleDeviationWindow = _deviationWindow;
        emit OracleDeviationGuardUpdated(_maxDeviationBps, _deviationWindow);
    }

    function setCallbackOptions(uint32 dstEid, uint128 gasLimit, uint128 msgValue) external onlyDelegateCall onlyOwner {
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(gasLimit, msgValue);

        EnforcedOptionParam[] memory params = new EnforcedOptionParam[](1);
        params[0] = EnforcedOptionParam({eid: dstEid, msgType: MSG_TYPE_WINNER_CALLBACK, options: options});
        _setEnforcedOptions(params);
    }

    function setAuthorizedRemoteOFT(uint32 srcEid, bytes32 sender, bool authorized)
        external
        onlyDelegateCall
        onlyOwner
    {
        authorizedRemoteOFTs[srcEid][sender] = authorized;
        emit RemoteOFTAuthorized(srcEid, sender, authorized);
    }

    function batchSetAuthorizedRemoteOFTs(uint32[] calldata srcEids, bytes32[] calldata senders, bool authorized)
        external
        onlyDelegateCall
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

    function setCallbackGasLimit(uint128 _gasLimit) external onlyDelegateCall onlyOwner {
        callbackGasLimit = _gasLimit;
        emit CallbackGasLimitUpdated(_gasLimit);
    }

    function pause() external onlyDelegateCall onlyOwner {
        _pause();
    }

    function unpause() external onlyDelegateCall onlyOwner {
        _unpause();
    }

    function emergencyWithdraw(address token, uint256 amount) external onlyDelegateCall onlyOwner whenPaused {
        if (token == address(0)) {
            (bool ok,) = payable(owner()).call{value: amount}("");
            if (!ok) revert InvalidAmount();
        } else {
            IERC20(token).safeTransfer(owner(), amount);
        }
    }

    function _refreshSponsorshipEpoch(SponsorshipPolicy storage policy) internal {
        uint256 start = policy.epochStart;
        if (start == 0) {
            policy.epochStart = block.timestamp;
            return;
        }
        if (policy.epochDuration == 0) return;
        if (block.timestamp >= start + policy.epochDuration) {
            policy.epochStart = block.timestamp;
            policy.spentInEpoch = 0;
        }
    }

    function _lzReceive(Origin calldata, bytes32, bytes calldata, address, bytes calldata)
        internal
        pure
        override
    {
        revert OnlyDelegateCall();
    }
}
