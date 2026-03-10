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

    error NotAuthorized();
    error ZeroAddress();
    error FeeTooHigh();
    error BufferRatioTooHigh();

    event AdminSet(address indexed admin);
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

    function setAdmin(address nextAdmin) external onlyAdmin {
        if (nextAdmin == address(0)) revert ZeroAddress();
        admin = nextAdmin;
        emit AdminSet(nextAdmin);
    }

    function setSwapper(address nextSwapper) external onlyAdmin {
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
        minBucketIndex = nextMinBucketIndex;
        emit MinBucketIndexSet(nextMinBucketIndex);
    }

    function retrieveFees(address token, uint256 amount) external onlyAdmin {
        IERC20(token).safeTransfer(admin, amount);
    }
}
