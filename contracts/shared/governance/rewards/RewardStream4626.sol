// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IRewardStream4626} from "./interfaces/IRewardStream4626.sol";
import {IRewardWeightSource} from "./interfaces/IRewardWeightSource.sol";

/**
 * @title RewardStream4626
 * @author 4626
 * @notice Vault-scoped multi-token partner reward stream (epoch bag / Design A).
 * @dev Flywheel-inspired ergonomics without Hermes Flywheel:
 *      - Pre-funded ERC-20 only (no emissions mint)
 *      - Credits **current epoch**; claim only after epoch ends
 *      - Pro-rata by finalized `ve4626GaugeVoting` weights
 *      - Token allowlist (owner-managed)
 *      - Parallel to `BribeDepot4626` (one-shot bribes) and fee `ve4626VoterRewardsDistributor`
 *
 * Deployed per-vault by `RewardStreamFactory4626` via CREATE2.
 */
contract RewardStream4626 is IRewardStream4626, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================
    // IMMUTABLES
    // ================================

    /// @notice Vault this stream is tied to (gauge id).
    address public immutable override vault;

    /// @notice Weight source (`ve4626GaugeVoting`).
    IRewardWeightSource public immutable weightSource;

    // ================================
    // STATE
    // ================================

    /// @notice Allowlisted reward tokens (must be true before fund).
    mapping(address => bool) public override isRewardToken;

    /// @notice epoch => token => total rewards in bag
    mapping(uint256 => mapping(address => uint256)) public override epochTokenRewards;

    /// @notice epoch => token => user => claimed?
    mapping(uint256 => mapping(address => mapping(address => bool))) private _hasClaimed;

    /// @notice epoch => token => total amount paid out
    mapping(uint256 => mapping(address => uint256)) public claimedAmount;

    /// @notice epoch => token => closed (rolled forward; no further claims)
    mapping(uint256 => mapping(address => bool)) public isClosed;

    /// @notice Epochs to wait before owner leftover rollover (floor MIN_ROLLOVER_GRACE_EPOCHS).
    uint256 public rolloverGraceEpochs = 4;

    uint256 public constant MIN_ROLLOVER_GRACE_EPOCHS = 2;

    // ================================
    // CONSTRUCTOR
    // ================================

    constructor(address vault_, address weightSource_, address owner_) Ownable(owner_) {
        if (vault_ == address(0) || weightSource_ == address(0) || owner_ == address(0)) {
            revert ZeroAddress();
        }
        vault = vault_;
        weightSource = IRewardWeightSource(weightSource_);
    }

    // ================================
    // VIEWS
    // ================================

    /// @inheritdoc IRewardStream4626
    function gaugeVoting() external view override returns (address) {
        return address(weightSource);
    }

    /// @inheritdoc IRewardStream4626
    function hasClaimed(uint256 epoch, address token, address user) external view override returns (bool) {
        return _hasClaimed[epoch][token][user];
    }

    /// @inheritdoc IRewardStream4626
    function previewClaim(address user, uint256 epoch, address token) external view override returns (uint256 amount) {
        if (user == address(0) || token == address(0)) return 0;
        if (epoch >= weightSource.currentEpoch()) return 0;
        if (isClosed[epoch][token]) return 0;
        if (_hasClaimed[epoch][token][user]) return 0;

        uint256 totalWeight = weightSource.getVaultWeightAtEpoch(epoch, vault);
        if (totalWeight == 0) return 0;

        uint256 userWeight = weightSource.getUserVoteWeightAtEpoch(epoch, user, vault);
        if (userWeight == 0) return 0;

        uint256 bag = epochTokenRewards[epoch][token];
        if (bag == 0) return 0;

        return (bag * userWeight) / totalWeight;
    }

    // ================================
    // ADMIN
    // ================================

    /// @inheritdoc IRewardStream4626
    function addRewardToken(address token) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        if (isRewardToken[token]) revert TokenAlreadyAllowed(token);
        isRewardToken[token] = true;
        emit RewardTokenAdded(token);
    }

    /// @inheritdoc IRewardStream4626
    function removeRewardToken(address token) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        if (!isRewardToken[token]) revert TokenNotAllowed(token);
        isRewardToken[token] = false;
        emit RewardTokenRemoved(token);
    }

    /// @inheritdoc IRewardStream4626
    function setRolloverGraceEpochs(uint256 newGrace) external onlyOwner {
        if (newGrace < MIN_ROLLOVER_GRACE_EPOCHS) {
            revert GraceBelowMinimum(newGrace, MIN_ROLLOVER_GRACE_EPOCHS);
        }
        uint256 old = rolloverGraceEpochs;
        rolloverGraceEpochs = newGrace;
        emit RolloverGraceEpochsUpdated(old, newGrace);
    }

    // ================================
    // FUND
    // ================================

    /**
     * @inheritdoc IRewardStream4626
     * @dev Credits the **current** epoch bag. Claimable only after the epoch ends.
     *      Uses balance delta so fee-on-transfer tokens credit correctly.
     */
    function fund(address token, uint256 amount) external nonReentrant {
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (!isRewardToken[token]) revert TokenNotAllowed(token);
        if (!weightSource.canReceiveStreams(vault)) revert VaultNotWhitelisted();

        uint256 epoch = weightSource.currentEpoch();
        uint256 beforeBal = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 afterBal = IERC20(token).balanceOf(address(this));

        uint256 received = afterBal - beforeBal;
        if (received == 0) revert ZeroAmount();

        epochTokenRewards[epoch][token] += received;
        emit Funded(msg.sender, token, received, epoch);
    }

    // ================================
    // CLAIM
    // ================================

    /// @inheritdoc IRewardStream4626
    function claim(uint256 epoch, address token) external nonReentrant returns (uint256 amount) {
        return _claim(msg.sender, epoch, token);
    }

    /// @inheritdoc IRewardStream4626
    function claimMany(uint256 epoch, address[] calldata tokens) external nonReentrant returns (uint256 totalAmount) {
        for (uint256 i = 0; i < tokens.length; i++) {
            totalAmount += _claim(msg.sender, epoch, tokens[i]);
        }
    }

    function _claim(address user, uint256 epoch, address token) internal returns (uint256 amount) {
        if (token == address(0) || user == address(0)) revert ZeroAddress();
        if (epoch >= weightSource.currentEpoch()) revert EpochNotEnded();
        if (isClosed[epoch][token]) revert EpochClosed();
        if (_hasClaimed[epoch][token][user]) revert AlreadyClaimed();

        uint256 totalWeight = weightSource.getVaultWeightAtEpoch(epoch, vault);
        if (totalWeight == 0) revert NoUserVotes();

        uint256 userWeight = weightSource.getUserVoteWeightAtEpoch(epoch, user, vault);
        if (userWeight == 0) revert NoUserVotes();

        uint256 bag = epochTokenRewards[epoch][token];
        amount = (bag * userWeight) / totalWeight;
        // Dust: weight > 0 but bag too small to pay 1 wei — treat as already settled.
        if (amount == 0) {
            _hasClaimed[epoch][token][user] = true;
            emit Claimed(user, token, 0, epoch);
            return 0;
        }

        _hasClaimed[epoch][token][user] = true;
        claimedAmount[epoch][token] += amount;
        IERC20(token).safeTransfer(user, amount);

        emit Claimed(user, token, amount, epoch);
    }

    // ================================
    // ROLLOVER
    // ================================

    /**
     * @inheritdoc IRewardStream4626
     * @dev Permissionless after the epoch has been ended for ≥1 full epoch.
     *      Safe: zero vault weight means no eligible claimants.
     */
    function rolloverZeroVoteEpoch(uint256 epoch, address token) external nonReentrant returns (uint256 rolled) {
        if (token == address(0)) revert ZeroAddress();

        uint256 current = weightSource.currentEpoch();
        if (epoch >= current) revert EpochNotEnded();
        if (isClosed[epoch][token]) revert EpochClosed();
        if (epoch + 1 >= current) revert RolloverNotAllowedYet();
        if (weightSource.getVaultWeightAtEpoch(epoch, vault) != 0) revert NotZeroVoteEpoch();

        rolled = epochTokenRewards[epoch][token];
        isClosed[epoch][token] = true;
        epochTokenRewards[epoch][token] = 0;

        if (rolled > 0) {
            epochTokenRewards[current][token] += rolled;
        }

        emit StreamRolledOver(token, epoch, current, rolled);
    }

    /**
     * @inheritdoc IRewardStream4626
     * @dev Owner-only leftover rollover after `rolloverGraceEpochs` so late claimers
     *      are not griefed the moment the epoch ends.
     */
    function rolloverExpiredEpoch(uint256 epoch, address token) external onlyOwner nonReentrant returns (uint256 rolled) {
        if (token == address(0)) revert ZeroAddress();

        uint256 current = weightSource.currentEpoch();
        if (epoch >= current) revert EpochNotEnded();
        if (isClosed[epoch][token]) revert EpochClosed();
        if (epoch + rolloverGraceEpochs >= current) revert RolloverNotAllowedYet();

        uint256 totalAmount = epochTokenRewards[epoch][token];
        uint256 alreadyClaimed = claimedAmount[epoch][token];

        if (alreadyClaimed >= totalAmount) {
            isClosed[epoch][token] = true;
            emit StreamRolledOver(token, epoch, current, 0);
            return 0;
        }

        rolled = totalAmount - alreadyClaimed;
        isClosed[epoch][token] = true;
        epochTokenRewards[epoch][token] = 0;

        if (rolled > 0) {
            epochTokenRewards[current][token] += rolled;
        }

        emit StreamRolledOver(token, epoch, current, rolled);
    }
}
