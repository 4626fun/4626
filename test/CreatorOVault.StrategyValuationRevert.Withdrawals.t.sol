// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../contracts/vault/CreatorOVault.sol";
import {CreatorOVaultAdminModule} from "../contracts/vault/modules/CreatorOVaultAdminModule.sol";
import {CreatorOVaultCoreModule} from "../contracts/vault/modules/CreatorOVaultCoreModule.sol";
import {CreatorOVaultStrategiesModule} from "../contracts/vault/modules/CreatorOVaultStrategiesModule.sol";
import "../contracts/interfaces/IStrategy.sol";
import "../contracts/interfaces/IStrategyValuation.sol";

contract MockCreatorCoinForValuationRevertWithdrawals is ERC20 {
    constructor() ERC20("Creator Coin", "CR8R") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockValuationStrategyRevertsTotalAssets is IStrategy, IStrategyValuation {
    IERC20 public immutable TOKEN;

    bool public active = true;
    bool public revertOnGetTotalAssets;
    uint256 public trackedAssets;

    constructor(address token_) {
        TOKEN = IERC20(token_);
    }

    function setRevertOnGetTotalAssets(bool value) external {
        revertOnGetTotalAssets = value;
    }

    function isValuationReady() external view override returns (bool) {
        // Match vault guard expectations: if `getTotalAssets()` would revert, valuation is not ready.
        return !revertOnGetTotalAssets;
    }

    function isActive() external view override returns (bool) {
        return active;
    }

    function asset() external view override returns (address) {
        return address(TOKEN);
    }

    function getTotalAssets() external view override returns (uint256) {
        if (revertOnGetTotalAssets) revert("GET_TOTAL_ASSETS_REVERT");
        return trackedAssets;
    }

    function deposit(uint256 amount) external override returns (uint256 deposited) {
        if (amount == 0) return 0;
        require(TOKEN.transferFrom(msg.sender, address(this), amount), "transferFrom failed");
        trackedAssets += amount;
        return amount;
    }

    function withdraw(uint256 amount) external override returns (uint256 withdrawn) {
        withdrawn = amount > trackedAssets ? trackedAssets : amount;
        if (withdrawn == 0) return 0;
        trackedAssets -= withdrawn;
        require(TOKEN.transfer(msg.sender, withdrawn), "transfer failed");
    }

    function emergencyWithdraw() external override returns (uint256 withdrawn) {
        withdrawn = trackedAssets;
        trackedAssets = 0;
        if (withdrawn > 0) {
            require(TOKEN.transfer(msg.sender, withdrawn), "transfer failed");
        }
    }

    function harvest() external pure override returns (uint256 profit) {
        return 0;
    }

    function rebalance() external override {}
}

contract CreatorOVaultStrategyValuationRevertWithdrawalsTest is Test {
    MockCreatorCoinForValuationRevertWithdrawals internal creatorCoin;
    CreatorOVault internal vault;
    MockValuationStrategyRevertsTotalAssets internal strategy;

    address internal alice = makeAddr("alice");

    function setUp() public {
        creatorCoin = new MockCreatorCoinForValuationRevertWithdrawals();
        vault = new CreatorOVault(address(creatorCoin), address(this), "Creator OVault", "ovCR8R");
        vault.setModulesOnce(
            address(new CreatorOVaultCoreModule()),
            address(new CreatorOVaultStrategiesModule()),
            address(new CreatorOVaultAdminModule())
        );

        strategy = new MockValuationStrategyRevertsTotalAssets(address(creatorCoin));
        vault.addStrategy(address(strategy), 10_000, true);

        // Make synchronous withdrawals possible in tests.
        vault.setFlashLoanProtection(0, type(uint256).max, 1);

        uint256 depositAmount = vault.MINIMUM_FIRST_DEPOSIT() * 2;
        creatorCoin.mint(alice, depositAmount + 500_000e18);
        vm.prank(alice);
        creatorCoin.approve(address(vault), type(uint256).max);

        vm.prank(alice);
        vault.deposit(depositAmount, alice);

        // Push almost all idle into the strategy so withdrawals must pull liquidity from it.
        vault.forceDeployToStrategies();
        assertGt(vault.strategyDebt(address(strategy)), 0);
    }

    function test_totalAssets_fallsBackToDebt_whenStrategyGetTotalAssetsReverts() external {
        strategy.setRevertOnGetTotalAssets(true);

        uint256 expected = creatorCoin.balanceOf(address(vault)) + vault.strategyDebt(address(strategy));
        assertEq(vault.totalAssets(), expected);
    }

    function test_withdraw_succeeds_whenStrategyGetTotalAssetsReverts() external {
        strategy.setRevertOnGetTotalAssets(true);

        uint256 assetsToWithdraw = 50_000e18;
        uint256 balanceBefore = creatorCoin.balanceOf(alice);

        vm.prank(alice);
        uint256 sharesSpent = vault.withdraw(assetsToWithdraw, alice, alice);

        assertGt(sharesSpent, 0);
        assertEq(creatorCoin.balanceOf(alice), balanceBefore + assetsToWithdraw);
    }

    function test_depositAndMint_revert_whenStrategyGetTotalAssetsReverts() external {
        strategy.setRevertOnGetTotalAssets(true);

        assertEq(vault.maxDeposit(alice), 0);
        assertEq(vault.maxMint(alice), 0);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(CreatorOVault.StrategyValuationNotReady.selector, address(strategy)));
        vault.deposit(10_000e18, alice);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(CreatorOVault.StrategyValuationNotReady.selector, address(strategy)));
        vault.mint(1e18, alice);
    }
}

