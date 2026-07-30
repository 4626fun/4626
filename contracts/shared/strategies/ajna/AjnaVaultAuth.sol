// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AjnaVaultAuth
 * @notice Policy hub for the inner Ajna ERC-4626 vault.
 * @dev Keeps the role and configuration surface separate from the vault so the
 *      outer lane-vault integration can swap operators without redeploying
 *      strategy logic.
 */
contract AjnaVaultAuth {
    using SafeERC20 for IERC20;

    uint256 internal constant MAX_AJNA_BUCKET_INDEX = 7_388;

    error NotAuthorized();
    error ZeroAddress();
    error FeeTooHigh();
    error BufferRatioTooHigh();
    error BufferRatioTooLow(uint256 provided, uint256 minimum);
    error InvalidMinBucketIndex();
    // FIX: F-04 — two-step admin transfer errors
    error NotPendingAdmin();
    error NotPendingSwapper();
    error NoPendingTollUpdate();
    error NoPendingTaxUpdate();
    error FeeUpdateTimelockActive(uint256 executeAfter);

    event AdminSet(address indexed admin);
    // FIX: F-04 — event for pending admin nomination
    event AdminTransferStarted(address indexed currentAdmin, address indexed pendingAdmin);
    event SwapperTransferStarted(address indexed currentSwapper, address indexed pendingSwapper);
    event SwapperSet(address indexed swapper);
    event KeeperSet(address indexed keeper, bool isKeeper);
    event Paused();
    event Unpaused();
    event DepositCapSet(uint256 depositCap);
    event BufferRatioSet(uint256 bufferRatioBps);
    event TollSet(uint256 tollBps);
    event TaxSet(uint256 taxBps);
    event TollUpdateQueued(uint256 tollBps, uint256 executeAfter);
    event TaxUpdateQueued(uint256 taxBps, uint256 executeAfter);
    event TollUpdateExpired(uint256 expiredAt);
    event TaxUpdateExpired(uint256 expiredAt);
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

    /// @notice ODA-423-M08: after initial bootstrap, toll/tax changes are 24h-timelocked.
    uint256 public constant FEE_UPDATE_TIMELOCK = 24 hours;
    /// @notice ODA-519-17: queued fee updates expire if not executed.
    uint256 public constant FEE_UPDATE_EXPIRY = 7 days;
    bool public tollArmed;
    bool public taxArmed;
    uint256 public pendingToll;
    uint256 public pendingTax;
    uint256 public pendingTollAt;
    uint256 public pendingTaxAt;
    /// @notice ODA-519-6: two-step swapper rotation (mirror admin transfer).
    address public pendingSwapper;

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAuthorized();
        _;
    }

    constructor(address initialAdmin) {
        if (initialAdmin == address(0)) revert ZeroAddress();
        admin = initialAdmin;
        // ODA-519-17: arm fee levers at deploy so toll/tax=0 cannot be front-run without timelock.
        tollArmed = true;
        taxArmed = true;
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

    /// @notice Set or nominate the swapper (ODA-519-6).
    /// @dev First assignment (`swapper == 0`) is instant for CREATE2/factory wiring.
    ///      Rotations are two-step: nominate here, then `acceptSwapper()` from the nominee.
    function setSwapper(address nextSwapper) external onlyAdmin {
        // FIX: F-09 — prevent setting swapper to zero which would lock withdraw/redeem
        if (nextSwapper == address(0)) revert ZeroAddress();
        if (swapper == address(0)) {
            swapper = nextSwapper;
            emit SwapperSet(nextSwapper);
            return;
        }
        pendingSwapper = nextSwapper;
        emit SwapperTransferStarted(swapper, nextSwapper);
    }

    function acceptSwapper() external {
        if (msg.sender != pendingSwapper) revert NotPendingSwapper();
        swapper = pendingSwapper;
        pendingSwapper = address(0);
        emit SwapperSet(swapper);
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

    /// @notice Minimum idle buffer as bps of total assets (M-14). Prevents permanently
    ///         zeroing exit liquidity via moveFromBuffer when ratio was left at 0.
    uint256 public constant MIN_BUFFER_RATIO_BPS = 500; // 5%

    function setBufferRatio(uint256 nextBufferRatio) external onlyAdmin {
        if (nextBufferRatio > 10_000) revert BufferRatioTooHigh();
        // M-14: disallow disabling / under-floor buffer (0 previously skipped ensureBufferRatio).
        if (nextBufferRatio < MIN_BUFFER_RATIO_BPS) {
            revert BufferRatioTooLow(nextBufferRatio, MIN_BUFFER_RATIO_BPS);
        }
        bufferRatio = nextBufferRatio;
        emit BufferRatioSet(nextBufferRatio);
    }

    function setToll(uint256 nextToll) external onlyAdmin {
        if (nextToll > 1_000) revert FeeTooHigh();
        // ODA-519-17 / ODA-423-M08: always queue behind timelock (armed at construction).
        if (!tollArmed) {
            toll = nextToll;
            tollArmed = true;
            emit TollSet(nextToll);
            return;
        }
        pendingToll = nextToll;
        pendingTollAt = block.timestamp + FEE_UPDATE_TIMELOCK;
        emit TollUpdateQueued(nextToll, pendingTollAt);
    }

    function executeTollUpdate() external onlyAdmin {
        uint256 executeAfter = pendingTollAt;
        if (executeAfter == 0) revert NoPendingTollUpdate();
        if (block.timestamp < executeAfter) revert FeeUpdateTimelockActive(executeAfter);
        uint256 expiresAt = executeAfter + FEE_UPDATE_EXPIRY;
        // Clear without reverting — a revert would roll back the clear.
        if (block.timestamp > expiresAt) {
            pendingToll = 0;
            pendingTollAt = 0;
            emit TollUpdateExpired(expiresAt);
            return;
        }
        uint256 next = pendingToll;
        pendingToll = 0;
        pendingTollAt = 0;
        toll = next;
        emit TollSet(next);
    }

    function setTax(uint256 nextTax) external onlyAdmin {
        if (nextTax > 1_000) revert FeeTooHigh();
        if (!taxArmed) {
            tax = nextTax;
            taxArmed = true;
            emit TaxSet(nextTax);
            return;
        }
        pendingTax = nextTax;
        pendingTaxAt = block.timestamp + FEE_UPDATE_TIMELOCK;
        emit TaxUpdateQueued(nextTax, pendingTaxAt);
    }

    function executeTaxUpdate() external onlyAdmin {
        uint256 executeAfter = pendingTaxAt;
        if (executeAfter == 0) revert NoPendingTaxUpdate();
        if (block.timestamp < executeAfter) revert FeeUpdateTimelockActive(executeAfter);
        uint256 expiresAt = executeAfter + FEE_UPDATE_EXPIRY;
        // Clear without reverting — a revert would roll back the clear.
        if (block.timestamp > expiresAt) {
            pendingTax = 0;
            pendingTaxAt = 0;
            emit TaxUpdateExpired(expiresAt);
            return;
        }
        uint256 next = pendingTax;
        pendingTax = 0;
        pendingTaxAt = 0;
        tax = next;
        emit TaxSet(next);
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
