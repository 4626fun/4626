// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title VaultGaugeVoting
 * @author 0xakita.eth
 * @notice ve(3,3) style gauge voting for directing jackpot probability to creator vaults
 *
 * @dev VOTING MECHANISM:
 *      ve4626 holders vote to direct jackpot probability to specific creator vaults.
 *      This is similar to veCRV/veVELO, but we direct PROBABILITY instead of emissions.
 *
 * @dev FIXED BUDGET:
 *      Total system-wide gauge budget is locked at 69,420 PPM forever.
 *      Votes allocate this budget proportionally (with 35,000 PPM per-vault cap).
 *      This feeds directly into CreatorLotteryManager._applyBoost as flat additive PPM.
 *
 * @dev EPOCH SYSTEM:
 *      Weekly epochs (7 days), starting Thursday 00:00 UTC.
 *      Votes can be changed anytime; weights are tallied live.
 */

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

interface Ive4626 {
    function getVotingPower(address user) external view returns (uint256);
    function getTotalVotingPower() external view returns (uint256);
    function hasActiveLock(address user) external view returns (bool);
    function getRemainingLockTime(address user) external view returns (uint256);
}

interface ICreatorRegistry {
    function isRegisteredVault(address vault) external view returns (bool);
}

/**
 * @title IVaultGaugeVoting
 * @notice Interface for VaultGaugeVoting
 */
interface IVaultGaugeVoting {
    // User functions
    function vote(address[] calldata vaults, uint256[] calldata weights) external;
    function resetVotes() external;

    // View functions
    function getVaultWeight(address vault) external view returns (uint256);
    function getTotalWeight() external view returns (uint256);
    function getVaultWeightBps(address vault) external view returns (uint256);
    function getUserVotes(address user) external view returns (address[] memory vaults, uint256[] memory weights);

    // Epoch management
    function checkpoint() external;
    function currentEpoch() external view returns (uint256);
    function epochStartTime(uint256 epoch) external view returns (uint256);

    // Events
    event Voted(address indexed user, address indexed vault, uint256 weight, uint256 epoch);
    event VotesReset(address indexed user, uint256 epoch);
    event EpochCheckpointed(uint256 indexed epoch, uint256 totalWeight);
    event VaultWhitelisted(address indexed vault, bool status);
}

contract VaultGaugeVoting is IVaultGaugeVoting, Ownable, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.AddressSet;

    // ================================
    // CONSTANTS
    // ================================

    uint256 public constant EPOCH_DURATION = 7 days;
    uint256 public constant PPM_PRECISION = 1_000_000;

    /// @notice FIXED total gauge probability budget (PPM)
    uint256 public constant TOTAL_GAUGE_PROBABILITY_PPM = 69_420;

    /// @notice Max any single vault can receive (PPM).
    uint256 public constant MAX_PER_VAULT_PPM = 35_000;

    /// @notice Maximum number of vaults a user can vote for at once
    uint256 public constant MAX_VAULTS_PER_VOTE = 10;

    /// @notice Genesis epoch start (first Thursday 00:00 UTC after deployment)
    uint256 public immutable genesisEpochStart;

    // ================================
    // STATE
    // ================================

    /// @notice ve4626 token for voting power
    Ive4626 public immutable ve4626;

    /// @notice Optional registry for auto-whitelisting vaults
    ICreatorRegistry public registry;

    /// @notice Whether to use registry for whitelist
    bool public useRegistryWhitelist;

    /// @notice Manually whitelisted vaults
    mapping(address => bool) public isWhitelistedVault;

    /// @notice Set of all whitelisted vaults
    EnumerableSet.AddressSet private _whitelistedVaults;

    // ================================
    // VOTE STORAGE (PER-EPOCH)
    // ================================

    /// @notice Vault votes per epoch: epoch => vault => total votes (ve4626-weighted)
    mapping(uint256 => mapping(address => uint256)) private _epochVaultVotes;

    /// @notice Total votes per epoch: epoch => total votes
    mapping(uint256 => uint256) private _epochTotalVotes;

    /// @notice User votes per epoch: epoch => user => vault => votes
    mapping(uint256 => mapping(address => mapping(address => uint256))) private _epochUserVaultVotes;

    /// @notice Set of vaults a user voted for in a given epoch: epoch => user => set(vault)
    mapping(uint256 => mapping(address => EnumerableSet.AddressSet)) private _epochUserVotedVaults;

    /// @notice Last epoch that emitted a checkpoint event (for UI/debug)
    uint256 public lastCheckpointedEpoch;

    /// @dev Tracks which epochs have emitted `EpochCheckpointed` (idempotency guard).
    mapping(uint256 => bool) private _epochCheckpointed;

    // ================================
    // ERRORS
    // ================================

    error ZeroAddress();
    error NoVotingPower();
    error VaultNotWhitelisted(address vault);
    error TooManyVaults();
    error ArrayLengthMismatch();
    error ZeroWeight();
    error EpochNotEnded();
    error LockExpiresBeforeEpochEnd();

    // ================================
    // CONSTRUCTOR
    // ================================

    /**
     * @notice Constructor
     * @param _ve4626 ve4626 token address
     * @param owner_ Owner address
     */
    constructor(address _ve4626, address owner_) Ownable(owner_) {
        if (_ve4626 == address(0)) revert ZeroAddress();
        ve4626 = Ive4626(_ve4626);

        // Set genesis to next Thursday 00:00 UTC
        uint256 currentTime = block.timestamp;
        uint256 startOfToday = currentTime - (currentTime % 1 days);
        uint256 dayOfWeek = ((currentTime / 1 days) + 4) % 7;
        uint256 daysUntilThursday = (7 + 4 - dayOfWeek) % 7;
        if (daysUntilThursday < 1) daysUntilThursday = 7;
        genesisEpochStart = startOfToday + (daysUntilThursday * 1 days);
    }

    // ================================
    // VOTING FUNCTIONS
    // ================================

    function vote(address[] calldata vaults, uint256[] calldata weights) external override nonReentrant {
        if (vaults.length != weights.length) revert ArrayLengthMismatch();
        if (vaults.length > MAX_VAULTS_PER_VOTE) revert TooManyVaults();

        uint256 userPower = ve4626.getVotingPower(msg.sender);
        if (userPower == 0) revert NoVotingPower();
        if (ve4626.getRemainingLockTime(msg.sender) < timeUntilNextEpoch()) revert LockExpiresBeforeEpochEnd();

        uint256 epoch = currentEpoch();
        _clearUserVotes(epoch, msg.sender);

        uint256 totalWeight = 0;
        for (uint256 i = 0; i < weights.length; i++) {
            if (weights[i] == 0) revert ZeroWeight();
            totalWeight += weights[i];
        }

        // Aggregate duplicates
        address[] memory uniqueVaults = new address[](vaults.length);
        uint256[] memory aggregatedWeights = new uint256[](vaults.length);
        uint256 uniqueCount = 0;

        for (uint256 i = 0; i < vaults.length; i++) {
            address vault = vaults[i];
            uint256 existingIndex = type(uint256).max;
            for (uint256 j = 0; j < uniqueCount; j++) {
                if (uniqueVaults[j] == vault) {
                    existingIndex = j;
                    break;
                }
            }
            if (existingIndex == type(uint256).max) {
                uniqueVaults[uniqueCount] = vault;
                aggregatedWeights[uniqueCount] = weights[i];
                uniqueCount++;
            } else {
                aggregatedWeights[existingIndex] += weights[i];
            }
        }

        for (uint256 i = 0; i < uniqueCount; i++) {
            address vault = uniqueVaults[i];
            if (!_isVaultWhitelisted(vault)) revert VaultNotWhitelisted(vault);

            uint256 normalizedWeight = (userPower * aggregatedWeights[i]) / totalWeight;

            _epochVaultVotes[epoch][vault] += normalizedWeight;
            _epochTotalVotes[epoch] += normalizedWeight;
            _epochUserVaultVotes[epoch][msg.sender][vault] = normalizedWeight;
            _epochUserVotedVaults[epoch][msg.sender].add(vault);

            emit Voted(msg.sender, vault, normalizedWeight, epoch);
        }
    }

    function resetVotes() external override nonReentrant {
        uint256 epoch = currentEpoch();
        _clearUserVotes(epoch, msg.sender);
        emit VotesReset(msg.sender, epoch);
    }

    function _clearUserVotes(uint256 epoch, address user) internal {
        EnumerableSet.AddressSet storage votedVaults = _epochUserVotedVaults[epoch][user];
        uint256 length = votedVaults.length();

        for (uint256 i = length; i > 0; i--) {
            address vault = votedVaults.at(i - 1);
            uint256 weight = _epochUserVaultVotes[epoch][user][vault];

            if (weight > 0) {
                _epochVaultVotes[epoch][vault] -= weight;
                _epochTotalVotes[epoch] -= weight;
                _epochUserVaultVotes[epoch][user][vault] = 0;
            }
            votedVaults.remove(vault);
        }
    }

    // ================================
    // EPOCH & VIEW FUNCTIONS
    // ================================

    function checkpoint() external override {
        uint256 current = currentEpoch();
        if (current == 0) revert EpochNotEnded();

        uint256 epochToCheckpoint = current - 1;
        if (_epochCheckpointed[epochToCheckpoint]) return;

        _epochCheckpointed[epochToCheckpoint] = true;
        lastCheckpointedEpoch = epochToCheckpoint;
        emit EpochCheckpointed(epochToCheckpoint, _epochTotalVotes[epochToCheckpoint]);
    }

    function currentEpoch() public view override returns (uint256) {
        if (block.timestamp < genesisEpochStart) return 0;
        return (block.timestamp - genesisEpochStart) / EPOCH_DURATION;
    }

    function epochStartTime(uint256 epoch) public view override returns (uint256) {
        return genesisEpochStart + (epoch * EPOCH_DURATION);
    }

    function epochEndTime(uint256 epoch) public view returns (uint256) {
        return epochStartTime(epoch) + EPOCH_DURATION;
    }

    function timeUntilNextEpoch() public view returns (uint256) {
        uint256 epoch = currentEpoch();
        uint256 endTime = epochEndTime(epoch);
        return block.timestamp >= endTime ? 0 : endTime - block.timestamp;
    }

    /**
     * @notice Fixed total gauge probability budget in bps (compatibility helper)
     */
    function getTotalGaugeProbabilityBps() public pure returns (uint256) {
        return TOTAL_GAUGE_PROBABILITY_PPM / 100;
    }

    /**
     * @notice Fixed total gauge probability budget (PPM)
     */
    function getTotalGaugeProbabilityPPM() public pure returns (uint256) {
        return TOTAL_GAUGE_PROBABILITY_PPM;
    }

    /**
     * @notice Vault's vote-directed probability boost in PPM (flat additive to lottery)
     * @dev Uses fixed 69,420 PPM budget + per-vault cap
     */
    function getVaultGaugeProbabilityBoostPPM(address vault) external view returns (uint256 boostPPM) {
        if (!_isVaultWhitelisted(vault)) return 0;

        uint256 epoch = currentEpoch();
        uint256 total = _epochTotalVotes[epoch];

        if (total == 0) {
            uint256 n = _whitelistedVaults.length();
            if (n == 0) return 0;
            boostPPM = TOTAL_GAUGE_PROBABILITY_PPM / n;
        } else {
            uint256 v = _epochVaultVotes[epoch][vault];
            if (v == 0) return 0;
            boostPPM = (TOTAL_GAUGE_PROBABILITY_PPM * v) / total;
        }

        if (boostPPM > MAX_PER_VAULT_PPM) {
            boostPPM = MAX_PER_VAULT_PPM;
        }
    }

    function getVaultWeight(address vault) external view override returns (uint256) {
        return _epochVaultVotes[currentEpoch()][vault];
    }

    function getTotalWeight() external view override returns (uint256) {
        return _epochTotalVotes[currentEpoch()];
    }

    function getVaultWeightBps(address vault) external view override returns (uint256) {
        uint256 epoch = currentEpoch();
        uint256 total = _epochTotalVotes[epoch];
        if (total == 0) return 0;
        return (_epochVaultVotes[epoch][vault] * 10_000) / total;
    }

    function getUserVotes(address user)
        external
        view
        override
        returns (address[] memory vaults, uint256[] memory weights)
    {
        uint256 epoch = currentEpoch();
        EnumerableSet.AddressSet storage votedVaults = _epochUserVotedVaults[epoch][user];
        uint256 length = votedVaults.length();

        vaults = new address[](length);
        weights = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            address vault = votedVaults.at(i);
            vaults[i] = vault;
            weights[i] = _epochUserVaultVotes[epoch][user][vault];
        }
    }

    /**
     * @notice Compatibility helper for existing integrators.
     */
    function hasVotedThisEpoch(address user) external view returns (bool) {
        uint256 epoch = currentEpoch();
        return _epochUserVotedVaults[epoch][user].length() > 0;
    }

    function getVaultWeightAtEpoch(uint256 epoch, address vault) external view returns (uint256) {
        return _epochVaultVotes[epoch][vault];
    }

    function getUserVoteWeightAtEpoch(uint256 epoch, address user, address vault) external view returns (uint256) {
        return _epochUserVaultVotes[epoch][user][vault];
    }

    function getWhitelistedVaults() external view returns (address[] memory) {
        return _whitelistedVaults.values();
    }

    function whitelistedVaultCount() external view returns (uint256) {
        return _whitelistedVaults.length();
    }

    function _isVaultWhitelisted(address vault) internal view returns (bool) {
        if (!isWhitelistedVault[vault]) return false;
        if (useRegistryWhitelist) {
            try registry.isRegisteredVault(vault) returns (bool registered) {
                return registered;
            } catch {
                return false;
            }
        }
        return true;
    }

    function canReceiveVotes(address vault) external view returns (bool) {
        return _isVaultWhitelisted(vault);
    }

    function setVaultWhitelist(address vault, bool status) external onlyOwner {
        if (vault == address(0)) revert ZeroAddress();
        isWhitelistedVault[vault] = status;
        status ? _whitelistedVaults.add(vault) : _whitelistedVaults.remove(vault);
        emit VaultWhitelisted(vault, status);
    }

    function batchSetVaultWhitelist(address[] calldata vaults, bool[] calldata statuses) external onlyOwner {
        if (vaults.length != statuses.length) revert ArrayLengthMismatch();
        for (uint256 i = 0; i < vaults.length; i++) {
            if (vaults[i] == address(0)) revert ZeroAddress();
            isWhitelistedVault[vaults[i]] = statuses[i];
            statuses[i] ? _whitelistedVaults.add(vaults[i]) : _whitelistedVaults.remove(vaults[i]);
            emit VaultWhitelisted(vaults[i], statuses[i]);
        }
    }

    function setRegistry(address _registry) external onlyOwner {
        registry = ICreatorRegistry(_registry);
    }

    function setUseRegistryWhitelist(bool enabled) external onlyOwner {
        useRegistryWhitelist = enabled;
    }

    // ================================
    // EMERGENCY
    // ================================

    function emergencyResetAllVotes() external onlyOwner {
        uint256 epoch = currentEpoch();
        uint256 vaultCount = _whitelistedVaults.length();
        for (uint256 i = 0; i < vaultCount; i++) {
            address vault = _whitelistedVaults.at(i);
            _epochVaultVotes[epoch][vault] = 0;
        }
        _epochTotalVotes[epoch] = 0;
    }
}

