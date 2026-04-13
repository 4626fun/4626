// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AjnaVaultAuth
 * @notice Policy hub for the inner Ajna ERC-4626 vault.
 * @dev Keeps the role and configuration surface separate from the vault so the
 *      outer CreatorOVault integration can swap operators without redeploying
 *      strategy logic.
 */
contract AjnaVaultAuth {
    using SafeERC20 for IERC20;

    uint256 internal constant MAX_AJNA_BUCKET_INDEX = 7_388;

    error NotAuthorized();
    error ZeroAddress();
    error FeeTooHigh();
    error BufferRatioTooHigh();
    error InvalidMinBucketIndex();
    // FIX: F-04 — two-step admin transfer errors
    error NotPendingAdmin();

    event AdminSet(address indexed admin);
    // FIX: F-04 — event for pending admin nomination
    event AdminTransferStarted(address indexed currentAdmin, address indexed pendingAdmin);
    event SwapperSet(address indexed swapper);
    event KeeperSet(address indexed keeper, bool isKeeper);
    event Paused();
    event Unpaused();
    event DepositCapSet(uint256 depositCap);
    event BufferRatioSet(uint256 bufferRatioBps);
    event TollSet(uint256 tollBps);
    event TaxSet(uint256 taxBps);
    event MinBucketIndexSet(uint256 minBucketIndex);

    address public admin;
    // FIX: F-04 — two-step admin transfer to prevent permanent lockout
    address public pendingAdmin;
    address public swapper;
    mapping(address => bool) public keepers;
    bool public paused;
    uint256 public depositCap;
    uint256 public bufferRatio;
    uint256 public toll;
    uint256 public tax;
    uint256 public minBucketIndex;

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAuthorized();
        _;
    }

    constructor(address initialAdmin) {
        if (initialAdmin == address(0)) revert ZeroAddress();
        admin = initialAdmin;
    }

    function isAdmin(address account) external view returns (bool) {
        return account == admin;
    }

    function isSwapper(address account) external view returns (bool) {
        return account == swapper;
    }

    function isKeeper(address account) external view returns (bool) {
        return keepers[account];
    }

    function isAdminOrKeeper(address account) external view returns (bool) {
        return account == admin || keepers[account];
    }

    function isAdminOrSwapper(address account) external view returns (bool) {
        return account == admin || account == swapper;
    }

    // FIX: F-04 — two-step admin transfer: nominate then accept
    function transferAdmin(address nextAdmin) external onlyAdmin {
        if (nextAdmin == address(0)) revert ZeroAddress();
        pendingAdmin = nextAdmin;
        emit AdminTransferStarted(admin, nextAdmin);
    }

    function acceptAdmin() external {
        if (msg.sender != pendingAdmin) revert NotPendingAdmin();
        admin = pendingAdmin;
        pendingAdmin = address(0);
        emit AdminSet(admin);
    }

    function setSwapper(address nextSwapper) external onlyAdmin {
        // FIX: F-09 — prevent setting swapper to zero which would lock withdraw/redeem
        if (nextSwapper == address(0)) revert ZeroAddress();
        swapper = nextSwapper;
        emit SwapperSet(nextSwapper);
    }

    function setKeeper(address keeper, bool isKeeper_) external onlyAdmin {
        keepers[keeper] = isKeeper_;
        emit KeeperSet(keeper, isKeeper_);
    }

    function pause() external onlyAdmin {
        paused = true;
        emit Paused();
    }

    function unpause() external onlyAdmin {
        paused = false;
        emit Unpaused();
    }

    function setDepositCap(uint256 nextDepositCap) external onlyAdmin {
        depositCap = nextDepositCap;
        emit DepositCapSet(nextDepositCap);
    }

    function setBufferRatio(uint256 nextBufferRatio) external onlyAdmin {
        if (nextBufferRatio > 10_000) revert BufferRatioTooHigh();
        bufferRatio = nextBufferRatio;
        emit BufferRatioSet(nextBufferRatio);
    }

    function setToll(uint256 nextToll) external onlyAdmin {
        if (nextToll > 1_000) revert FeeTooHigh();
        toll = nextToll;
        emit TollSet(nextToll);
    }

    function setTax(uint256 nextTax) external onlyAdmin {
        if (nextTax > 1_000) revert FeeTooHigh();
        tax = nextTax;
        emit TaxSet(nextTax);
    }

    function setMinBucketIndex(uint256 nextMinBucketIndex) external onlyAdmin {
        if (nextMinBucketIndex > MAX_AJNA_BUCKET_INDEX) revert InvalidMinBucketIndex();
        minBucketIndex = nextMinBucketIndex;
        emit MinBucketIndexSet(nextMinBucketIndex);
    }

    /// @notice Withdraw accumulated fee tokens to admin.
    /// @dev FIX: F-20 — accepts any ERC-20 token to handle multi-token fee scenarios.
    /// CAUTION: admin must ensure `token` is a fee token, not vault collateral.
    /// Only callable by admin; tokens always sent to the current admin address.
    function retrieveFees(address token, uint256 amount) external onlyAdmin {
        if (token == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(admin, amount);
    }
}
