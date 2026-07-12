// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface Ive4626GaugeVotingForBribeDepot4626 {
    function currentEpoch() external view returns (uint256);
    function getVaultWeightAtEpoch(uint256 epoch, address vault) external view returns (uint256);
    function getUserVoteWeightAtEpoch(uint256 epoch, address user, address vault) external view returns (uint256);
    /// @notice Bribe eligibility (surface registry bribes flag when wired; else vault whitelist).
    function canReceiveBribes(address vault) external view returns (bool);
}

/**
 * @title BribeDepot4626
 * @author 4626
 * @notice Vault-scoped bribe depot for ve(3,3) voting epochs.
 * @dev Deployed per-vault by BribesFactory4626 using CREATE2.
 */
contract BribeDepot4626 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================
    // STATE
    // ================================

    /// @notice Vault this depot is tied to
    address public immutable vault;

    /// @notice Gauge voting contract used for vote weights
    Ive4626GaugeVotingForBribeDepot4626 public immutable gaugeVoting;

    /// @notice epoch => token => total bribe amount
    mapping(uint256 => mapping(address => uint256)) public totalBribes;

    /// @notice epoch => token => user => claimed
    mapping(uint256 => mapping(address => mapping(address => bool))) public claimed;

    /// @notice epoch => token => total amount paid out (sum of transfers attempted)
    mapping(uint256 => mapping(address => uint256)) public claimedAmount;

    /// @notice epoch => token => closed (no further claims; may have been rolled forward)
    mapping(uint256 => mapping(address => bool)) public isClosed;

    /// @notice Number of epochs to wait before rolling forward leftover bribes.
    /// @dev 4 epochs ≈ 4 weeks after the epoch ends. Owner can raise; floor is MIN_ROLLOVER_GRACE.
    uint256 public rolloverGraceEpochs = 4;

    /// @notice Minimum grace epochs for leftover rollover (M-13 — late claimers).
    uint256 public constant MIN_ROLLOVER_GRACE_EPOCHS = 2;

    // ================================
    // EVENTS
    // ================================

    event Bribed(address indexed token, uint256 amount, uint256 indexed epoch);
    event Claimed(address indexed user, address indexed token, uint256 amount, uint256 indexed epoch);
    event BribeRolledOver(address indexed token, uint256 indexed fromEpoch, uint256 indexed toEpoch, uint256 amount);
    event RolloverGraceEpochsUpdated(uint256 oldGrace, uint256 newGrace);

    // ================================
    // ERRORS
    // ================================

    error ZeroAddress();
    error ZeroAmount();
    error AlreadyClaimed();
    error NoUserVotes();
    error EpochNotEnded();
    error EpochClosed();
    error RolloverNotAllowedYet();
    error NotZeroVoteEpoch();
    // FIX: G-14 — error for bribes on non-whitelisted vault
    error VaultNotWhitelisted();
    error GraceBelowMinimum(uint256 provided, uint256 minimum);

    /// @param _owner Protocol/ops owner for rollover + grace (not the CREATE2 factory).
    constructor(address _vault, address _gaugeVoting, address _owner) Ownable(_owner) {
        if (_vault == address(0) || _gaugeVoting == address(0) || _owner == address(0)) revert ZeroAddress();
        vault = _vault;
        gaugeVoting = Ive4626GaugeVotingForBribeDepot4626(_gaugeVoting);
    }

    /**
     * @notice Add bribe tokens for the current epoch.
     * @param token Token to bribe with
     * @param amount Amount to bribe
     */
    function bribe(address token, uint256 amount) external nonReentrant {
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        // Reject bribes for de-listed / non-bribe-capable surfaces.
        if (!gaugeVoting.canReceiveBribes(vault)) revert VaultNotWhitelisted();

        uint256 epoch = gaugeVoting.currentEpoch();
        uint256 beforeBal = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 afterBal = IERC20(token).balanceOf(address(this));

        // Credit the actual received amount (supports fee-on-transfer tokens).
        uint256 received = afterBal - beforeBal;
        if (received == 0) revert ZeroAmount();
        totalBribes[epoch][token] += received;

        emit Bribed(token, received, epoch);
    }

    /**
     * @notice Claim bribe rewards for a past epoch.
     * @param epoch Epoch to claim
     * @param token Token to claim
     */
    function claim(uint256 epoch, address token) external nonReentrant returns (uint256 amount) {
        if (epoch >= gaugeVoting.currentEpoch()) revert EpochNotEnded();
        if (token == address(0)) revert ZeroAddress();
        if (isClosed[epoch][token]) revert EpochClosed();
        if (claimed[epoch][token][msg.sender]) revert AlreadyClaimed();

        uint256 totalWeight = gaugeVoting.getVaultWeightAtEpoch(epoch, vault);
        if (totalWeight == 0) revert NoUserVotes();

        uint256 userWeight = gaugeVoting.getUserVoteWeightAtEpoch(epoch, msg.sender, vault);
        if (userWeight == 0) revert NoUserVotes();

        uint256 totalAmount = totalBribes[epoch][token];
        amount = (totalAmount * userWeight) / totalWeight;
        if (amount == 0 && userWeight > 0) revert NoUserVotes();

        claimed[epoch][token][msg.sender] = true;
        claimedAmount[epoch][token] += amount;
        if (amount > 0) {
            IERC20(token).safeTransfer(msg.sender, amount);
        }

        emit Claimed(msg.sender, token, amount, epoch);
    }

    /**
     * @notice Roll bribes from an epoch with zero vault weight into the current epoch.
     * @dev Safe because there were no eligible claimants for that epoch. Permissionless.
     */
    function rolloverZeroVoteEpoch(uint256 epoch, address token) external nonReentrant returns (uint256 rolled) {
        if (token == address(0)) revert ZeroAddress();

        uint256 current = gaugeVoting.currentEpoch();
        if (epoch >= current) revert EpochNotEnded();
        if (isClosed[epoch][token]) revert EpochClosed();
        // FIX: G-21 — add minimum grace period (1 epoch) before zero-vote rollovers
        if (epoch + 1 >= current) revert RolloverNotAllowedYet();

        // Only roll epochs with 0 votes for this vault (no eligible claimants).
        if (gaugeVoting.getVaultWeightAtEpoch(epoch, vault) != 0) revert NotZeroVoteEpoch();

        rolled = totalBribes[epoch][token];

        // Close the epoch/token to prevent late claims pulling from rolled-forward liquidity.
        isClosed[epoch][token] = true;
        totalBribes[epoch][token] = 0;

        if (rolled > 0) {
            totalBribes[current][token] += rolled;
        }

        emit BribeRolledOver(token, epoch, current, rolled);
    }

    /**
     * @notice Roll leftover (unclaimed + rounding dust) forward after a grace period.
     * @dev M-13: owner-only so a griefing third party cannot confiscate late claims the
     *      moment the grace window ends. Zero-vote epochs still use the permissionless path.
     *      Once rolled, the epoch/token is closed and can no longer be claimed.
     */
    function rolloverExpiredEpoch(uint256 epoch, address token) external onlyOwner nonReentrant returns (uint256 rolled) {
        if (token == address(0)) revert ZeroAddress();

        uint256 current = gaugeVoting.currentEpoch();
        if (epoch >= current) revert EpochNotEnded();
        if (isClosed[epoch][token]) revert EpochClosed();
        if (epoch + rolloverGraceEpochs >= current) revert RolloverNotAllowedYet();

        uint256 totalAmount = totalBribes[epoch][token];
        uint256 alreadyClaimed = claimedAmount[epoch][token];

        // Clamp: never underflow even if a non-standard token causes unexpected behavior.
        if (alreadyClaimed >= totalAmount) {
            isClosed[epoch][token] = true;
            emit BribeRolledOver(token, epoch, current, 0);
            return 0;
        }

        rolled = totalAmount - alreadyClaimed;
        isClosed[epoch][token] = true;
        // FIX: G-05 — zero out source epoch to prevent stale reads and double-counting
        totalBribes[epoch][token] = 0;

        if (rolled > 0) {
            totalBribes[current][token] += rolled;
        }

        emit BribeRolledOver(token, epoch, current, rolled);
    }

    /// @notice Raise/lower leftover-claim grace (floor MIN_ROLLOVER_GRACE_EPOCHS).
    function setRolloverGraceEpochs(uint256 newGrace) external onlyOwner {
        if (newGrace < MIN_ROLLOVER_GRACE_EPOCHS) {
            revert GraceBelowMinimum(newGrace, MIN_ROLLOVER_GRACE_EPOCHS);
        }
        uint256 old = rolloverGraceEpochs;
        rolloverGraceEpochs = newGrace;
        emit RolloverGraceEpochsUpdated(old, newGrace);
    }
}
