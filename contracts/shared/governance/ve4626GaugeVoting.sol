// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ve4626GaugeVoting
 * @author 0xakita.eth
 * @notice ve(3,3) style gauge voting for directing jackpot probability to vaults (creators, agents, future ecosystems)
 *
 * @dev VOTING MECHANISM:
 *      ve4626 holders vote to direct jackpot probability to specific creator vaults.
 *      This is similar to veCRV/veVELO, but we direct PROBABILITY instead of emissions.
 *
 * @dev FIXED BUDGET:
 *      Total system-wide gauge budget is locked at 69,420 PPM forever.
 *      Votes allocate this budget proportionally (with 35,000 PPM per-vault cap).
 *      This feeds directly into LotteryManager4626._applyBoost as flat additive PPM.
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
    // FIX: G-03 — needed to compute projected power at epoch end
    function votingPowerAt(address user, uint256 timestamp) external view returns (uint256);
    // FIX: G-09 — needed to enforce minimum lock age
    function getLock(address user) external view returns (Ive4626Lock memory);
}

interface Ive4626ve33 {
    function balanceOf(address user) external view returns (uint256);
}

/// @dev Minimal surface of ve4626Utility for decay-safe voting power.
interface Ive4626Utility {
    function sync(address user) external returns (uint256 burnedVe33, uint256 burnedVeLottery);
    function effectiveVe33Of(address user) external view returns (uint256);
    function ve33() external view returns (address);
}

// FIX: G-09 — lock struct for getLock return
struct Ive4626Lock {
    uint256 amount;
    uint256 end;
    uint256 start;
    address lockedToken;
    uint256 underlyingValue;
}

interface IRegistry4626VaultWhitelist {
    function isRegisteredVault(address vault) external view returns (bool);
}

interface IGaugeSurfaceRegistryForVoting {
    function canReceiveVotes(address surface) external view returns (bool);
    function canReceiveBribes(address surface) external view returns (bool);
    function canReceiveStreams(address surface) external view returns (bool);
    function allSurfaces() external view returns (address[] memory);
}

/**
 * @title Ive4626GaugeVoting
 * @notice Interface for ve4626GaugeVoting
 */
interface Ive4626GaugeVoting {
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

contract ve4626GaugeVoting is Ive4626GaugeVoting, Ownable, ReentrancyGuard {
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

    /// @notice Freeze before epoch end: no new votes in the last window.
    uint256 public constant VOTE_FREEZE_WINDOW = 1 hours;

    /// @notice Genesis epoch start (first Thursday 00:00 UTC after deployment)
    uint256 public immutable genesisEpochStart;

    // ================================
    // STATE
    // ================================

    /// @notice ve■4626 commitment used for lock age and projected-power caps.
    Ive4626 public immutable ve4626;

    /// @notice Raw ve33 token pointer retained for explorers/integrators; voting uses utility.
    Ive4626ve33 public ve33Token;

    /// @notice Preferred: ve4626Utility — `vote()` syncs then uses post-decay effective ve33.
    Ive4626Utility public utility;

    /// @notice Optional registry for auto-whitelisting vaults
    IRegistry4626VaultWhitelist public registry;

    /// @notice Whether to use registry for whitelist
    bool public useRegistryWhitelist;

    /// @notice Optional Hermes-style surface registry (overrides local whitelist when enabled).
    IGaugeSurfaceRegistryForVoting public surfaceRegistry;

    /// @notice When true and `surfaceRegistry` is set, `canReceiveVotes` uses the surface registry.
    bool public useSurfaceRegistry;

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

    /// @notice All vaults that received any vote weight this epoch (for emergency reset; surface-safe).
    mapping(uint256 => EnumerableSet.AddressSet) private _epochVotedVaults;

    /// @notice Last epoch that emitted a checkpoint event (for UI/debug)
    uint256 public lastCheckpointedEpoch;

    /// @dev Tracks which epochs have emitted `EpochCheckpointed` (idempotency guard).
    mapping(uint256 => bool) private _epochCheckpointed;

    // FIX: G-06 — generation counter so stale per-user records are ignored after emergency reset
    mapping(uint256 => uint256) private _epochResetGeneration;
    mapping(uint256 => mapping(address => uint256)) private _userVoteGeneration;

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
    // FIX: G-16 — error for pre-genesis voting
    error VotingNotStarted();
    // FIX: G-09 — error for lock too young
    error LockTooRecent();
    // FIX: G-08 — error for zero normalized weight after rounding
    error NormalizedWeightZero();
    // Power-split / epoch freeze
    error VoteFreezeWindow();
    error UtilityNotConfigured();

    event Ve33TokenUpdated(address indexed token);
    event UtilityUpdated(address indexed utility);

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

    function setve33Token(address token) external onlyOwner {
        ve33Token = Ive4626ve33(token);
        emit Ve33TokenUpdated(token);
    }

    /// @notice Wire ve4626Utility so votes use decay-safe power (sync + effective ve33).
    function setUtility(address utility_) external onlyOwner {
        utility = Ive4626Utility(utility_);
        emit UtilityUpdated(utility_);
        // Keep ve33Token pointer aligned when utility is set (for explorers / integrators).
        if (utility_ != address(0)) {
            ve33Token = Ive4626ve33(Ive4626Utility(utility_).ve33());
            emit Ve33TokenUpdated(address(ve33Token));
        }
    }

    function vote(address[] calldata vaults, uint256[] calldata weights) external override nonReentrant {
        if (vaults.length != weights.length) revert ArrayLengthMismatch();
        if (vaults.length > MAX_VAULTS_PER_VOTE) revert TooManyVaults();
        // FIX: G-16 — block voting before genesis epoch
        if (block.timestamp < genesisEpochStart) revert VotingNotStarted();

        uint256 epoch = currentEpoch();
        uint256 epochEnd = epochEndTime(epoch);
        // Epoch freeze: no vote changes in the last hour of the epoch
        if (epochEnd > block.timestamp && epochEnd - block.timestamp <= VOTE_FREEZE_WINDOW) {
            revert VoteFreezeWindow();
        }

        // FIX: G-09 — require lock to be at least 1 epoch old to prevent same-block lock→vote
        Ive4626Lock memory userLock = ve4626.getLock(msg.sender);
        if (userLock.start + EPOCH_DURATION > block.timestamp) revert LockTooRecent();

        // Claimed utility semantics are mandatory (a user cannot vote with unclaimed
        // capacity), and utility power cannot exceed projected ve power at epoch end.
        uint256 projectedPower = ve4626.votingPowerAt(msg.sender, epochEnd);
        if (address(utility) == address(0)) revert UtilityNotConfigured();
        utility.sync(msg.sender);
        uint256 userPower = utility.effectiveVe33Of(msg.sender);
        if (userPower > projectedPower) userPower = projectedPower;
        if (userPower == 0) revert NoVotingPower();
        if (ve4626.getRemainingLockTime(msg.sender) < timeUntilNextEpoch()) revert LockExpiresBeforeEpochEnd();

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

        // FIX: G-08 — track sum of normalized weights for dust allocation
        uint256 totalNormalized = 0;
        for (uint256 i = 0; i < uniqueCount; i++) {
            address vault = uniqueVaults[i];
            if (!_canReceiveVotes(vault)) revert VaultNotWhitelisted(vault);

            uint256 normalizedWeight = (userPower * aggregatedWeights[i]) / totalWeight;
            // FIX: G-08 — revert if rounding floors weight to zero
            if (normalizedWeight == 0) revert NormalizedWeightZero();

            _epochVaultVotes[epoch][vault] += normalizedWeight;
            _epochTotalVotes[epoch] += normalizedWeight;
            _epochUserVaultVotes[epoch][msg.sender][vault] = normalizedWeight;
            _epochUserVotedVaults[epoch][msg.sender].add(vault);
            _epochVotedVaults[epoch].add(vault);
            totalNormalized += normalizedWeight;

            emit Voted(msg.sender, vault, normalizedWeight, epoch);
        }

        // FIX: G-08 — allocate rounding dust to first vault
        uint256 dust = userPower - totalNormalized;
        if (dust > 0 && uniqueCount > 0) {
            address firstVault = uniqueVaults[0];
            _epochVaultVotes[epoch][firstVault] += dust;
            _epochTotalVotes[epoch] += dust;
            _epochUserVaultVotes[epoch][msg.sender][firstVault] += dust;
        }

        // FIX: G-06 — stamp user's vote generation to match current epoch generation
        _userVoteGeneration[epoch][msg.sender] = _epochResetGeneration[epoch];
    }

    function resetVotes() external override nonReentrant {
        uint256 epoch = currentEpoch();
        _clearUserVotes(epoch, msg.sender);
        emit VotesReset(msg.sender, epoch);
    }

    function _clearUserVotes(uint256 epoch, address user) internal {
        // FIX: G-06 — if epoch was reset after user voted, skip subtraction from aggregates
        // (aggregates were already zeroed by emergency reset)
        bool staleGeneration = _userVoteGeneration[epoch][user] != _epochResetGeneration[epoch];

        EnumerableSet.AddressSet storage votedVaults = _epochUserVotedVaults[epoch][user];
        uint256 length = votedVaults.length();

        for (uint256 i = length; i > 0; i--) {
            address vault = votedVaults.at(i - 1);
            uint256 weight = _epochUserVaultVotes[epoch][user][vault];

            if (weight > 0 && !staleGeneration) {
                _epochVaultVotes[epoch][vault] -= weight;
                _epochTotalVotes[epoch] -= weight;
            }
            _epochUserVaultVotes[epoch][user][vault] = 0;
            votedVaults.remove(vault);
        }
    }

    // ================================
    // EPOCH & VIEW FUNCTIONS
    // ================================

    // FIX: G-23 — checkpoint all skipped epochs from lastCheckpointedEpoch+1 to current-1
    function checkpoint() external override {
        uint256 current = currentEpoch();
        if (current == 0) revert EpochNotEnded();

        uint256 start = lastCheckpointedEpoch + 1;
        uint256 end = current - 1;
        // Cap iterations to avoid gas exhaustion
        uint256 maxIterations = 52;
        if (end > start + maxIterations) {
            start = end - maxIterations;
        }

        for (uint256 e = start; e <= end; e++) {
            if (!_epochCheckpointed[e]) {
                _epochCheckpointed[e] = true;
                emit EpochCheckpointed(e, _epochTotalVotes[e]);
            }
        }
        if (end >= start) {
            lastCheckpointedEpoch = end;
        }
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
     * @dev Uses fixed 69,420 PPM budget + per-vault cap.
     *      Mid-epoch delist/pause: ineligible vaults return 0 but their weight remains in
     *      `_epochTotalVotes` until users re-vote or the epoch ends. That fraction of the
     *      budget is intentionally **burned** for the epoch (not redistributed) so ops
     *      cannot concentrate the full budget onto remaining vaults by delisting peers.
     *      Past-epoch claims still use frozen weights via getVaultWeightAtEpoch / user weight.
     */
    function getVaultProbabilityBoostPPM(address vault) external view returns (uint256 boostPPM) {
        if (!_canReceiveVotes(vault)) return 0;

        uint256 epoch = currentEpoch();
        uint256 total = _epochTotalVotes[epoch];

        // FIX: M-04 (4626-313) — previously, zero-vote epochs distributed the
        // full TOTAL_GAUGE_PROBABILITY_PPM budget equally across whitelisted
        // vaults. That let the owner steer boost allocation without a
        // governance vote by manipulating the whitelist size (add vaults to
        // dilute, remove vaults to concentrate). Returning 0 on zero-vote
        // epochs removes the manipulability: if no one votes, no vault gets
        // a vote-directed boost that epoch.
        if (total == 0) {
            return 0;
        }
        uint256 v = _epochVaultVotes[epoch][vault];
        if (v == 0) return 0;
        // Denominator is full epoch total (including ineligible vault weights) — see natspec.
        boostPPM = (TOTAL_GAUGE_PROBABILITY_PPM * v) / total;

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
        // FIX: AUDIT-2026-07-01-H03 — stale per-user weights after emergencyResetAllVotes must
        // not count toward bribe claims once the epoch generation has advanced.
        if (_userVoteGeneration[epoch][user] != _epochResetGeneration[epoch]) return 0;
        return _epochUserVaultVotes[epoch][user][vault];
    }

    function getWhitelistedVaults() external view returns (address[] memory) {
        return _whitelistedVaults.values();
    }

    function whitelistedVaultCount() external view returns (uint256) {
        return _whitelistedVaults.length();
    }

    /**
     * @notice Vaults eligible for vote discovery (UI / API).
     * @dev When surface-registry mode is armed, returns registered surfaces that `canReceiveVotes`.
     *      Otherwise returns the local whitelist (same as `getWhitelistedVaults`).
     */
    function getEligibleVaults() external view returns (address[] memory) {
        if (useSurfaceRegistry && address(surfaceRegistry) != address(0)) {
            address[] memory all = surfaceRegistry.allSurfaces();
            uint256 n = 0;
            address[] memory tmp = new address[](all.length);
            for (uint256 i = 0; i < all.length; i++) {
                if (surfaceRegistry.canReceiveVotes(all[i])) {
                    tmp[n++] = all[i];
                }
            }
            address[] memory out = new address[](n);
            for (uint256 j = 0; j < n; j++) {
                out[j] = tmp[j];
            }
            return out;
        }
        return _whitelistedVaults.values();
    }

    function eligibleVaultCount() external view returns (uint256) {
        if (useSurfaceRegistry && address(surfaceRegistry) != address(0)) {
            address[] memory all = surfaceRegistry.allSurfaces();
            uint256 n = 0;
            for (uint256 i = 0; i < all.length; i++) {
                if (surfaceRegistry.canReceiveVotes(all[i])) n++;
            }
            return n;
        }
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

    /// @dev Single policy surface for vote eligibility (whitelist vs surface registry).
    function _canReceiveVotes(address vault) internal view returns (bool) {
        if (useSurfaceRegistry && address(surfaceRegistry) != address(0)) {
            return surfaceRegistry.canReceiveVotes(vault);
        }
        return _isVaultWhitelisted(vault);
    }

    function canReceiveVotes(address vault) external view returns (bool) {
        return _canReceiveVotes(vault);
    }

    /// @notice Bribe fund/create eligibility. Surface registry when enabled; else vault whitelist.
    function canReceiveBribes(address vault) external view returns (bool) {
        if (useSurfaceRegistry && address(surfaceRegistry) != address(0)) {
            return surfaceRegistry.canReceiveBribes(vault);
        }
        return _isVaultWhitelisted(vault);
    }

    /// @notice Partner stream fund/create eligibility. Surface registry when enabled; else vault whitelist.
    function canReceiveStreams(address vault) external view returns (bool) {
        if (useSurfaceRegistry && address(surfaceRegistry) != address(0)) {
            return surfaceRegistry.canReceiveStreams(vault);
        }
        return _isVaultWhitelisted(vault);
    }

    event SurfaceRegistryUpdated(address indexed surfaceRegistry);
    event UseSurfaceRegistryUpdated(bool enabled);

    function setSurfaceRegistry(address registry_) external onlyOwner {
        surfaceRegistry = IGaugeSurfaceRegistryForVoting(registry_);
        // Clearing the registry while surface mode is on would silently fall back to the
        // local whitelist — disable the flag so policy stays consistent.
        if (registry_ == address(0) && useSurfaceRegistry) {
            useSurfaceRegistry = false;
            emit UseSurfaceRegistryUpdated(false);
        }
        emit SurfaceRegistryUpdated(registry_);
    }

    function setUseSurfaceRegistry(bool enabled) external onlyOwner {
        if (enabled && address(surfaceRegistry) == address(0)) revert ZeroAddress();
        useSurfaceRegistry = enabled;
        emit UseSurfaceRegistryUpdated(enabled);
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
        registry = IRegistry4626VaultWhitelist(_registry);
    }

    function setUseRegistryWhitelist(bool enabled) external onlyOwner {
        useRegistryWhitelist = enabled;
    }

    // ================================
    // EMERGENCY
    // ================================

    function emergencyResetAllVotes() external onlyOwner {
        uint256 epoch = currentEpoch();
        // Zero every vault that actually received votes this epoch (whitelist *or* surface-only).
        EnumerableSet.AddressSet storage votedVaults = _epochVotedVaults[epoch];
        uint256 vaultCount = votedVaults.length();
        for (uint256 i = vaultCount; i > 0; i--) {
            address vault = votedVaults.at(i - 1);
            _epochVaultVotes[epoch][vault] = 0;
            votedVaults.remove(vault);
        }
        _epochTotalVotes[epoch] = 0;
        // FIX: G-06 — increment generation so stale per-user records are skipped in _clearUserVotes
        // and getUserVoteWeightAtEpoch returns 0 until re-vote.
        _epochResetGeneration[epoch]++;
    }
}

