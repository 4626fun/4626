// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Storage layout shared by CreatorOVault delegatecall modules.
/// @dev MUST match CreatorOVault's storage layout exactly (including OZ bases).
/// FIX: I-02 — Layout integrity is verified at deploy time via `setModulesOnce()` which checks
/// `moduleStorageVersion()`. Upgrades MUST bump MODULE_STORAGE_VERSION if layout changes.
/// Storage-hardening roadmap: `docs/research/ovault-storage-namespacing-rfc.md`.
abstract contract CreatorOVaultModuleStorage {
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

    // ---------------------------------------------------------------------
    // OpenZeppelin ERC20 storage (v5.4.0)
    // ---------------------------------------------------------------------
    mapping(address => uint256) internal _balances;
    mapping(address => mapping(address => uint256)) internal _allowances;
    uint256 internal _totalSupply;
    string internal _name;
    string internal _symbol;

    // ---------------------------------------------------------------------
    // OpenZeppelin Ownable storage (v5.4.0)
    // ---------------------------------------------------------------------
    address internal _owner;

    // ---------------------------------------------------------------------
    // OpenZeppelin ReentrancyGuard storage (v5.1.0)
    // ---------------------------------------------------------------------
    uint256 internal _status;

    // ---------------------------------------------------------------------
    // OpenZeppelin EIP712 storage (v5.4.0)
    // NOTE: most fields are immutables; only fallback strings live in storage.
    // ---------------------------------------------------------------------
    string internal _nameFallback;
    string internal _versionFallback;

    // ---------------------------------------------------------------------
    // CreatorOVault custom storage
    // ---------------------------------------------------------------------

    // Current Creator Coin balance held directly by vault
    uint256 internal coinBalance;

    // Strategy management
    mapping(address => bool) internal activeStrategies;
    mapping(address => uint256) internal strategyWeights;
    address[] internal strategyList;
    uint256 internal totalStrategyWeight;

    // Access control
    address internal management;
    address internal pendingManagement;
    address internal keeper;
    address internal emergencyAdmin;
    address internal gaugeController;
    address internal burnStream;

    // Performance fees
    uint16 internal performanceFee;
    address internal performanceFeeRecipient;

    // Profit unlocking
    uint256 internal profitUnlockingRate;
    uint96 internal fullProfitUnlockDate;
    uint32 internal profitMaxUnlockTime;
    uint256 internal totalLockedShares;
    uint256 internal totalQueuedWithdrawalShares;
    uint96 internal lastProfitUnlockUpdate;

    // Reporting
    uint96 internal lastReport;
    uint256 internal totalAssetsAtLastReport;
    uint256 internal trustedPpsCheckpoint;
    uint256 internal trustedPpsMaxDeviationBps;
    uint256 internal totalSharesBurned;

    // Controls
    bool internal isShutdown;
    bool internal paused;
    bool internal whitelistEnabled;
    mapping(address => bool) internal whitelist;

    // Operator authorization
    uint256 internal operatorEpoch;
    mapping(uint256 => mapping(address => uint256)) internal _operatorPerms;
    uint256 internal operatorNonce;

    // Protocol-assisted ownership rescue
    address internal protocolRescue;
    uint64 internal rescueDelay;
    address internal pendingRescueOwner;
    uint64 internal rescueUnlockTime;

    // Supply + deployment params
    uint256 internal maxTotalSupply;
    uint256 internal deploymentThreshold;
    uint256 internal minDeploymentInterval;
    uint256 internal lastDeployment;

    // Flash loan / MEV protection
    mapping(address => uint256) internal lastDepositBlock;
    uint256 internal withdrawDelayBlocks;
    uint256 internal largeWithdrawalThreshold;
    uint256 internal largeWithdrawalDelayBlocks;

    struct QueuedWithdrawal {
        uint256 shares;
        uint256 unlockBlock;
        address receiver;
    }
    mapping(address => QueuedWithdrawal) internal queuedWithdrawals;

    // Yearn V3 inspired features
    address[] internal defaultQueue;
    bool internal useDefaultQueue;
    bool internal autoAllocate;
    uint256 internal minimumTotalIdle;
    mapping(address => uint256) internal strategyDebt;
    uint256 internal totalDebt;
    address internal debtPurchaser;

    // Bytecode-size module dispatch
    address internal _coreModule;
    address internal _strategiesModule;
    address internal _adminModule;

    // ---------------------------------------------------------------------
    // Governance-enforced per-strategy asset cap (appended; preserves layout)
    // ---------------------------------------------------------------------
    // 0 == uncapped. Non-zero values clamp `_getStrategyAssetsSafe()` so a
    // misreporting / oracle-poisoned / donation-exposed strategy cannot inflate
    // `totalAssets()` beyond the value governance has explicitly approved.
    mapping(address => uint256) internal strategyMaxAssets;

    // ---------------------------------------------------------------------
    // v2: governance timelock, TVL fee, valuation auto-disable (appended)
    // ---------------------------------------------------------------------
    uint16 internal managementFee;
    address internal managementFeeRecipient;

    /// @notice Delay before scheduled risk changes execute. 0 = instant (legacy behavior).
    uint64 internal riskConfigDelay;

    /// @notice Single-flight pending risk update (Morpho-style governance latency).
    uint8 internal pendingRiskKind;
    address internal pendingRiskTarget;
    uint256 internal pendingRiskValue;
    uint64 internal pendingRiskUnlockTime;

    /// @notice Consecutive unhealthy valuation reports before auto-disable. 0 = disabled.
    uint8 internal valuationMissThreshold;
    mapping(address => uint8) internal strategyValuationMisses;
    mapping(address => uint256) internal sharePermitNonces;

    // ---------------------------------------------------------------------
    // v3: impairment side-pocket state (appended)
    // ---------------------------------------------------------------------
    VaultMode internal vaultMode;
    uint256 internal activeImpairmentEpoch;
    uint256 internal nextImpairmentEpochId;
    uint64 internal impairmentChallengeWindow;
    mapping(uint256 => ImpairmentEpoch) internal impairmentEpochs;
    mapping(address => bool) internal strategyImpaired;
    mapping(uint256 => mapping(address => uint256)) internal impairmentAmountClaimed;
    mapping(uint256 => mapping(address => bool)) internal impairmentClaimMinted;
    mapping(uint256 => uint64) internal impairmentRootUnlockTime;
    mapping(uint256 => bool) internal impairmentRootChallenged;
    address internal impairmentGuardian;
    address internal impairmentClaims;
    address internal impairmentRecoveryEscrow;

    // ---------------------------------------------------------------------
    // CCA linkage (appended; preserves prior storage ordering)
    // ---------------------------------------------------------------------
    /// @notice Optional CCA launch strategy used to enforce auction-time deposit pauses.
    address internal ccaLaunchStrategy;
}

