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

contract MockCreatorCoinForValuationGuard is ERC20 {
    constructor() ERC20("Creator Coin", "CR8R") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockValuationStrategy is IStrategy, IStrategyValuation {
    IERC20 public immutable TOKEN;

    bool public active = true;
    bool public valuationReady = true;
    uint256 public trackedAssets;

    constructor(address token_) {
        TOKEN = IERC20(token_);
    }

    function setValuationReady(bool ready) external {
        valuationReady = ready;
    }

    function setTrackedAssets(uint256 assets) external {
        trackedAssets = assets;
    }

    function isValuationReady() external view override returns (bool) {
        return valuationReady;
    }

    function isActive() external view override returns (bool) {
        return active;
    }

    function asset() external view override returns (address) {
        return address(TOKEN);
    }

    function getTotalAssets() external view override returns (uint256) {
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

contract MockValuationReadyButAssetsRevertStrategy is IStrategy, IStrategyValuation {
    IERC20 public immutable TOKEN;
    bool public active = true;

    constructor(address token_) {
        TOKEN = IERC20(token_);
    }

    function isValuationReady() external pure override returns (bool) {
        return true;
    }

    function isActive() external view override returns (bool) {
        return active;
    }

    function asset() external view override returns (address) {
        return address(TOKEN);
    }

    function getTotalAssets() external pure override returns (uint256) {
        revert("ASSETS_REVERT");
    }

    function deposit(uint256 amount) external pure override returns (uint256 deposited) {
        deposited = amount;
    }

    function withdraw(uint256 amount) external pure override returns (uint256 withdrawn) {
        withdrawn = amount;
    }

    function emergencyWithdraw() external pure override returns (uint256 withdrawn) {
        withdrawn = 0;
    }

    function harvest() external pure override returns (uint256 profit) {
        profit = 0;
    }

    function rebalance() external pure override {}
}

contract MockNoValuationInterfaceStrategy is IStrategy {
    IERC20 public immutable TOKEN;
    bool public active = true;
    uint256 public trackedAssets;

    constructor(address token_) {
        TOKEN = IERC20(token_);
    }

    function isActive() external view override returns (bool) {
        return active;
    }

    function asset() external view override returns (address) {
        return address(TOKEN);
    }

    function getTotalAssets() external view override returns (uint256) {
        return trackedAssets;
    }

    function deposit(uint256 amount) external pure override returns (uint256 deposited) {
        deposited = amount;
    }

    function withdraw(uint256 amount) external pure override returns (uint256 withdrawn) {
        withdrawn = amount;
    }

    function emergencyWithdraw() external pure override returns (uint256 withdrawn) {
        withdrawn = 0;
    }

    function harvest() external pure override returns (uint256 profit) {
        profit = 0;
    }

    function rebalance() external pure override {}
}

contract CreatorOVaultValuationGuardTest is Test {
    bytes4 private constant STRATEGY_VALUATION_NOT_READY_SELECTOR =
        bytes4(keccak256("StrategyValuationNotReady(address)"));

    MockCreatorCoinForValuationGuard internal creatorCoin;
    CreatorOVault internal vault;
    MockValuationStrategy internal strategy;

    address internal coreModule;
    address internal strategiesModule;
    address internal adminModule;

    address internal alice = makeAddr("alice");

    function setUp() public {
        creatorCoin = new MockCreatorCoinForValuationGuard();
        vault = new CreatorOVault(address(creatorCoin), address(this), "Creator OVault", "ovCR8R");

        coreModule = address(new CreatorOVaultCoreModule());
        strategiesModule = address(new CreatorOVaultStrategiesModule());
        adminModule = address(new CreatorOVaultAdminModule());
        vault.setModulesOnce(coreModule, strategiesModule, adminModule);

        strategy = new MockValuationStrategy(address(creatorCoin));
        vault.addStrategy(address(strategy), 10_000, true);

        creatorCoin.mint(alice, vault.MINIMUM_FIRST_DEPOSIT() * 4);
        vm.prank(alice);
        creatorCoin.approve(address(vault), type(uint256).max);
    }

    function test_maxDepositAndMaxMint_returnZero_whenStrategyValuationNotReady() external {
        strategy.setValuationReady(false);

        assertEq(vault.maxDeposit(alice), 0, "maxDeposit should be 0 when valuation not ready");
        assertEq(vault.maxMint(alice), 0, "maxMint should be 0 when valuation not ready");
    }

    function test_deposit_reverts_whenStrategyValuationNotReady() external {
        strategy.setValuationReady(false);

        uint256 assets = vault.MINIMUM_FIRST_DEPOSIT() * 2;
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(STRATEGY_VALUATION_NOT_READY_SELECTOR, address(strategy)));
        vault.deposit(assets, alice);
    }

    function test_mint_reverts_whenStrategyValuationNotReady() external {
        strategy.setValuationReady(false);

        uint256 assets = vault.MINIMUM_FIRST_DEPOSIT() * 2;
        uint256 shares = assets * 1000; // _decimalsOffset() = 3

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(STRATEGY_VALUATION_NOT_READY_SELECTOR, address(strategy)));
        vault.mint(shares, alice);
    }

    function test_deposit_succeeds_whenStrategyValuationReady() external {
        strategy.setValuationReady(true);

        uint256 assets = vault.MINIMUM_FIRST_DEPOSIT() * 2;
        vm.prank(alice);
        uint256 shares = vault.deposit(assets, alice);
        assertGt(shares, 0);
    }

    function test_deposit_reverts_whenStrategyGetTotalAssetsReverts_evenIfValuationReady() external {
        CreatorOVault freshVault = new CreatorOVault(address(creatorCoin), address(this), "Creator OVault 2", "ovCR8R2");
        freshVault.setModulesOnce(coreModule, strategiesModule, adminModule);
        MockValuationReadyButAssetsRevertStrategy bad =
            new MockValuationReadyButAssetsRevertStrategy(address(creatorCoin));
        freshVault.addStrategy(address(bad), 10_000, true);

        creatorCoin.mint(alice, freshVault.MINIMUM_FIRST_DEPOSIT() * 4);
        vm.prank(alice);
        creatorCoin.approve(address(freshVault), type(uint256).max);

        assertEq(freshVault.maxDeposit(alice), 0, "maxDeposit should be 0 when valuation reads revert");
        assertEq(freshVault.maxMint(alice), 0, "maxMint should be 0 when valuation reads revert");

        uint256 assets = freshVault.MINIMUM_FIRST_DEPOSIT() * 2;
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(STRATEGY_VALUATION_NOT_READY_SELECTOR, address(bad)));
        freshVault.deposit(assets, alice);

        uint256 shares = assets * 1000; // _decimalsOffset() = 3
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(STRATEGY_VALUATION_NOT_READY_SELECTOR, address(bad)));
        freshVault.mint(shares, alice);
    }

    function test_deposit_reverts_whenStrategyMissingIStrategyValuation() external {
        CreatorOVault freshVault = new CreatorOVault(address(creatorCoin), address(this), "Creator OVault 3", "ovCR8R3");
        freshVault.setModulesOnce(coreModule, strategiesModule, adminModule);
        MockNoValuationInterfaceStrategy bad = new MockNoValuationInterfaceStrategy(address(creatorCoin));
        freshVault.addStrategy(address(bad), 10_000, true);

        creatorCoin.mint(alice, freshVault.MINIMUM_FIRST_DEPOSIT() * 4);
        vm.prank(alice);
        creatorCoin.approve(address(freshVault), type(uint256).max);

        assertEq(freshVault.maxDeposit(alice), 0, "maxDeposit should be 0 when valuation interface missing");
        assertEq(freshVault.maxMint(alice), 0, "maxMint should be 0 when valuation interface missing");

        uint256 assets = freshVault.MINIMUM_FIRST_DEPOSIT() * 2;
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(STRATEGY_VALUATION_NOT_READY_SELECTOR, address(bad)));
        freshVault.deposit(assets, alice);

        uint256 shares = assets * 1000; // _decimalsOffset() = 3
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(STRATEGY_VALUATION_NOT_READY_SELECTOR, address(bad)));
        freshVault.mint(shares, alice);
    }
}

