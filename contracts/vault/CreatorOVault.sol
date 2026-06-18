// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {IStrategy} from "../interfaces/IStrategy.sol";
import {IStrategyValuation} from "../interfaces/IStrategyValuation.sol";
import {ICreatorOVaultModuleIdentity} from "./modules/ICreatorOVaultModuleIdentity.sol";
import {CreatorOVaultLiquidityLib} from "./libraries/CreatorOVaultLiquidityLib.sol";

struct CcaLifecycleStatus {
    uint8 phase;
}

interface ICCALifecycleStatusReader {
    function getLifecycleStatus() external view returns (CcaLifecycleStatus memory status);
}

interface ICCAPhaseReader {
    function phase() external view returns (uint8);
}

/**
 * @title CreatorOVault
 * @author 0xakita.eth
 * @notice Synchronous ERC-4626 vault for Creator Coins with full strategy support
 *
 * @dev ARCHITECTURE:
 *      - Fully ERC-4626 compliant vault
 *      - Deposit Creator Coin → mint vault shares
 *      - Deploy idle assets to yield strategies
 *      - Profit unlocking prevents PPS manipulation
 *
 * @dev STRATEGY SYSTEM:
 *      - addStrategy() - Add yield strategy with allocation weight
 *      - removeStrategy() - Remove strategy and withdraw funds
 *      - deployToStrategies() - Deploy idle funds
 *      - report() - Harvest yields and update accounting
 *
 * @dev ACCESS CONTROL:
 *      - Owner: Full control
 *      - Management: Strategy management, fees
 *      - Keeper: Can call report/tend
 *      - EmergencyAdmin: Can shutdown
 *
 * @dev CONSTRUCTOR ARGS (same on all chains):
 *      - _creatorCoin: Creator Coin address
 *      - _owner: deployer
 *      - _name: Vault name (e.g., "Creator OVault - AKITA")
 *      - _symbol: Vault symbol (e.g., "▢AKITA")
 */
contract CreatorOVault is ERC4626, Ownable, ReentrancyGuard, EIP712, IERC20Permit {
    using SafeERC20 for IERC20;

    enum VaultMode {
        Normal,
        Suspect
    }

    enum ImpairmentEpochStatus {
        None,
        Tripped,
        Finalized,
        Resolved
    }

    struct ImpairmentEpoch {
        ImpairmentEpochStatus status;
        address strategy;
        address recoveryAsset;
        uint256 reasonCode;
        uint256 tripBlock;
        uint64 trippedAt;
        uint64 finalizedAt;
        uint64 resolvedAt;
        uint256 totalSharesAtTrip;
        uint256 totalClaimSupply;
        uint256 excludedBookValue;
        bytes32 snapshotRoot;
        uint256 totalRecovered;
        uint256 totalClaimed;
    }

    // =================================
    // CONSTANTS
    // =================================

    /// @notice Maximum performance fee (20%)
    uint16 public constant MAX_FEE = 2_000;

    /// @notice Maximum management (TVL) fee (5% annualized bps charge in report)
    uint16 public constant MAX_MANAGEMENT_FEE = 500;

    /// @notice Risk timelock bounds
    uint64 public constant MIN_RISK_CONFIG_DELAY = 1 days;
    uint64 public constant MAX_RISK_CONFIG_DELAY = 30 days;

    uint8 internal constant RISK_KIND_NONE = 0;
    uint8 internal constant RISK_KIND_PERFORMANCE_FEE = 1;
    uint8 internal constant RISK_KIND_MANAGEMENT_FEE = 2;
    uint8 internal constant RISK_KIND_STRATEGY_MAX_ASSETS = 3;
    uint8 internal constant RISK_KIND_MANAGEMENT_FEE_RECIPIENT = 4;

    bytes32 private constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    /// @notice Basis points denominator
    uint256 internal constant MAX_BPS = 10_000;

    /// @notice Extended precision for profit unlocking rate
    uint256 internal constant MAX_BPS_EXTENDED = 1_000_000_000_000;

    /// @notice Seconds per year
    uint256 internal constant SECONDS_PER_YEAR = 31_556_952;

    /// @notice Maximum strategies
    uint256 public constant MAX_STRATEGIES = 5;
    bytes32 internal constant MODULE_STORAGE_VERSION = keccak256("CreatorOVaultModuleStorage.v3");
    bytes32 internal constant MODULE_KIND_CORE = keccak256("CreatorOVaultModule.core");
    bytes32 internal constant MODULE_KIND_STRATEGIES = keccak256("CreatorOVaultModule.strategies");
    bytes32 internal constant MODULE_KIND_ADMIN = keccak256("CreatorOVaultModule.admin");
    uint8 internal constant CCA_PHASE_AUCTION_LIVE = 1;

    // =================================
    // ANTI-INFLATION ATTACK CONSTANTS
    // =================================

    /**
     * @notice Virtual offset for share calculations (prevents first-depositor inflation attack)
     * @dev Based on OpenZeppelin ERC4626 security recommendations
     *      Offset of 1e3 means an attacker needs to donate 1000x the victim's deposit
     *      to steal 0.1% of their funds - economically unfeasible
     * @custom:security Mitigates yTUSD-style "dust-balance / non-zero-supply" attacks
     */
    uint256 internal constant VIRTUAL_SHARES_OFFSET = 1e3;
    uint256 internal constant VIRTUAL_ASSETS_OFFSET = 1;

    /**
     * @notice Minimum first deposit to ensure meaningful liquidity
     * @dev Serves two purposes:
     *      1. Prevents dust manipulation attacks
     *      2. Ensures creator launches have real liquidity
     *
     * @custom:security Prevents "dust deposit → inflate → value-extraction" attack vector
     * @custom:economics TEMP: 50M tokens = 5% of typical 1B supply
     */
    uint256 public constant MINIMUM_FIRST_DEPOSIT = 50_000_000e18; // TEMP: 50,000,000 tokens minimum

    /**
     * @notice Maximum price change per transaction (in basis points)
     * @dev Prevents catastrophic single-tx price manipulation
     * @custom:security Limits impact of any oracle/accounting manipulation
     */
    uint256 public constant MAX_PRICE_CHANGE_BPS = 1000; // 10% max change per tx

    // =================================
    // STATE VARIABLES
    // =================================

    /// @notice Creator Coin token
    IERC20 public immutable CREATOR_COIN;

    /// @notice Current Creator Coin balance held directly by vault
    uint256 public coinBalance;

    /// @notice Strategy management
    mapping(address => bool) public activeStrategies;
    mapping(address => uint256) public strategyWeights;
    address[] public strategyList;
    uint256 public totalStrategyWeight;

    // =================================
    // ACCESS CONTROL
    // =================================

    /// @notice Management role (can manage strategies)
    address public management;
    address public pendingManagement;

    /// @notice Keeper role (can call report/tend)
    address public keeper;

    /// @notice Emergency admin (can shutdown)
    address public emergencyAdmin;

    /// @notice GaugeController (can burn shares)
    address public gaugeController;

    /// @notice Burn stream contract (can burn its own shares for PPS increase)
    /// @dev Set once (immutable-by-policy) to avoid "trust me bro" rug vectors.
    address internal burnStream;

    // =================================
    // PERFORMANCE FEES
    // =================================

    /// @notice Performance fee in basis points
    uint16 public performanceFee;

    /// @notice Performance fee recipient
    address public performanceFeeRecipient;

    // =================================
    // PROFIT UNLOCKING
    // =================================

    /// @notice Shares to unlock per second
    uint256 public profitUnlockingRate;

    /// @notice When all profits unlocked
    uint96 public fullProfitUnlockDate;

    /// @notice Max time to unlock profits
    uint32 public profitMaxUnlockTime;

    /// @notice Shares locked from last report
    uint256 public totalLockedShares;

    /// @notice Shares currently held by queued withdrawals
    uint256 public totalQueuedWithdrawalShares;

    /// @notice Last timestamp that profit unlock processing was applied
    uint96 public lastProfitUnlockUpdate;

    // =================================
    // REPORTING
    // =================================

    /// @notice Last report timestamp
    uint96 public lastReport;

    /// @notice Total assets at last report
    uint256 public totalAssetsAtLastReport;

    /// @notice Trusted price-per-share checkpoint (1e18) refreshed on `report()`
    uint256 public trustedPpsCheckpoint;

    /// @notice Maximum allowed deviation from trusted PPS for deposit/mint gating
    uint256 public trustedPpsMaxDeviationBps = 1_000; // 10%

    /// @notice Total shares burned for price increase
    uint256 public totalSharesBurned;

    // =================================
    // CONTROLS
    // =================================

    /// @notice Shutdown flag
    bool public isShutdown;

    /// @notice Pause flag
    bool public paused;

    /// @notice Whitelist enabled
    bool public whitelistEnabled;

    /// @notice Whitelist mapping
    mapping(address => bool) public whitelist;

    // =================================
    // OPERATOR AUTHORIZATION (EXECUTION WALLETS)
    // =================================

    /// @notice Bitmask permission: deposit-like actions
    uint256 public constant OP_DEPOSIT = 1 << 0;
    /// @notice Bitmask permission: withdraw-like actions
    uint256 public constant OP_WITHDRAW = 1 << 1;
    /// @notice Bitmask permission: activation/batching actions
    uint256 public constant OP_ACTIVATE = 1 << 2;

    /// @notice Operator epoch. Bumped on ownership transfer to invalidate all previous operator grants.
    uint256 public operatorEpoch;

    /// @notice Operator permissions per epoch (epoch-scoped to make invalidation trivial).
    mapping(uint256 => mapping(address => uint256)) internal _operatorPerms;

    /// @notice Nonce for `permitOperator` (separate from Permit2 nonces and deploy authorizations).
    uint256 public operatorNonce;

    bytes32 private constant _PERMIT_OPERATOR_TYPEHASH =
        keccak256("PermitOperator(address exec,uint256 perms,uint256 nonce,uint256 deadline)");

    // =================================
    // PROTOCOL-ASSISTED OWNERSHIP RESCUE (CUSTODY LOSS)
    // =================================

    /// @notice Minimum allowed rescue delay
    uint64 public constant MIN_RESCUE_DELAY = 1 days;
    /// @notice Maximum allowed rescue delay
    uint64 public constant MAX_RESCUE_DELAY = 30 days;

    /// @notice Protocol rescue authority (typically a multisig). Settable by owner (opt-out by setting to 0).
    address public protocolRescue;

    /// @notice Delay before the protocol can finalize an ownership rescue
    uint64 public rescueDelay;

    /// @notice Pending rescue target owner
    address public pendingRescueOwner;

    /// @notice Timestamp when `pendingRescueOwner` may be finalized by `protocolRescue`
    uint64 public rescueUnlockTime;

    /// @notice Maximum total supply (in shares)
    uint256 public maxTotalSupply = type(uint256).max;

    /// @notice Keep this much Creator Coin idle for redemptions
    uint256 public deploymentThreshold = 1000e18;

    /// @notice Minimum deployment interval
    uint256 public minDeploymentInterval = 5 minutes;

    /// @notice Last deployment timestamp
    uint256 public lastDeployment;

    // =================================
    // FLASH LOAN / MEV PROTECTION
    // =================================

    /// @notice Block number of last deposit (per user)
    mapping(address => uint256) public lastDepositBlock;

    /// @notice Minimum blocks between deposit and withdraw (flash loan protection)
    uint256 public withdrawDelayBlocks = 1;

    /// @notice Large withdrawal threshold (requires delay)
    uint256 public largeWithdrawalThreshold = 100_000e18; // 100k tokens

    /// @notice Extra delay for large withdrawals (in blocks)
    uint256 public largeWithdrawalDelayBlocks = 10;

    /// @notice Queued large withdrawals
    struct QueuedWithdrawal {
        uint256 shares;
        uint256 unlockBlock;
        address receiver;
    }
    mapping(address => QueuedWithdrawal) public queuedWithdrawals;

    // =================================
    // YEARN V3 INSPIRED FEATURES
    // =================================

    /// @notice Default withdrawal queue (ordered list of strategies)
    /// @dev Based on Yearn V3: default_queue pattern for predictable withdrawals
    address[] public defaultQueue;

    /// @notice Maximum queue size
    uint256 public constant MAX_QUEUE = 10;

    /// @notice Force use of default queue (ignore custom queue in withdrawals)
    bool public useDefaultQueue;

    /// @notice Automatically allocate deposits to first strategy in queue
    bool public autoAllocate;

    /// @notice Minimum Creator Coin to keep idle for fast redemptions
    /// @dev Based on Yearn V3: minimum_total_idle pattern
    uint256 public minimumTotalIdle = 10_000e18; // 10k tokens default

    /// @notice Current debt per strategy (tracks actual deployed amount)
    mapping(address => uint256) public strategyDebt;

    /// @notice Total debt across all strategies
    uint256 public totalDebt;

    /// @notice Debt purchaser role (can buy bad debt from vault)
    address public debtPurchaser;

    // =================================
    // BYTECODE SIZE: MODULE DISPATCH
    // =================================
    //
    // The vault's runtime bytecode exceeds EIP-170 on Base. We keep behavior the
    // same but move large logic into delegatecall modules. Module addresses are
    // set once post-deploy (by the vault owner, which is the batcher during
    // deploy phases).
    address internal _coreModule;
    address internal _strategiesModule;
    address internal _adminModule;

    /// @notice Governance-enforced per-strategy cap on assets recognised by the vault.
    /// @dev Appended to preserve storage layout. 0 == uncapped. When non-zero, the value
    ///      clamps `_getStrategyAssetsSafe()` so a misreporting strategy (oracle poisoning,
    ///      direct-balance donation accounting, etc.) cannot inflate `totalAssets()` beyond
    ///      the cap governance approved. See OpenZeppelin and Euler analyses of ERC-4626
    ///      inflation/donation attacks (docs/runbooks/strategy-onboarding-checklist.md).
    mapping(address => uint256) public strategyMaxAssets;

    // v2 governance / liquidity transparency
    uint16 public managementFee;
    address public managementFeeRecipient;
    uint64 public riskConfigDelay;
    uint8 public pendingRiskKind;
    address public pendingRiskTarget;
    uint256 public pendingRiskValue;
    uint64 public pendingRiskUnlockTime;
    uint8 public valuationMissThreshold;
    mapping(address => uint8) public strategyValuationMisses;
    mapping(address => uint256) public sharePermitNonces;

    // v3 impairment side-pocket state (appended)
    VaultMode public vaultMode;
    uint256 public activeImpairmentEpoch;
    uint256 public nextImpairmentEpochId;
    uint64 public impairmentChallengeWindow;
    mapping(uint256 => ImpairmentEpoch) public impairmentEpochs;
    mapping(address => bool) public strategyImpaired;
    mapping(uint256 => mapping(address => uint256)) public impairmentAmountClaimed;
    mapping(uint256 => mapping(address => bool)) public impairmentClaimMinted;
    mapping(uint256 => uint64) public impairmentRootUnlockTime;
    mapping(uint256 => bool) public impairmentRootChallenged;
    address public impairmentGuardian;
    address public impairmentClaims;
    address public impairmentRecoveryEscrow;
    address public ccaLaunchStrategy;

    // =================================
    // EVENTS
    // =================================

    event Reported(uint256 profit, uint256 loss, uint256 performanceFees, uint256 totalAssets);
    event ManagementFeeAccrued(uint256 feeAssets, uint256 feeShares, uint256 elapsedSeconds);
    event StrategyValuationAutoDisabled(address indexed strategy, uint8 consecutiveMisses);
    event ImpairmentChallengeWindowUpdated(uint64 newWindow);
    event ImpairmentTripped(
        uint256 indexed epochId,
        address indexed strategy,
        uint256 indexed reasonCode,
        uint256 tripBlock,
        uint256 totalSharesAtTrip
    );
    event ImpairmentTripCleared(uint256 indexed epochId, address indexed strategy);
    event ImpairmentRootProposed(uint256 indexed epochId, bytes32 indexed root, uint64 unlockTime);
    event ImpairmentRootChallenged(uint256 indexed epochId, address indexed challenger, string reason);
    event ImpairmentRootCleared(uint256 indexed epochId);
    event ImpairmentRootFinalized(uint256 indexed epochId, bytes32 indexed root, uint256 totalClaimSupply);
    event ImpairmentFinalized(
        uint256 indexed epochId, address indexed strategy, bytes32 indexed root, uint256 excludedBookValue
    );
    event ImpairmentRecoveryNotified(uint256 indexed epochId, address indexed asset, uint256 amount);
    event ImpairmentRecoveryClaimed(
        uint256 indexed epochId, address indexed account, address indexed receiver, uint256 amount
    );
    event ImpairmentResolved(uint256 indexed epochId);

    event UpdateManagementFee(uint16 newManagementFee);
    event UpdateManagementFeeRecipient(address indexed newRecipient);
    event UpdateRiskConfigDelay(uint64 newDelay);
    event RiskConfigScheduled(uint8 kind, address indexed target, uint256 value, uint64 unlockTime);
    event RiskConfigExecuted(uint8 kind, address indexed target, uint256 value);
    event RiskConfigCancelled(uint8 kind);
    event UpdateValuationMissThreshold(uint8 newThreshold);

    event StrategyAdded(address indexed strategy, uint256 weight);
    event StrategyRemoved(address indexed strategy);
    event StrategyDeployed(address indexed strategy, uint256 amount);
    event StrategyWithdrawn(address indexed strategy, uint256 amount);
    event StrategyWithdrawFailed(address indexed strategy, uint256 amount, bytes revertData);
    event UpdateStrategyMaxAssets(address indexed strategy, uint256 oldCap, uint256 newCap);

    event UpdateManagement(address indexed newManagement);
    event UpdatePendingManagement(address indexed newPendingManagement);
    event UpdateKeeper(address indexed newKeeper);
    event UpdateEmergencyAdmin(address indexed newEmergencyAdmin);
    event UpdateGaugeController(address indexed oldController, address indexed newController);
    event UpdatePerformanceFee(uint16 newPerformanceFee);
    event UpdatePerformanceFeeRecipient(address indexed newRecipient);
    event UpdateProfitMaxUnlockTime(uint256 newProfitMaxUnlockTime);
    event UpdateTrustedPpsDeviationBps(uint256 newTrustedPpsDeviationBps);

    event BalancesSynced(uint256 coinBalance);
    event WhitelistEnabled(bool enabled);
    event WhitelistUpdated(address indexed account, bool status);
    event EmergencyPause(bool paused);
    event VaultShutdown();

    event CapitalInjected(address indexed from, uint256 amount, uint256 newPricePerShare);
    event SharesBurnedForPrice(address indexed from, uint256 shares, uint256 newPricePerShare);
    event EmergencyWithdraw(address indexed to, uint256 amount);

    // Flash loan / MEV protection events
    event WithdrawalQueued(address indexed user, uint256 shares, uint256 unlockBlock);
    event WithdrawalClaimed(address indexed user, uint256 assets);
    event WithdrawalCancelled(address indexed user, uint256 shares);

    // Yearn V3 inspired events
    event UpdateDefaultQueue(address[] newDefaultQueue);
    event UpdateUseDefaultQueue(bool useDefaultQueue);
    event UpdateAutoAllocate(bool autoAllocate);
    event UpdateMinimumTotalIdle(uint256 minimumTotalIdle);
    event UpdateDebtPurchaser(address indexed newDebtPurchaser);
    event DebtUpdated(address indexed strategy, uint256 currentDebt, uint256 newDebt);
    event DebtPurchased(address indexed strategy, uint256 amount, address indexed buyer);
    event UnrealisedLossAssessed(address indexed strategy, uint256 lossAmount);
    event AutoAllocated(address indexed strategy, uint256 amount);

    // Operator authorization events
    event OperatorPermsSet(uint256 indexed epoch, address indexed exec, uint256 perms);
    event OperatorPermitted(
        uint256 indexed epoch, address indexed exec, uint256 perms, uint256 nonce, uint256 deadline
    );
    event OperatorEpochBumped(uint256 newEpoch);

    // Protocol rescue events (custody loss / recovery)
    event RescueConfigured(address indexed rescue, uint64 delay);
    event RescueDisabled();
    event RescueInitiated(address indexed oldOwner, address indexed pendingOwner, uint64 unlockTime);
    event RescueCancelled(address indexed owner);
    event RescueFinalized(address indexed oldOwner, address indexed newOwner);

    // =================================
    // ERRORS
    // =================================

    error ZeroAddress();
    error ZeroAmount();
    error ZeroShares();
    error Unauthorized();
    error Paused();
    error InvalidAmount();
    error InsufficientBalance();
    error StrategyAlreadyActive();
    error StrategyNotActive();
    error MaxStrategiesReached();
    error InvalidWeight();
    error VaultIsShutdown();
    error VaultNotShutdown();
    error OnlyGaugeController();

    /// @notice First deposit must meet minimum threshold
    error FirstDepositTooSmall(uint256 provided, uint256 minimum);

    /// @notice Price change exceeds safety bounds
    error PriceChangeExceedsLimit(uint256 priceBefore, uint256 priceAfter, uint256 maxChangeBps);
    error TrustedPpsDeviationExceeded(uint256 checkpointPps, uint256 currentPps, uint256 maxDeviationBps);

    /// @notice Mint would result in too many shares for assets (inflation protection)
    error InflationAttackDetected(uint256 assets, uint256 shares);

    /// @notice Flash loan protection - must wait before withdrawing
    error WithdrawTooSoon(uint256 currentBlock, uint256 requiredBlock);

    /// @notice Flash loan protection - must wait before transferring freshly minted shares
    error TransferTooSoon(uint256 currentBlock, uint256 requiredBlock);

    /// @notice Large withdrawal must be queued
    error LargeWithdrawalMustBeQueued(uint256 amount, uint256 threshold);

    /// @notice Withdrawal not yet unlocked
    error WithdrawalNotUnlocked(uint256 currentBlock, uint256 unlockBlock);

    /// @notice No queued withdrawal
    error NoQueuedWithdrawal();
    error QueuedWithdrawalReceiverMismatch(address existing, address provided);

    // Yearn V3 inspired errors
    error StrategyHasUnrealisedLosses(address strategy, uint256 lossAmount);
    /// @notice Strategy explicitly reports valuation inputs are unhealthy (oracle stale/unavailable).
    error StrategyValuationNotReady(address strategy);
    error InsufficientIdleForWithdrawal(uint256 requested, uint256 available);
    error QueueTooLong(uint256 length, uint256 maxLength);
    error StrategyNotInQueue(address strategy);
    error NothingToBuy();
    error OnlyDebtPurchaser();

    // Operator authorization errors
    error OperatorPermitExpired(uint256 deadline);
    error PermitExpired(uint256 deadline);
    error InvalidPermitSignature();

    error RiskConfigDelayOutOfBounds(uint64 provided, uint64 min, uint64 max);
    error PendingRiskConfigExists(uint8 kind);
    error NoPendingRiskConfig();
    error RiskConfigTooEarly(uint64 unlockTime);
    error InvalidRiskConfigKind(uint8 kind);
    error InvalidOperatorSignature();
    error VaultNotNormal();
    error VaultNotSuspect();
    error NoActiveImpairment();
    error ImpairmentAlreadyActive(uint256 epochId);
    error InvalidImpairmentEpoch(uint256 epochId);
    error InvalidImpairmentTransition(uint256 epochId);
    error StrategyAlreadyImpaired(address strategy);
    error StrategyNotImpaired(address strategy);
    error InvalidImpairmentReason(uint256 reasonCode);
    error ImpairmentRootNotReady(uint64 unlockTime);
    error ImpairmentRootRequired(uint256 epochId);
    error ImpairmentRootAlreadyFinalized(uint256 epochId);
    error ImpairmentRootChallengedErr(uint256 epochId);
    error ChallengeWindowNotConfigured();
    error ClaimAlreadyMinted(uint256 epochId, address account);
    error InvalidClaimProof(uint256 epochId, address account);
    error NothingToClaim(uint256 epochId, address account);
    error RecoveryEscrowNotConfigured();
    error ClaimSupplyExceeded(uint256 epochId, uint256 totalClaimSupply, uint256 requested);

    // Protocol rescue errors
    error RescueNotConfigured();
    error RescueDelayOutOfBounds(uint64 provided, uint64 min, uint64 max);
    error RescueAlreadyPending(address pendingOwner);
    error RescueNotPending();
    error RescueTooEarly(uint64 unlockTime);
    error InvalidRescueOwner(address newOwner);
    error StrategyAssetMismatch(address expected, address actual);
    error NoStrategies();
    error MaxTotalSupplyBelowCurrent(uint256 provided, uint256 current);
    error TooManyBlocks(uint256 provided, uint256 max);
    error CannotRescueCreatorCoin();
    /// @notice Creator coin transfer did not move the expected amount (fee-on-transfer / rebasing / deflationary not supported).
    error TransferAmountMismatch(uint256 expected, uint256 actual);
    error ETHTransferFailed();

    // Module dispatch errors
    error ModulesNotSet();
    error ModulesAlreadySet();
    error InvalidModuleAddress();

    // =================================
    // MODIFIERS
    // =================================

    modifier onlyManagement() {
        if (msg.sender != management && msg.sender != owner()) revert Unauthorized();
        _;
    }

    modifier onlyKeepers() {
        if (msg.sender != keeper && msg.sender != management && msg.sender != owner()) {
            revert Unauthorized();
        }
        _;
    }

    modifier onlyEmergencyAuthorized() {
        if (msg.sender != emergencyAdmin && msg.sender != management && msg.sender != owner()) {
            revert Unauthorized();
        }
        _;
    }

    modifier onlyGaugeController() {
        if (msg.sender != gaugeController) revert OnlyGaugeController();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    modifier whenNotShutdown() {
        if (isShutdown) revert VaultIsShutdown();
        _;
    }

    modifier onlyWhitelisted() {
        if (whitelistEnabled && !whitelist[msg.sender]) revert Unauthorized();
        _;
    }

    modifier onlyDebtPurchaser() {
        if (msg.sender != debtPurchaser && msg.sender != owner()) revert OnlyDebtPurchaser();
        _;
    }

    modifier onlyProtocolRescue() {
        address rescue = protocolRescue;
        if (rescue == address(0)) revert RescueNotConfigured();
        if (msg.sender != rescue) revert Unauthorized();
        _;
    }

    // =================================
    // CONSTRUCTOR
    // =================================

    /**
     * @notice Deploy CreatorOVault with same address on all chains via CREATE2
     * @param _creatorCoin Creator Coin address
     * @param _owner Owner address
     * @param _name Vault name (e.g., "Creator OVault - AKITA")
     * @param _symbol Vault symbol (e.g., "▢AKITA")
     */
    constructor(address _creatorCoin, address _owner, string memory _name, string memory _symbol)
        ERC20(_name, _symbol)
        ERC4626(IERC20(_creatorCoin))
        Ownable(_owner)
        EIP712("CreatorOVault", "1")
    {
        if (_creatorCoin == address(0)) revert ZeroAddress();

        CREATOR_COIN = IERC20(_creatorCoin);

        // Initialize roles
        management = _owner;
        keeper = _owner;
        emergencyAdmin = _owner;
        performanceFeeRecipient = _owner;
        managementFeeRecipient = _owner;
        performanceFee = 0; // 0% default
        managementFee = 0;
        profitMaxUnlockTime = 7 days;
        rescueDelay = uint64(7 days);

        whitelist[_owner] = true;
        lastDeployment = block.timestamp;
        lastReport = uint96(block.timestamp);
        lastProfitUnlockUpdate = uint96(block.timestamp);
        vaultMode = VaultMode.Normal;
        impairmentChallengeWindow = uint64(1 days);
    }

    // =================================
    // MODULE INITIALIZATION
    // =================================

    event ModulesSet(address indexed coreModule, address indexed strategiesModule, address indexed adminModule);

    function setModulesOnce(address coreModule, address strategiesModule, address adminModule) external onlyOwner {
        if (_coreModule != address(0) || _strategiesModule != address(0) || _adminModule != address(0)) {
            revert ModulesAlreadySet();
        }
        if (coreModule == address(0) || strategiesModule == address(0) || adminModule == address(0)) {
            revert ZeroAddress();
        }
        address self = address(this);
        if (coreModule == self || strategiesModule == self || adminModule == self) {
            revert InvalidModuleAddress();
        }
        if (coreModule == strategiesModule || coreModule == adminModule || strategiesModule == adminModule) {
            revert InvalidModuleAddress();
        }
        if (coreModule.code.length == 0 || strategiesModule.code.length == 0 || adminModule.code.length == 0) {
            revert InvalidModuleAddress();
        }
        _validateModuleIdentity(coreModule, MODULE_KIND_CORE);
        _validateModuleIdentity(strategiesModule, MODULE_KIND_STRATEGIES);
        _validateModuleIdentity(adminModule, MODULE_KIND_ADMIN);

        _coreModule = coreModule;
        _strategiesModule = strategiesModule;
        _adminModule = adminModule;

        emit ModulesSet(coreModule, strategiesModule, adminModule);
    }

    function _validateModuleIdentity(address module, bytes32 expectedKind) internal view {
        try ICreatorOVaultModuleIdentity(module).moduleKind() returns (bytes32 moduleKind) {
            if (moduleKind != expectedKind) revert InvalidModuleAddress();
        } catch {
            revert InvalidModuleAddress();
        }

        try ICreatorOVaultModuleIdentity(module).moduleStorageVersion() returns (bytes32 moduleStorageVersion) {
            if (moduleStorageVersion != MODULE_STORAGE_VERSION) revert InvalidModuleAddress();
        } catch {
            revert InvalidModuleAddress();
        }
    }

    function _requireModulesSet() internal view {
        if (_coreModule == address(0) || _strategiesModule == address(0) || _adminModule == address(0)) {
            revert ModulesNotSet();
        }
    }

    /// @dev Delegatecall is intentional: modules execute against this vault's storage root.
    ///      Access control is enforced by the calling external functions before dispatch.
    function _delegate(address module) internal {
        if (module == address(0)) revert ModulesNotSet();
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), module, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    /// @dev Delegatecall helper that returns normally so modifiers can clean up.
    ///      Do NOT use `_delegate()` from a function with a modifier that has an epilogue
    ///      (e.g. OZ `nonReentrant`), since `_delegate()` uses an assembly `return`.
    ///      Delegate targets are module addresses configured by owner-only `setModulesOnce`.
    function _delegateAndReturn(address module) internal returns (bytes memory ret) {
        if (module == address(0)) revert ModulesNotSet();
        (bool ok, bytes memory data) = module.delegatecall(msg.data);
        if (!ok) {
            assembly {
                revert(add(data, 0x20), mload(data))
            }
        }
        return data;
    }

    // Module-call helpers: callable only via self-call.
    function __moduleUpdate(address from, address to, uint256 value) external {
        if (msg.sender != address(this)) revert Unauthorized();
        _update(from, to, value);
    }

    function __moduleSpendAllowance(address owner_, address spender, uint256 value) external {
        if (msg.sender != address(this)) revert Unauthorized();
        _spendAllowance(owner_, spender, value);
    }

    function __moduleTransferOwnership(address newOwner) external {
        if (msg.sender != address(this)) revert Unauthorized();
        _transferOwnership(newOwner);
    }

    // =================================
    // PROFIT UNLOCKING
    // =================================

    /**
     * @notice Calculate unlocked shares pending burn
     * @dev Shows matured shares since last unlock processing checkpoint
     */
    function unlockedShares() public view returns (uint256) {
        uint256 locked = totalLockedShares;
        if (locked == 0) return 0;

        uint256 unlockDate = fullProfitUnlockDate;
        if (unlockDate == 0) return 0;

        uint256 checkpoint = lastProfitUnlockUpdate;
        uint256 currentTime = block.timestamp;
        if (currentTime <= checkpoint) return 0;

        if (currentTime >= unlockDate) {
            return locked;
        }

        uint256 elapsed = currentTime - checkpoint;
        uint256 unlockedAmount = (profitUnlockingRate * elapsed) / MAX_BPS_EXTENDED;
        return unlockedAmount > locked ? locked : unlockedAmount;
    }

    /**
     * @notice Get locked (not yet unlocked) shares
     */
    function lockedShares() public view returns (uint256) {
        return totalLockedShares - unlockedShares();
    }

    /**
     * @notice Profit shares available on vault balance (excludes queued withdrawals)
     */
    function _availableProfitShares() internal view returns (uint256) {
        uint256 vaultBalance = balanceOf(address(this));
        uint256 queued = totalQueuedWithdrawalShares;
        if (vaultBalance <= queued) return 0;
        return vaultBalance - queued;
    }

    /**
     * @notice Adjust report baseline upward for user principal inflows
     * @dev Bootstraps from live assets when baseline is uninitialized (legacy vaults)
     */
    // FIX: I-04 — do not rebuild baseline from live totalAssets() when baseline is zero;
    // simply apply the delta to prevent flash-loan-assisted baseline manipulation
    function _increaseReportBaselineForPrincipalInflow(uint256 assets) internal {
        if (assets == 0) return;
        totalAssetsAtLastReport += assets;
    }

    /**
     * @notice Adjust report baseline downward for user principal outflows
     * @dev Uses floor-at-zero semantics to avoid underflow on extreme outflows
     */
    function _decreaseReportBaselineForPrincipalOutflow(uint256 assets) internal {
        if (assets == 0) return;
        uint256 previousTotalAssets = totalAssetsAtLastReport;
        totalAssetsAtLastReport = assets >= previousTotalAssets ? 0 : previousTotalAssets - assets;
    }

    /**
     * @notice Burn matured profit-lock shares to realize unlock progression
     */
    function _processProfitUnlock() internal {
        uint256 locked = totalLockedShares;
        if (locked == 0) {
            if (profitUnlockingRate != 0) profitUnlockingRate = 0;
            if (fullProfitUnlockDate != 0) fullProfitUnlockDate = 0;
            lastProfitUnlockUpdate = uint96(block.timestamp);
            return;
        }

        uint256 unlockDate = fullProfitUnlockDate;
        if (unlockDate == 0) return;

        uint256 checkpoint = lastProfitUnlockUpdate;
        uint256 currentTime = block.timestamp;
        if (currentTime <= checkpoint) return;

        uint256 targetTime = currentTime < unlockDate ? currentTime : unlockDate;
        uint256 elapsed = targetTime - checkpoint;
        if (elapsed == 0) return;

        uint256 matured = (profitUnlockingRate * elapsed) / MAX_BPS_EXTENDED;
        if (targetTime == unlockDate || matured > locked) {
            matured = locked;
        }
        if (matured == 0) return;

        uint256 availableProfit = _availableProfitShares();
        uint256 sharesToBurn = matured > availableProfit ? availableProfit : matured;
        if (sharesToBurn == 0) return;

        _burn(address(this), sharesToBurn);
        totalLockedShares = locked - sharesToBurn;

        uint256 consumedElapsed =
            sharesToBurn == matured ? elapsed : (sharesToBurn * MAX_BPS_EXTENDED) / profitUnlockingRate;
        if (consumedElapsed == 0) consumedElapsed = 1;
        if (consumedElapsed > elapsed) consumedElapsed = elapsed;
        lastProfitUnlockUpdate = uint96(checkpoint + consumedElapsed);

        if (totalLockedShares == 0) {
            profitUnlockingRate = 0;
            fullProfitUnlockDate = 0;
        }
    }

    // =================================
    // ERC4626 OVERRIDES
    // =================================

    /**
     * @notice Total assets controlled by vault
     * @dev Includes idle balance + strategy deployments
     */
    function totalAssets() public view override returns (uint256) {
        // FIX: L-06 — use tracked coinBalance instead of live balanceOf to prevent
        // donation-based fee extraction via direct token transfers
        uint256 total = coinBalance;

        // Add strategy holdings
        uint256 len = strategyList.length;
        for (uint256 i; i < len; i++) {
            if (activeStrategies[strategyList[i]] && !strategyImpaired[strategyList[i]]) {
                total += _getStrategyAssetsSafe(strategyList[i]);
            }
        }

        return total;
    }

    /**
     * @notice Read strategy assets without allowing a single faulty strategy to brick the vault.
     * @dev Returns tracked `strategyDebt` when strategy valuation reverts.
     */
    function _getStrategyAssetsSafe(address strategy) internal view returns (uint256 assets) {
        try IStrategy(strategy).getTotalAssets() returns (uint256 reportedAssets) {
            assets = reportedAssets;
        } catch {
            // If valuation is unavailable, fall back to vault-side accounting so:
            // - `totalAssets()` remains usable for ERC-4626 previews
            // - withdrawals can still attempt to pull liquidity
            assets = strategyDebt[strategy];
        }

        // Governance cap: clamp recognised assets so a strategy reporting an
        // inflated valuation cannot push `totalAssets()` past the approved cap.
        // 0 == uncapped (preserves prior behaviour for unconfigured strategies).
        uint256 cap = strategyMaxAssets[strategy];
        if (cap != 0 && assets > cap) {
            assets = cap;
        }
    }

    /**
     * @notice Find the first active strategy explicitly reporting unhealthy valuation.
     * @dev Strategies MUST implement `IStrategyValuation` and MUST NOT revert in valuation
     *      reads. Missing interfaces or any reverts are treated as NOT ready to prevent
     *      ERC-4626 share dilution when `totalAssets()` would be under-reported.
     */
    function _firstStrategyValuationNotReady() internal view returns (address bad) {
        uint256 len = strategyList.length;
        for (uint256 i; i < len; i++) {
            address strategy = strategyList[i];
            if (!activeStrategies[strategy] || strategyImpaired[strategy]) continue;

            try IStrategyValuation(strategy).isValuationReady() returns (bool ok) {
                if (!ok) return strategy;
            } catch {
                // Missing `IStrategyValuation` support or misbehaving implementation.
                return strategy;
            }

            // Even when readiness returns true, do not proceed if valuation reads revert.
            // If a strategy valuation reverts, `totalAssets()` would treat it as 0 via
            // `_getStrategyAssetsSafe()`, which enables ERC-4626 share inflation.
            try IStrategy(strategy).getTotalAssets() returns (
                uint256 /* reportedAssets */
            ) {
            // ok
            }
            catch {
                return strategy;
            }
        }

        return address(0);
    }

    function _requireStrategyValuationsReady() internal view {
        address bad = _firstStrategyValuationNotReady();
        if (bad != address(0)) revert StrategyValuationNotReady(bad);
    }

    function _isCcaAuctionLive() internal view returns (bool) {
        address strategy = ccaLaunchStrategy;
        if (strategy == address(0)) return false;

        try ICCALifecycleStatusReader(strategy).getLifecycleStatus() returns (CcaLifecycleStatus memory status) {
            return status.phase == CCA_PHASE_AUCTION_LIVE;
        } catch {
            // Fallback for stale/legacy strategy wiring that does not expose lifecycle snapshots.
            try ICCAPhaseReader(strategy).phase() returns (uint8 phaseValue) {
                return phaseValue == CCA_PHASE_AUCTION_LIVE;
            } catch {
                // Fail closed: when a strategy is configured but lifecycle reads fail,
                // disable deposits/mints until wiring is corrected.
                return true;
            }
        }
    }

    /**
     * @notice Deposit Creator Coin into vault
     * @dev Protected against first-depositor inflation attacks via:
     *      1. Minimum first deposit requirement
     *      2. Virtual shares offset in conversion
     *      3. Shares/assets ratio sanity check
     * @custom:security See yTUSD exploit mitigation notes
     */
    function deposit(uint256 assets, address receiver)
        public
        override
        nonReentrant
        whenNotPaused
        whenNotShutdown
        onlyWhitelisted
        returns (uint256 shares)
    {
        bytes memory ret = _delegateAndReturn(_coreModule);
        shares = abi.decode(ret, (uint256));
    }

    /**
     * @notice Mint exact shares
     * @dev Protected against inflation attacks
     * @custom:security See yTUSD exploit mitigation notes
     */
    function mint(uint256 shares, address receiver)
        public
        override
        nonReentrant
        whenNotPaused
        whenNotShutdown
        onlyWhitelisted
        returns (uint256 assets)
    {
        bytes memory ret = _delegateAndReturn(_coreModule);
        assets = abi.decode(ret, (uint256));
    }

    /**
     * @notice Redeem shares for Creator Coin
     * @dev SYNCHRONOUS - Transfers immediately for small amounts
     *      Large withdrawals must be queued for MEV protection
     * @custom:security Flash loan protected - cannot withdraw same block as deposit
     */
    function redeem(uint256 shares, address receiver, address owner_)
        public
        override
        nonReentrant
        returns (uint256 assets)
    {
        bytes memory ret = _delegateAndReturn(_coreModule);
        assets = abi.decode(ret, (uint256));
    }

    /**
     * @notice Withdraw exact Creator Coin amount
     * @dev SYNCHRONOUS - Transfers immediately for small amounts
     *      Large withdrawals must be queued for MEV protection
     * @custom:security Flash loan protected - cannot withdraw same block as deposit
     */
    function withdraw(uint256 assets, address receiver, address owner_)
        public
        override
        nonReentrant
        returns (uint256 shares)
    {
        bytes memory ret = _delegateAndReturn(_coreModule);
        shares = abi.decode(ret, (uint256));
    }

    // =================================
    // LARGE WITHDRAWAL QUEUE (MEV Protection)
    // =================================

    /**
     * @notice Queue a large withdrawal
     * @dev Required for withdrawals >= largeWithdrawalThreshold
     *      Must wait largeWithdrawalDelayBlocks before claiming
     * @param shares Amount of shares to withdraw
     * @param receiver Address to receive Creator Coin when claimed
     */
    function queueWithdrawal(uint256 shares, address receiver) external nonReentrant {
        _delegateAndReturn(_coreModule);
    }

    /**
     * @notice Claim a queued withdrawal after delay period
     * @dev Can only be called after unlockBlock has passed
     */
    function claimQueuedWithdrawal() external nonReentrant returns (uint256 assets) {
        bytes memory ret = _delegateAndReturn(_coreModule);
        assets = abi.decode(ret, (uint256));
    }

    /**
     * @notice Cancel a queued withdrawal and get shares back
     */
    function cancelQueuedWithdrawal() external nonReentrant returns (uint256 shares) {
        bytes memory ret = _delegateAndReturn(_coreModule);
        shares = abi.decode(ret, (uint256));
    }

    // =================================
    // IMPAIRMENT SIDE-POCKET (V1)
    // =================================

    function setImpairmentChallengeWindow(uint64 window) external onlyManagement {
        _delegate(_coreModule);
    }

    function setImpairmentGuardian(address guardian) external onlyOwner {
        _delegate(_adminModule);
    }

    function setImpairmentClaims(address claims) external onlyOwner {
        _delegate(_adminModule);
    }

    function setImpairmentRecoveryEscrow(address escrow) external onlyOwner {
        _delegate(_adminModule);
    }

    function tripImpairment(address strategy, uint256 reasonCode)
        external
        nonReentrant
        onlyEmergencyAuthorized
        returns (uint256 epochId)
    {
        bytes memory ret = _delegateAndReturn(_coreModule);
        epochId = abi.decode(ret, (uint256));
    }

    function clearImpairmentTrip(uint256 epochId) external nonReentrant onlyEmergencyAuthorized {
        _delegateAndReturn(_coreModule);
    }

    function proposeImpairmentRoot(uint256 epochId, bytes32 snapshotRoot, uint256 totalClaimSupply, address recoveryAsset)
        external
        nonReentrant
        onlyManagement
    {
        _delegateAndReturn(_coreModule);
    }

    function challengeImpairmentRoot(uint256 epochId, string calldata reason) external nonReentrant onlyEmergencyAuthorized {
        _delegateAndReturn(_coreModule);
    }

    function clearImpairmentRootAfterChallenge(uint256 epochId) external nonReentrant onlyManagement {
        _delegateAndReturn(_coreModule);
    }

    function finalizeImpairment(uint256 epochId) external nonReentrant onlyManagement {
        _delegateAndReturn(_coreModule);
    }

    function mintImpairmentClaim(uint256 epochId, address account, uint256 amount, bytes32[] calldata proof)
        external
        nonReentrant
    {
        _delegateAndReturn(_coreModule);
    }

    function notifyImpairmentRecovery(uint256 epochId, uint256 amount) external nonReentrant onlyKeepers {
        _delegateAndReturn(_coreModule);
    }

    function claimImpairmentRecovery(uint256 epochId, address receiver, uint256 claimUnits)
        external
        nonReentrant
        returns (uint256 amountOut)
    {
        bytes memory ret = _delegateAndReturn(_coreModule);
        amountOut = abi.decode(ret, (uint256));
    }

    /**
     * @notice Preview redeem (ERC-4626 override)
     * @dev FIX: S-C02 — cap preview at liquid assets minus queued withdrawals.
     *      OZ default uses totalAssets()/totalSupply() which overstates realisable value
     *      when totalQueuedWithdrawalShares > 0 (those shares claim assets at redemption).
     */
    function previewRedeem(uint256 shares) public view override returns (uint256) {
        uint256 assets = super.previewRedeem(shares);
        // Cap at available liquid assets not reserved for queued withdrawals
        uint256 liquid = totalAssets();
        uint256 reserved = super.previewRedeem(totalQueuedWithdrawalShares);
        uint256 available = liquid > reserved ? liquid - reserved : 0;
        return assets > available ? available : assets;
    }

    /**
     * @notice Max deposit (standard ERC4626)
     */
    function maxDeposit(address receiver) public view override returns (uint256) {
        if (vaultMode != VaultMode.Normal) return 0;
        if (_isCcaAuctionLive()) return 0;
        if (paused || isShutdown) return 0;
        if (whitelistEnabled && !whitelist[receiver]) return 0;
        if (_firstStrategyValuationNotReady() != address(0)) return 0;
        uint256 currentSupply = totalSupply();
        if (currentSupply >= maxTotalSupply) return 0;

        uint256 remainingShares = maxTotalSupply - currentSupply;
        uint256 supply = totalSupply();
        // FIX: M-05 — return asset-denominated value when supply is zero (ERC-4626 compliance)
        // Vault uses _decimalsOffset() = 3, so shares = assets * 10^3
        if (supply == 0) return remainingShares / (10 ** _decimalsOffset());

        return (remainingShares * totalAssets()) / supply;
    }

    /**
     * @notice Max mint (standard ERC4626)
     */
    function maxMint(address receiver) public view override returns (uint256) {
        if (vaultMode != VaultMode.Normal) return 0;
        if (_isCcaAuctionLive()) return 0;
        if (paused || isShutdown) return 0;
        if (whitelistEnabled && !whitelist[receiver]) return 0;
        if (_firstStrategyValuationNotReady() != address(0)) return 0;
        uint256 currentSupply = totalSupply();
        if (currentSupply >= maxTotalSupply) return 0;
        return maxTotalSupply - currentSupply;
    }

    /**
     * @notice Max withdraw (standard ERC4626)
     */
    function maxWithdraw(address owner_) public view override returns (uint256) {
        if (vaultMode != VaultMode.Normal) return 0;
        if (paused) return 0;
        uint256 userShares = balanceOf(owner_);
        if (userShares == 0) return 0;
        uint256 assetsFromShares = previewRedeem(userShares);
        if (largeWithdrawalThreshold == 0) return assetsFromShares;
        uint256 maxSyncAssets = largeWithdrawalThreshold - 1;
        return assetsFromShares > maxSyncAssets ? maxSyncAssets : assetsFromShares;
    }

    /**
     * @notice Max redeem (standard ERC4626)
     */
    function maxRedeem(address owner_) public view override returns (uint256) {
        if (vaultMode != VaultMode.Normal) return 0;
        if (paused) return 0;
        uint256 userShares = balanceOf(owner_);
        if (userShares == 0) return 0;
        if (largeWithdrawalThreshold == 0) return userShares;

        uint256 maxSyncAssets = largeWithdrawalThreshold - 1;
        uint256 syncShares = previewWithdraw(maxSyncAssets);
        return syncShares > userShares ? userShares : syncShares;
    }

    // =================================
    // ENSURE COIN HELPER
    // =================================

    /**
     * @notice Synchronize internal `coinBalance` to the real token balance.
     * @dev `coinBalance` is used for operational decisions; we keep it strict and synced
     *      to prevent share pricing / solvency issues with non-standard ERC-20 behavior.
     */
    function _syncCoinBalance() internal returns (uint256 actual) {
        actual = CREATOR_COIN.balanceOf(address(this));
        coinBalance = actual;
    }

    /**
     * @notice Pull creator coin and require exact receipt.
     * @dev Rejects fee-on-transfer / deflationary / rebasing tokens by enforcing
     *      that the vault's balance increases by exactly `amount`.
     */
    function _pullCreatorCoinExact(address from, uint256 amount) internal returns (uint256 received) {
        uint256 beforeBal = CREATOR_COIN.balanceOf(address(this));
        CREATOR_COIN.safeTransferFrom(from, address(this), amount);
        uint256 afterBal = CREATOR_COIN.balanceOf(address(this));

        received = afterBal - beforeBal;
        if (received != amount) revert TransferAmountMismatch(amount, received);

        // Keep internal accounting synchronized with the actual balance.
        coinBalance = afterBal;
    }

    /**
     * @notice Push creator coin out of vault and require exact vault-side debit.
     * @dev Enforces that the vault's own balance decreases by exactly `amount`.
     */
    function _pushCreatorCoinExact(address to, uint256 amount) internal returns (uint256 spent) {
        uint256 beforeBal = CREATOR_COIN.balanceOf(address(this));
        CREATOR_COIN.safeTransfer(to, amount);
        uint256 afterBal = CREATOR_COIN.balanceOf(address(this));

        spent = beforeBal - afterBal;
        if (spent != amount) revert TransferAmountMismatch(amount, spent);

        coinBalance = afterBal;
    }

    /**
     * @notice Deploy creator coin into a strategy using measured vault outflow.
     * @dev Uses vault-side balance delta (`spent`) as canonical accounting input so
     *      fee-on-transfer / partial-spend strategy internals do not revert keeper deploys.
     */
    function _depositIntoStrategyMeasured(address strategy, uint256 amount) internal returns (uint256 deposited) {
        uint256 beforeBal = CREATOR_COIN.balanceOf(address(this));
        CREATOR_COIN.forceApprove(strategy, amount);
        IStrategy(strategy).deposit(amount);
        uint256 afterBal = CREATOR_COIN.balanceOf(address(this));

        if (afterBal > beforeBal) revert TransferAmountMismatch(amount, 0);
        uint256 spent = beforeBal - afterBal;
        if (spent > amount) revert TransferAmountMismatch(amount, spent);

        deposited = spent;
        coinBalance = afterBal;
    }

    /**
     * @notice Withdraw from strategy and validate returned amount against balance delta.
     */
    function _withdrawFromStrategyMeasured(address strategy, uint256 amount) internal returns (uint256 withdrawn) {
        uint256 beforeBal = CREATOR_COIN.balanceOf(address(this));
        withdrawn = IStrategy(strategy).withdraw(amount);
        uint256 afterBal = CREATOR_COIN.balanceOf(address(this));

        uint256 received = afterBal - beforeBal;
        if (received != withdrawn) revert TransferAmountMismatch(withdrawn, received);

        coinBalance = afterBal;
    }

    /**
     * @notice Best-effort strategy withdrawal for user redemptions.
     * @dev Never reverts on strategy failure; returns the measured amount received by the vault.
     */
    function _withdrawFromStrategyBestEffort(address strategy, uint256 amount) internal returns (uint256 withdrawn) {
        if (amount == 0) return 0;

        uint256 beforeBal = CREATOR_COIN.balanceOf(address(this));

        try IStrategy(strategy).withdraw(amount) returns (uint256 reported) {
            uint256 afterBal = CREATOR_COIN.balanceOf(address(this));

            // Defensive: a withdraw should never decrease the vault balance.
            if (afterBal < beforeBal) {
                _syncCoinBalance();
                emit StrategyWithdrawFailed(strategy, amount, bytes("NEGATIVE_BALANCE_DELTA"));
                return 0;
            }

            uint256 received = afterBal - beforeBal;

            // Keep internal accounting synchronized with the actual balance.
            coinBalance = afterBal;

            // If the strategy return value doesn't match reality, emit and trust the balance delta.
            if (received != reported) {
                emit StrategyWithdrawFailed(
                    strategy, amount, abi.encodeWithSelector(TransferAmountMismatch.selector, reported, received)
                );
            }

            return received;
        } catch (bytes memory err) {
            _syncCoinBalance();
            emit StrategyWithdrawFailed(strategy, amount, err);
            return 0;
        }
    }

    /**
     * @notice Ensure vault has enough Creator Coin for redemptions
     * @dev Withdraws from strategies if needed
     */
    function _ensureCoin(uint256 coinNeeded) internal {
        uint256 available = _syncCoinBalance();
        if (available >= coinNeeded) return;

        uint256 deficit = coinNeeded - available;

        // Withdraw from strategies
        _withdrawFromStrategies(deficit);

        available = _syncCoinBalance();
        if (available < coinNeeded) {
            revert InsufficientBalance();
        }
    }

    /**
     * @notice Check that price change is within acceptable bounds
     * @dev Prevents catastrophic single-tx price manipulation
     * @custom:security Key defense against yTUSD-style cascading failures
     * @param priceBefore Price per share before operation
     * @param priceAfter Price per share after operation
     */
    function _checkPriceChange(uint256 priceBefore, uint256 priceAfter) internal pure {
        if (priceBefore == 0) return; // First deposit, no check needed

        uint256 priceDiff;
        if (priceAfter > priceBefore) {
            priceDiff = priceAfter - priceBefore;
        } else {
            priceDiff = priceBefore - priceAfter;
        }

        // Check if change exceeds MAX_PRICE_CHANGE_BPS (default 10%)
        uint256 maxAllowedChange = (priceBefore * MAX_PRICE_CHANGE_BPS) / MAX_BPS;
        if (priceDiff > maxAllowedChange) {
            revert PriceChangeExceedsLimit(priceBefore, priceAfter, MAX_PRICE_CHANGE_BPS);
        }
    }

    // =================================
    // STRATEGY MANAGEMENT
    // =================================

    /**
     * @notice Add a new strategy
     * @param strategy Strategy address
     * @param weight Allocation weight (basis points, total <= 10000)
     */
    // FIX: L-04 — add nonReentrant to prevent reentrancy during strategy external calls
    function addStrategy(address strategy, uint256 weight) external nonReentrant onlyManagement {
        _delegateAndReturn(_strategiesModule);
    }

    /**
     * @notice Add a new yield strategy with queue option
     * @dev Based on Yearn V3: add_strategy pattern
     * @param strategy Strategy address (must be ERC-4626 compatible)
     * @param weight Allocation weight (basis points, max 10000)
     * @param addToQueue Whether to add to default withdrawal queue
     */
    // FIX: L-04 — add nonReentrant to prevent reentrancy during strategy external calls
    function addStrategy(address strategy, uint256 weight, bool addToQueue) public nonReentrant onlyManagement {
        _delegateAndReturn(_strategiesModule);
    }

    /**
     * @notice Remove a strategy
     * @dev Withdraws all funds before removal
     */
    // FIX: L-04 — add nonReentrant to prevent reentrancy during strategy external calls
    function removeStrategy(address strategy) external nonReentrant onlyManagement {
        _delegateAndReturn(_strategiesModule);
    }

    // FIX: M-02 — force-remove a strategy that cannot return full debt (accepts loss)
    function forceRemoveStrategy(address strategy) external nonReentrant onlyManagement {
        _delegateAndReturn(_strategiesModule);
    }

    function reinstateImpairedStrategy(address strategy, uint256 epochId) external nonReentrant onlyManagement {
        _delegateAndReturn(_strategiesModule);
    }

    /**
     * @notice Remove a strategy from the default queue
     * @dev Internal helper based on Yearn V3 pattern
     */
    function _removeFromQueue(address strategy) internal {
        uint256 queueLength = defaultQueue.length;
        for (uint256 i = 0; i < queueLength; i++) {
            if (defaultQueue[i] == strategy) {
                defaultQueue[i] = defaultQueue[queueLength - 1];
                defaultQueue.pop();
                emit UpdateDefaultQueue(defaultQueue);
                break;
            }
        }
    }

    /**
     * @notice Update strategy weight
     */
    // FIX: L-04 — add nonReentrant to prevent reentrancy during strategy weight update
    function updateStrategyWeight(address strategy, uint256 newWeight) external nonReentrant onlyManagement {
        _delegateAndReturn(_strategiesModule);
    }

    /**
     * @notice Deploy idle funds to strategies
     */
    function deployToStrategies() external nonReentrant onlyKeepers {
        _delegateAndReturn(_strategiesModule);
    }

    /**
     * @notice Force deploy (management only)
     */
    function forceDeployToStrategies() external nonReentrant onlyManagement {
        _delegateAndReturn(_strategiesModule);
    }

    /**
     * @notice Internal deploy logic
     */
    function _deployToStrategies() internal {
        if (totalStrategyWeight == 0) return;

        // Keep coinBalance aligned to real idle balance before computing deployable amounts.
        uint256 idleBalance = _syncCoinBalance();

        // Yearn V3: Use minimumTotalIdle instead of deploymentThreshold
        uint256 minIdle = minimumTotalIdle > deploymentThreshold ? minimumTotalIdle : deploymentThreshold;
        uint256 deployable = idleBalance > minIdle ? idleBalance - minIdle : 0;

        if (deployable == 0) return;

        uint256 length = strategyList.length;
        for (uint256 i = 0; i < length; i++) {
            address strategy = strategyList[i];
            if (activeStrategies[strategy] && strategyWeights[strategy] > 0) {
                uint256 amount = (deployable * strategyWeights[strategy]) / totalStrategyWeight;

                if (amount > coinBalance) amount = coinBalance;

                if (amount > 0) {
                    uint256 currentDebt = strategyDebt[strategy];
                    uint256 deposited = _depositIntoStrategyMeasured(strategy, amount);

                    // Yearn V3: Track strategy debt
                    uint256 newDebt = currentDebt + deposited;
                    strategyDebt[strategy] = newDebt;
                    totalDebt += deposited;

                    emit DebtUpdated(strategy, currentDebt, newDebt);
                    emit StrategyDeployed(strategy, deposited);
                }
            }
        }

        lastDeployment = block.timestamp;
    }

    /**
     * @notice Withdraw from strategies
     */
    function _withdrawFromStrategies(uint256 amountNeeded) internal returns (uint256 totalWithdrawn) {
        uint256 remaining = amountNeeded;

        // Yearn V3: Use default queue for withdrawal order
        address[] memory queue = defaultQueue.length > 0 ? defaultQueue : strategyList;
        uint256 length = queue.length;

        for (uint256 i = 0; i < length && remaining > 0; i++) {
            address strategy = queue[i];
            if (activeStrategies[strategy]) {
                uint256 currentDebt = strategyDebt[strategy];
                uint256 strategyAssets = _getStrategyAssetsSafe(strategy);

                if (strategyAssets > 0) {
                    uint256 toWithdraw = remaining > strategyAssets ? strategyAssets : remaining;

                    // Yearn V3: Assess unrealized losses before withdrawal
                    uint256 unrealizedLoss = _assessUnrealisedLoss(strategy, currentDebt, toWithdraw);
                    if (unrealizedLoss > 0) {
                        emit UnrealisedLossAssessed(strategy, unrealizedLoss);
                    }

                    uint256 withdrawn = _withdrawFromStrategyBestEffort(strategy, toWithdraw);
                    if (withdrawn == 0) continue;
                    totalWithdrawn += withdrawn;
                    remaining = remaining > withdrawn ? remaining - withdrawn : 0;

                    // Yearn V3: Update debt tracking
                    uint256 debtReduction = withdrawn > currentDebt ? currentDebt : withdrawn;
                    uint256 newDebt = currentDebt - debtReduction;
                    strategyDebt[strategy] = newDebt;
                    totalDebt -= debtReduction;

                    emit DebtUpdated(strategy, currentDebt, newDebt);
                    emit StrategyWithdrawn(strategy, withdrawn);
                }
            }
        }
    }

    /**
     * @notice Assess unrealized losses for a strategy
     * @dev Based on Yearn V3: _assess_share_of_unrealised_losses pattern
     * @param strategy The strategy to assess
     * @param currentDebt What vault thinks strategy should have
     * @param assetsNeeded Amount being withdrawn
     * @return Loss share of unrealized losses
     */
    function _assessUnrealisedLoss(address strategy, uint256 currentDebt, uint256 assetsNeeded)
        internal
        view
        returns (uint256)
    {
        uint256 strategyAssets = _getStrategyAssetsSafe(strategy);

        // If no losses, return 0
        if (strategyAssets >= currentDebt || currentDebt == 0) {
            return 0;
        }

        // User takes proportional share of losses
        uint256 numerator = assetsNeeded * strategyAssets;
        uint256 lossShare = assetsNeeded - (numerator / currentDebt);

        // Round up
        if (numerator % currentDebt != 0) {
            lossShare += 1;
        }

        return lossShare;
    }

    /**
     * @notice Auto-allocate idle funds to first strategy in queue
     * @dev Based on Yearn V3: auto_allocate pattern
     */
    function _autoAllocateToStrategy() internal {
        if (defaultQueue.length == 0) return;

        address firstStrategy = defaultQueue[0];
        if (!activeStrategies[firstStrategy]) return;

        uint256 idleBalance = _syncCoinBalance();

        uint256 minIdle = minimumTotalIdle > deploymentThreshold ? minimumTotalIdle : deploymentThreshold;
        if (idleBalance <= minIdle) return;

        uint256 toAllocate = idleBalance - minIdle;
        if (toAllocate == 0) return;

        uint256 currentDebt = strategyDebt[firstStrategy];

        uint256 deposited = _depositIntoStrategyMeasured(firstStrategy, toAllocate);

        uint256 newDebt = currentDebt + deposited;
        strategyDebt[firstStrategy] = newDebt;
        totalDebt += deposited;

        emit DebtUpdated(firstStrategy, currentDebt, newDebt);
        emit AutoAllocated(firstStrategy, deposited);
    }

    // =================================
    // REPORT FUNCTION
    // =================================

    /**
     * @notice Report profit/loss and charge fees
     * @dev Called periodically by keeper
     */
    function report() external nonReentrant onlyKeepers returns (uint256 profit, uint256 loss) {
        bytes memory ret = _delegateAndReturn(_coreModule);
        (profit, loss) = abi.decode(ret, (uint256, uint256));
    }

    /**
     * @notice Perform maintenance without full report
     */
    function tend() external nonReentrant onlyKeepers {
        _delegateAndReturn(_strategiesModule);
    }

    /**
     * @notice Rebalance overweight strategies back to idle, then redeploy by weight.
     * @param minDeviationBps Minimum overweight drift (bps of target) before withdrawing excess.
     */
    function rebalanceStrategies(uint256 minDeviationBps) external nonReentrant onlyKeepers {
        _delegateAndReturn(_strategiesModule);
    }

    // =================================
    // GAUGE CONTROLLER
    // =================================

    /**
     * @notice Burn shares to increase price (called by GaugeController)
     */
    // FIX: I-01 — add nonReentrant and use _delegateAndReturn so modifier epilogue executes
    function burnSharesForPriceIncrease(uint256 shares) external nonReentrant {
        _delegateAndReturn(_coreModule);
    }

    // =================================
    // CAPITAL INJECTION
    // =================================

    /**
     * @notice Inject capital without minting shares (increases PPS)
     * @dev Anyone can call (typically protocol treasury)
     * @custom:security Price change check prevents dramatic manipulation
     */
    // FIX: M-04 — restrict injectCapital to management to prevent price manipulation by untrusted callers
    function injectCapital(uint256 amount) external nonReentrant whenNotPaused onlyManagement {
        _delegateAndReturn(_coreModule);
    }

    // =================================
    // YEARN V3 INSPIRED: QUEUE MANAGEMENT
    // =================================

    /**
     * @notice Set the default withdrawal queue
     * @dev Based on Yearn V3: set_default_queue pattern
     * @param newQueue Ordered array of strategies for withdrawals
     */
    function setDefaultQueue(address[] calldata newQueue) external onlyManagement {
        _delegate(_strategiesModule);
    }

    /**
     * @notice Set whether to force use of default queue
     * @dev Based on Yearn V3: set_use_default_queue pattern
     */
    function setUseDefaultQueue(bool _useDefaultQueue) external onlyManagement {
        _delegate(_strategiesModule);
    }

    /**
     * @notice Set auto-allocate option
     * @dev Based on Yearn V3: set_auto_allocate pattern
     */
    function setAutoAllocate(bool _autoAllocate) external onlyManagement {
        _delegate(_strategiesModule);
    }

    /**
     * @notice Set minimum total idle
     * @dev Based on Yearn V3: set_minimum_total_idle pattern
     */
    function setMinimumTotalIdle(uint256 _minimumTotalIdle) external onlyManagement {
        _delegate(_strategiesModule);
    }

    // =================================
    // YEARN V3 INSPIRED: DEBT PURCHASING
    // =================================

    /**
     * @notice Set debt purchaser address
     */
    function setDebtPurchaser(address _debtPurchaser) external onlyOwner {
        _delegate(_strategiesModule);
    }

    /**
     * @notice Buy bad debt from a strategy
     * @dev Based on Yearn V3: buy_debt pattern
     * @param strategy Strategy to buy debt from
     * @param amount Amount of debt to purchase
     */
    function buyDebt(address strategy, uint256 amount) external nonReentrant onlyDebtPurchaser {
        _delegateAndReturn(_strategiesModule);
    }

    /**
     * @notice Get unrealized losses for a strategy
     * @dev Based on Yearn V3: assess_share_of_unrealised_losses pattern
     */
    function assessUnrealisedLosses(address strategy, uint256 assetsNeeded) external view returns (uint256) {
        uint256 currentDebt = strategyDebt[strategy];
        return _assessUnrealisedLoss(strategy, currentDebt, assetsNeeded);
    }

    // =================================
    // EMERGENCY CONTROLS
    // =================================

    function shutdownVault() external onlyEmergencyAuthorized {
        _delegate(_adminModule);
    }

    // FIX: M-03 — add nonReentrant and use _delegateAndReturn so modifier epilogue executes
    function emergencyWithdrawFromStrategies() external nonReentrant onlyEmergencyAuthorized {
        _delegateAndReturn(_adminModule);
    }

    // FIX: M-03 — add nonReentrant and use _delegateAndReturn so modifier epilogue executes
    function emergencyWithdraw(uint256 amount, address to) external nonReentrant onlyEmergencyAuthorized {
        _delegateAndReturn(_adminModule);
    }

    function setPaused(bool _paused) external onlyOwner {
        _delegate(_adminModule);
    }

    // =================================
    // ADMIN FUNCTIONS
    // =================================

    function setGaugeController(address _gaugeController) external onlyOwner {
        _delegate(_adminModule);
    }

    /// @notice Link or clear the vault CCA strategy used for auction-time deposit gating.
    function setCCALaunchStrategy(address _ccaLaunchStrategy) external onlyOwner {
        _delegate(_adminModule);
    }

    /**
     * @notice Set the burn stream contract (ONE-TIME).
     * @dev This is intentionally one-way to make streamed-burn enforceable.
     *      Once set, vault shares minted to the burn stream cannot be withdrawn — only burned.
     */
    function setBurnStream(address _burnStream) external onlyOwner {
        _delegate(_adminModule);
    }

    function setBurnStreamAuthorizedQueuer(address queuer, bool authorized) external onlyOwner {
        _delegate(_adminModule);
    }

    function setKeeper(address _keeper) external onlyManagement {
        _delegate(_adminModule);
    }

    function setEmergencyAdmin(address _emergencyAdmin) external onlyManagement {
        _delegate(_adminModule);
    }

    function setWhitelistEnabled(bool _enabled) external onlyOwner {
        _delegate(_adminModule);
    }

    function setWhitelist(address _account, bool _status) external onlyOwner {
        _delegate(_adminModule);
    }

    function setWhitelistBatch(address[] calldata _accounts, bool _status) external onlyOwner {
        _delegate(_adminModule);
    }

    // =================================
    // OPERATOR AUTHORIZATION (EXECUTION WALLETS)
    // =================================

    /**
     * @notice Get operator permissions for the current epoch
     */
    function operatorPerms(address exec) public view returns (uint256) {
        return _operatorPerms[operatorEpoch][exec];
    }

    /**
     * @notice Set operator permissions for an execution wallet (current epoch)
     * @dev Setting perms to 0 revokes the operator
     */
    function setOperatorPerms(address exec, uint256 perms) external onlyOwner {
        if (exec == address(0)) revert ZeroAddress();
        _operatorPerms[operatorEpoch][exec] = perms;
        emit OperatorPermsSet(operatorEpoch, exec, perms);
    }

    /**
     * @notice Permit-based operator grant (EIP-712)
     * @dev Signature MUST be produced by the current `owner()` (canonical identity).
     *      The domain binds `chainId` + `verifyingContract` (this vault).
     */
    function permitOperator(address exec, uint256 perms, uint256 deadline, bytes calldata sig) external {
        if (exec == address(0)) revert ZeroAddress();
        if (block.timestamp > deadline) revert OperatorPermitExpired(deadline);

        uint256 nonce = operatorNonce;
        bytes32 structHash = keccak256(abi.encode(_PERMIT_OPERATOR_TYPEHASH, exec, perms, nonce, deadline));
        bytes32 digest = _hashTypedDataV4(structHash);

        if (!SignatureChecker.isValidSignatureNow(owner(), digest, sig)) revert InvalidOperatorSignature();

        operatorNonce = nonce + 1;
        _operatorPerms[operatorEpoch][exec] = perms;

        emit OperatorPermitted(operatorEpoch, exec, perms, nonce, deadline);
    }

    /**
     * @notice Check whether an execution wallet is authorized for a specific permission
     * @dev The owner is always authorized.
     */
    function isAuthorizedOperator(address exec, uint256 perm) public view returns (bool) {
        if (exec == owner()) return true;
        return (_operatorPerms[operatorEpoch][exec] & perm) != 0;
    }

    /**
     * @dev Bump `operatorEpoch` on ownership transfer to invalidate all prior operator grants.
     *      Skip bump on the constructor's initial owner set (oldOwner == 0).
     */
    function _transferOwnership(address newOwner) internal override {
        address oldOwner = owner();
        super._transferOwnership(newOwner);

        // Any pending rescue is invalid after an ownership change.
        if (pendingRescueOwner != address(0)) {
            pendingRescueOwner = address(0);
            rescueUnlockTime = 0;
            emit RescueCancelled(oldOwner);
        }

        if (pendingRiskKind != 0) {
            uint8 kind = pendingRiskKind;
            pendingRiskKind = 0;
            pendingRiskTarget = address(0);
            pendingRiskValue = 0;
            pendingRiskUnlockTime = 0;
            emit RiskConfigCancelled(kind);
        }

        if (oldOwner != address(0) && newOwner != oldOwner) {
            unchecked {
                operatorEpoch++;
            }
            emit OperatorEpochBumped(operatorEpoch);
        }
    }

    // =================================
    // PROTOCOL-ASSISTED OWNERSHIP RESCUE
    // =================================

    /**
     * @notice Configure the protocol rescue authority (typically a multisig). Owner may opt out by setting to 0.
     * @dev Configuration changes are blocked while a rescue is pending; cancel first.
     */
    function setProtocolRescue(address rescue) external onlyOwner {
        _delegate(_adminModule);
    }

    /**
     * @notice Set the rescue delay (time between initiate/finalize).
     * @dev Configuration changes are blocked while a rescue is pending; cancel first.
     */
    function setRescueDelay(uint64 delay) external onlyOwner {
        _delegate(_adminModule);
    }

    /**
     * @notice Initiate a timelocked ownership rescue to `newOwner`.
     * @dev Only callable by `protocolRescue`. The current owner can cancel before finalization.
     */
    function initiateOwnershipRescue(address newOwner) external onlyProtocolRescue {
        _delegate(_adminModule);
    }

    /**
     * @notice Cancel a pending ownership rescue.
     */
    function cancelOwnershipRescue() external onlyOwner {
        _delegate(_adminModule);
    }

    /**
     * @notice Finalize a pending ownership rescue after the timelock.
     */
    function finalizeOwnershipRescue() external onlyProtocolRescue {
        _delegate(_adminModule);
    }

    /// @dev When `riskConfigDelay > 0`, use `scheduleSetPerformanceFee` + `executePendingRiskConfig`.
    function setPerformanceFee(uint16 _performanceFee) external onlyManagement {
        _delegate(_adminModule);
    }

    function scheduleSetPerformanceFee(uint16 _performanceFee) external onlyManagement {
        _delegate(_adminModule);
    }

    function scheduleSetManagementFee(uint16 _managementFee) external onlyManagement {
        _delegate(_adminModule);
    }

    function scheduleSetStrategyMaxAssets(address strategy, uint256 cap) external onlyManagement {
        _delegate(_adminModule);
    }

    function scheduleSetManagementFeeRecipient(address recipient) external onlyManagement {
        _delegate(_adminModule);
    }

    function executePendingRiskConfig() external onlyManagement {
        _delegate(_adminModule);
    }

    function cancelPendingRiskConfig() external onlyManagement {
        _delegate(_adminModule);
    }

    function setRiskConfigDelay(uint64 delay) external onlyOwner {
        _delegate(_adminModule);
    }

    function setManagementFeeRecipient(address recipient) external onlyManagement {
        _delegate(_adminModule);
    }

    function setValuationMissThreshold(uint8 threshold) external onlyManagement {
        _delegate(_adminModule);
    }

    function setPerformanceFeeRecipient(address _performanceFeeRecipient) external onlyManagement {
        _delegate(_adminModule);
    }

    function setProfitMaxUnlockTime(uint256 _profitMaxUnlockTime) external onlyManagement {
        _delegate(_adminModule);
    }

    function setPendingManagement(address _management) external onlyManagement {
        _delegate(_adminModule);
    }

    function acceptManagement() external {
        _delegate(_adminModule);
    }

    function setDeploymentParams(uint256 _threshold, uint256 _interval) external onlyOwner {
        _delegate(_adminModule);
    }

    function setMaxTotalSupply(uint256 _maxTotalSupply) external onlyOwner {
        _delegate(_adminModule);
    }

    /**
     * @notice Set the governance-enforced asset cap for a strategy.
     * @dev 0 == uncapped. Non-zero clamps strategy contribution to `totalAssets()`.
     *      See docs/runbooks/strategy-onboarding-checklist.md.
     */
    function setStrategyMaxAssets(address strategy, uint256 cap) external onlyManagement {
        _delegate(_adminModule);
    }

    /**
     * @notice Atomically replace a strategy (withdraw old, register new).
     */
    function migrateStrategy(address oldStrategy, address newStrategy, uint256 weight, bool addToQueue)
        external
        nonReentrant
        onlyManagement
    {
        _delegate(_strategiesModule);
    }

    /**
     * @notice Configure flash loan protection parameters
     * @dev MEV/flash loan exploit mitigation
     * @param _withdrawDelayBlocks Blocks to wait after deposit before withdraw allowed
     * @param _largeWithdrawalThreshold Assets above which queue is required
     * @param _largeWithdrawalDelayBlocks Extra blocks for large withdrawal queue
     */
    function setFlashLoanProtection(
        uint256 _withdrawDelayBlocks,
        uint256 _largeWithdrawalThreshold,
        uint256 _largeWithdrawalDelayBlocks
    ) external onlyOwner {
        _delegate(_adminModule);
    }

    /**
     * @notice Configure the trusted PPS circuit-breaker for deposit/mint.
     * @dev Deposits/mints are blocked when live PPS deviates too far from `trustedPpsCheckpoint`.
     */
    function setTrustedPpsDeviationBps(uint256) external onlyOwner {
        _delegate(_adminModule);
    }

    function syncBalances() external onlyManagement {
        _delegate(_adminModule);
    }

    function rescueETH() external onlyOwner {
        _delegate(_adminModule);
    }

    function rescueToken(address token, uint256 amount, address to) external onlyOwner {
        _delegate(_adminModule);
    }

    /**
     * @dev Track the latest share acquisition block for delay enforcement.
     *      - Mint: receiver gets current block.
     *      - Transfer: does NOT update cooldown state (prevents griefing via dust transfers).
     *      - Burn: no update needed.
     */
    function _update(address from, address to, uint256 value) internal override {
        // Enforce the withdrawal cooldown on share transfers out.
        //
        // Without this, removing transfer-based cooldown inheritance would allow
        // `deposit -> transfer -> withdraw` to bypass the delay across addresses.
        if (withdrawDelayBlocks != 0 && from != address(0) && to != address(0) && from != address(this)) {
            uint256 requiredBlock = lastDepositBlock[from] + withdrawDelayBlocks;
            if (block.number < requiredBlock) {
                revert TransferTooSoon(block.number, requiredBlock);
            }
        }

        super._update(from, to, value);

        if (to == address(0)) {
            return;
        }

        if (from == address(0)) {
            // Do not track internal mints (eg profit locking shares minted to this vault),
            // otherwise vault-internal transfers (eg queued withdrawal cancellations) could be blocked.
            if (to != address(this)) {
                lastDepositBlock[to] = block.number;
            }
            return;
        }
    }

    // =================================
    // ERC-2612 PERMIT (vault shares)
    // =================================

    /// @inheritdoc IERC20Permit
    function permit(address owner_, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        public
    {
        if (block.timestamp > deadline) revert PermitExpired(deadline);

        uint256 nonce = sharePermitNonces[owner_]++;
        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, owner_, spender, value, nonce, deadline));
        bytes32 hash = _hashTypedDataV4(structHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        if (!SignatureChecker.isValidSignatureNow(owner_, hash, signature)) revert InvalidPermitSignature();

        _approve(owner_, spender, value);
    }

    /// @inheritdoc IERC20Permit
    function nonces(address owner_) public view returns (uint256) {
        return sharePermitNonces[owner_];
    }

    /// @inheritdoc IERC20Permit
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // =================================
    // VIEW FUNCTIONS
    // =================================

    function strategyCount() external view returns (uint256) {
        return strategyList.length;
    }

    function liquiditySnapshot() external view returns (CreatorOVaultLiquidityLib.LiquiditySnapshot memory) {
        return CreatorOVaultLiquidityLib.snapshot(address(this));
    }

    /**
     * @notice Get price per share (1e18 scale)
     */
    function pricePerShare() public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 1e18;
        // FIX: L-03 — align with ERC-4626 virtual shares offset (_decimalsOffset() = 3)
        return ((totalAssets() + 1) * 1e18) / (supply + 10 ** _decimalsOffset());
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    /**
     * @notice Decimals offset for virtual shares (inflation attack protection)
     * @dev OpenZeppelin ERC4626 uses this to add "virtual" shares/assets
     *      An offset of 3 means 10^3 = 1000 virtual shares exist
     *      This makes the first-depositor inflation attack economically infeasible
     *
     * @custom:security CRITICAL for yTUSD-style attack prevention
     *      With offset of 3:
     *      - Attacker needs to donate 1000 tokens per 1 token stolen
     *      - Makes dust-balance manipulation unprofitable
     *
     * Reference: https://blog.openzeppelin.com/a-novel-defense-against-erc4626-inflation-attacks
     */
    function _decimalsOffset() internal pure override returns (uint8) {
        return 3; // 10^3 = 1000 virtual shares
    }
}
