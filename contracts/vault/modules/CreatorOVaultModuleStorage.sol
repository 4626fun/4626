// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Storage layout shared by CreatorOVault delegatecall modules.
/// @dev MUST match CreatorOVault's storage layout exactly (including OZ bases).
abstract contract CreatorOVaultModuleStorage {
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
}

