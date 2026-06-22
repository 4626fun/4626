// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";

import {CreatorOVault} from "../contracts/vault/CreatorOVault.sol";
import {CreatorOVaultCoreModule} from "../contracts/vault/modules/CreatorOVaultCoreModule.sol";
import {CreatorOVaultStrategiesModule} from "../contracts/vault/modules/CreatorOVaultStrategiesModule.sol";
import {CreatorOVaultAdminModule} from "../contracts/vault/modules/CreatorOVaultAdminModule.sol";
import {IStrategy} from "../contracts/interfaces/IStrategy.sol";
import {IStrategyValuation} from "../contracts/interfaces/IStrategyValuation.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockMigrateCoin is IERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public totalSupply;

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }
}

contract MigrateMockStrategy is IStrategy, IStrategyValuation {
    IERC20 public immutable TOKEN;
    uint256 public trackedAssets;

    constructor(address token_) {
        TOKEN = IERC20(token_);
    }

    function setTrackedAssetsForTest(uint256 amount) external {
        trackedAssets = amount;
    }

    function isValuationReady() external pure override returns (bool) {
        return true;
    }

    function isActive() external pure override returns (bool) {
        return true;
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
        if (withdrawn > 0) require(TOKEN.transfer(msg.sender, withdrawn), "transfer failed");
    }

    function harvest() external pure override returns (uint256) {
        return 0;
    }

    function rebalance() external override {}
}

/// @notice Regression test: migrateStrategy must not permanently lock nonReentrant.
/// @dev Before fix, migrateStrategy used _delegate() (assembly return) which skips
///      the nonReentrant epilogue, leaving _status = ENTERED permanently.
contract MigrateStrategyReentrancyTest is Test {
    MockMigrateCoin internal coin;
    CreatorOVault internal vault;
    MigrateMockStrategy internal oldStrategy;
    MigrateMockStrategy internal newStrategy;
    address internal alice = makeAddr("alice");

    function setUp() public {
        coin = new MockMigrateCoin();
        vault = new CreatorOVault(address(coin), address(this), "Creator OVault", "ovCR8R");
        vault.setModulesOnce(
            address(new CreatorOVaultCoreModule()),
            address(new CreatorOVaultStrategiesModule()),
            address(new CreatorOVaultAdminModule())
        );
        vault.setFlashLoanProtection(0, type(uint256).max, 1);

        oldStrategy = new MigrateMockStrategy(address(coin));
        newStrategy = new MigrateMockStrategy(address(coin));

        vault.addStrategy(address(oldStrategy), 10_000, true);

        uint256 depositAmount = vault.MINIMUM_FIRST_DEPOSIT() * 2;
        coin.mint(alice, depositAmount + 500_000e18);
        vm.prank(alice);
        coin.approve(address(vault), type(uint256).max);
        vm.prank(alice);
        vault.deposit(depositAmount, alice);
    }

    /// @dev After migrateStrategy, deposit must still work (nonReentrant must reset).
    function test_migrateStrategy_doesNotLockReentrancyGuard() external {
        // Pre-condition: deposit works before migrate
        uint256 depAmount = 100e18;
        vm.prank(alice);
        vault.deposit(depAmount, alice);

        // Migrate strategy
        vault.migrateStrategy(address(oldStrategy), address(newStrategy), 10_000, true);

        // Post-condition: deposit must still work after migrate
        vm.prank(alice);
        vault.deposit(depAmount, alice);
    }

    /// @dev After migrateStrategy, report must still work (nonReentrant must reset).
    function test_migrateStrategy_doesNotLockReentrancyGuard_report() external {
        vault.migrateStrategy(address(oldStrategy), address(newStrategy), 10_000, true);

        // report() is nonReentrant — if _status is stuck ENTERED, this reverts
        address keeper = makeAddr("keeper");
        vault.setKeeper(keeper);
        vm.prank(keeper);
        vault.report();
    }
}
