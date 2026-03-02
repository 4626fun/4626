// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IStrategy} from "../../interfaces/IStrategy.sol";
import {IStrategyValuation} from "../../interfaces/IStrategyValuation.sol";

interface ISolanaBridgeAdapter {
    function bridgeToSolana(address token, uint256 amount, bytes32 solanaDestination) external payable;
}

/**
 * @title SolanaBridgeStrategy
 * @notice Minimal CreatorOVault strategy adapter for Solana allocation.
 * @dev This strategy intentionally keeps deposits local by default. Bridging is an explicit
 *      owner action (`bridgeToSolana`) so vault withdrawals are not implicitly coupled to a
 *      cross-chain return path.
 */
contract SolanaBridgeStrategy is IStrategy, IStrategyValuation, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error OnlyVault();
    error StrategyPaused();
    error InvalidAddress();
    error InvalidAmount();
    error BridgeConfigMissing();

    address public immutable vault;
    IERC20 public immutable ASSET;

    address public bridgeAdapter;
    bytes32 public solanaDestination;

    bool private _isActive;

    event BridgeConfigUpdated(address indexed adapter, bytes32 indexed destination);
    event BridgedToSolana(uint256 amount, bytes32 indexed destination);

    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    modifier whenActive() {
        if (!_isActive) revert StrategyPaused();
        _;
    }

    constructor(address _vault, address _asset, address _bridgeAdapter, bytes32 _solanaDestination, address _owner)
        Ownable(_owner)
    {
        if (_vault == address(0) || _asset == address(0)) revert InvalidAddress();
        vault = _vault;
        ASSET = IERC20(_asset);
        bridgeAdapter = _bridgeAdapter;
        solanaDestination = _solanaDestination;
        _isActive = true;
    }

    function isActive() external view override returns (bool) {
        return _isActive;
    }

    function asset() external view override returns (address) {
        return address(ASSET);
    }

    function isValuationReady() external pure override returns (bool) {
        return true;
    }

    function getTotalAssets() public view override returns (uint256) {
        return ASSET.balanceOf(address(this));
    }

    function deposit(uint256 amount) external override onlyVault whenActive nonReentrant returns (uint256 deposited) {
        if (amount == 0) return 0;
        ASSET.safeTransferFrom(msg.sender, address(this), amount);
        deposited = amount;
        emit StrategyDeposit(msg.sender, amount, deposited);
    }

    function withdraw(uint256 amount) external override onlyVault nonReentrant returns (uint256 withdrawn) {
        if (amount == 0) return 0;
        uint256 bal = ASSET.balanceOf(address(this));
        withdrawn = bal < amount ? bal : amount;
        if (withdrawn > 0) {
            ASSET.safeTransfer(vault, withdrawn);
        }
        emit StrategyWithdraw(msg.sender, amount, withdrawn);
    }

    function emergencyWithdraw() external override onlyVault nonReentrant returns (uint256 withdrawn) {
        _isActive = false;
        withdrawn = ASSET.balanceOf(address(this));
        if (withdrawn > 0) {
            ASSET.safeTransfer(vault, withdrawn);
        }
        emit EmergencyWithdraw(vault, withdrawn);
    }

    function harvest() external override onlyVault returns (uint256 profit) {
        profit = 0;
        emit StrategyHarvest(profit);
    }

    function rebalance() external override onlyVault {
        emit StrategyRebalanced(getTotalAssets());
    }

    function setActive(bool active) external onlyOwner {
        _isActive = active;
    }

    function setBridgeConfig(address adapter, bytes32 destination) external onlyOwner {
        bool clear = adapter == address(0) && destination == bytes32(0);
        bool set = adapter != address(0) && destination != bytes32(0);
        if (!clear && !set) revert InvalidAddress();
        bridgeAdapter = adapter;
        solanaDestination = destination;
        emit BridgeConfigUpdated(adapter, destination);
    }

    function bridgeToSolana(uint256 amount) external payable onlyOwner whenActive nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (bridgeAdapter == address(0) || solanaDestination == bytes32(0)) revert BridgeConfigMissing();
        if (amount > ASSET.balanceOf(address(this))) revert InvalidAmount();

        ASSET.forceApprove(bridgeAdapter, amount);
        ISolanaBridgeAdapter(bridgeAdapter).bridgeToSolana{value: msg.value}(address(ASSET), amount, solanaDestination);
        emit BridgedToSolana(amount, solanaDestination);
    }

    function rescueTokens(address token, uint256 amount, address to) external onlyOwner {
        if (to == address(0)) revert InvalidAddress();
        if (token == address(ASSET) && _isActive) revert StrategyPaused();
        IERC20(token).safeTransfer(to, amount);
    }
}
