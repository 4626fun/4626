// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IVaultGaugeVotingForBribeDepot {
    function currentEpoch() external view returns (uint256);
    function getVaultWeightAtEpoch(uint256 epoch, address vault) external view returns (uint256);
    function getUserVoteWeightAtEpoch(uint256 epoch, address user, address vault) external view returns (uint256);
}

/**
 * @title BribeDepot
 * @author CreatorVault
 * @notice Vault-scoped bribe depot for ve(3,3) voting epochs.
 * @dev Deployed per-vault by BribesFactory using CREATE2.
 */
contract BribeDepot is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================
    // STATE
    // ================================

    /// @notice Vault this depot is tied to
    address public immutable vault;

    /// @notice Gauge voting contract used for vote weights
    IVaultGaugeVotingForBribeDepot public immutable gaugeVoting;

    /// @notice epoch => token => total bribe amount
    mapping(uint256 => mapping(address => uint256)) public totalBribes;

    /// @notice epoch => token => user => claimed
    mapping(uint256 => mapping(address => mapping(address => bool))) public claimed;

    /// @notice epoch => token => total amount paid out (sum of transfers attempted)
    mapping(uint256 => mapping(address => uint256)) public claimedAmount;

    /// @notice epoch => token => closed (no further claims; may have been rolled forward)
    mapping(uint256 => mapping(address => bool)) public isClosed;

    /// @notice Number of epochs to wait before rolling forward leftover bribes.
    /// @dev 4 epochs ≈ 4 weeks after the epoch ends.
    uint256 public rolloverGraceEpochs = 4;

    // ================================
    // EVENTS
    // ================================

    event Bribed(address indexed token, uint256 amount, uint256 indexed epoch);
    event Claimed(address indexed user, address indexed token, uint256 amount, uint256 indexed epoch);
    event BribeRolledOver(address indexed token, uint256 indexed fromEpoch, uint256 indexed toEpoch, uint256 amount);

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

    constructor(address _vault, address _gaugeVoting) Ownable(msg.sender) {
        if (_vault == address(0) || _gaugeVoting == address(0)) revert ZeroAddress();
        vault = _vault;
        gaugeVoting = IVaultGaugeVotingForBribeDepot(_gaugeVoting);
    }

    /**
     * @notice Add bribe tokens for the current epoch.
     * @param token Token to bribe with
     * @param amount Amount to bribe
     */
    function bribe(address token, uint256 amount) external nonReentrant {
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 epoch = gaugeVoting.currentEpoch();
        uint256 beforeBal = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 afterBal = IERC20(token).balanceOf(address(this));

        // Credit the actual received amount (supports fee-on-transfer tokens).
        uint256 received = afterBal - beforeBal;
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

        claimed[epoch][token][msg.sender] = true;
        claimedAmount[epoch][token] += amount;
        if (amount > 0) {
            IERC20(token).safeTransfer(msg.sender, amount);
        }

        emit Claimed(msg.sender, token, amount, epoch);
    }

    /**
     * @notice Roll bribes from an epoch with zero vault weight into the current epoch.
     * @dev Safe because there were no eligible claimants for that epoch.
     */
    function rolloverZeroVoteEpoch(uint256 epoch, address token) external nonReentrant returns (uint256 rolled) {
        if (token == address(0)) revert ZeroAddress();

        uint256 current = gaugeVoting.currentEpoch();
        if (epoch >= current) revert EpochNotEnded();
        if (isClosed[epoch][token]) revert EpochClosed();

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
     * @dev Once rolled, the epoch/token is closed and can no longer be claimed.
     */
    function rolloverExpiredEpoch(uint256 epoch, address token) external nonReentrant returns (uint256 rolled) {
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

        if (rolled > 0) {
            totalBribes[current][token] += rolled;
        }

        emit BribeRolledOver(token, epoch, current, rolled);
    }
}
