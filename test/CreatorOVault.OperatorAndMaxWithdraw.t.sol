// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {CreatorOVault} from "../contracts/vault/CreatorOVault.sol";
import {CreatorOVaultAdminModule} from "../contracts/vault/modules/CreatorOVaultAdminModule.sol";
import {CreatorOVaultCoreModule} from "../contracts/vault/modules/CreatorOVaultCoreModule.sol";
import {CreatorOVaultStrategiesModule} from "../contracts/vault/modules/CreatorOVaultStrategiesModule.sol";
import {IStrategy} from "../contracts/interfaces/IStrategy.sol";
import {IStrategyValuation} from "../contracts/interfaces/IStrategyValuation.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockCreatorCoinOp is ERC20 {
    constructor() ERC20("Creator Coin", "CR8R") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract IdleLockStrategy is IStrategy, IStrategyValuation {
    IERC20 public immutable TOKEN;
    uint256 public tracked;

    constructor(address token_) {
        TOKEN = IERC20(token_);
    }

    function isValuationReady() external pure returns (bool) {
        return true;
    }

    function isActive() external pure returns (bool) {
        return true;
    }

    function asset() external view returns (address) {
        return address(TOKEN);
    }

    function getTotalAssets() external view returns (uint256) {
        return tracked;
    }

    function deposit(uint256 amount) external returns (uint256) {
        require(TOKEN.transferFrom(msg.sender, address(this), amount), "xfer");
        tracked += amount;
        return amount;
    }

    function withdraw(uint256 amount) external returns (uint256) {
        uint256 out = amount > tracked ? tracked : amount;
        tracked -= out;
        require(TOKEN.transfer(msg.sender, out), "xfer");
        return out;
    }

    function emergencyWithdraw() external returns (uint256) {
        uint256 out = tracked;
        tracked = 0;
        if (out > 0) require(TOKEN.transfer(msg.sender, out), "xfer");
        return out;
    }

    function harvest() external pure returns (uint256) {
        return 0;
    }

    function rebalance() external {}
}

/// @notice AUDIT-2026-07-01-M04 / M-05 — operator bitmask enforcement + maxWithdraw liquidity cap.
contract CreatorOVaultOperatorAndMaxWithdrawTest is Test {
    uint256 internal constant OP_DEPOSIT = 1 << 0;
    uint256 internal constant OP_WITHDRAW = 1 << 1;

    MockCreatorCoinOp internal creatorCoin;
    CreatorOVault internal vault;
    IdleLockStrategy internal strategy;

    address internal alice = makeAddr("alice");
    address internal operator = makeAddr("operator");

    function setUp() public {
        creatorCoin = new MockCreatorCoinOp();
        vault = new CreatorOVault(address(creatorCoin), address(this), "Creator OVault", "ovCR8R");

        address coreModule = address(new CreatorOVaultCoreModule());
        address strategiesModule = address(new CreatorOVaultStrategiesModule());
        address adminModule = address(new CreatorOVaultAdminModule());
        vault.setModulesOnce(coreModule, strategiesModule, adminModule);

        strategy = new IdleLockStrategy(address(creatorCoin));
        vault.addStrategy(address(strategy), 10_000, true);

        creatorCoin.mint(alice, 50_000_000e18);
        vm.startPrank(alice);
        creatorCoin.approve(address(vault), type(uint256).max);
        vault.deposit(50_000_000e18, alice);
        vm.stopPrank();

        vault.setMinimumTotalIdle(45_000_000e18);
        vault.deployToStrategies();
        vault.setProfitMaxUnlockTime(0);
        vault.report();
    }

    function test_operatorWithDepositOnly_cannotWithdraw() public {
        vault.setOperatorPerms(operator, OP_DEPOSIT);

        vm.startPrank(operator);
        vm.expectRevert(
            abi.encodeWithSelector(CreatorOVaultCoreModule.OperatorPermissionDenied.selector, operator, OP_WITHDRAW)
        );
        vault.withdraw(1e18, operator, alice);
        vm.stopPrank();
    }

    function test_ungrantedOperator_canStillDeposit() public {
        address depositor = makeAddr("depositor");
        creatorCoin.mint(depositor, 10e18);
        vm.startPrank(depositor);
        creatorCoin.approve(address(vault), type(uint256).max);
        vault.deposit(10e18, depositor);
        vm.stopPrank();
        assertGt(vault.balanceOf(depositor), 0);
    }

    function test_maxWithdraw_cappedByInstantLiquidity() public view {
        uint256 maxAssets = vault.maxWithdraw(alice);
        assertLt(maxAssets, vault.totalAssets(), "instant cap should be below total assets");
        assertLe(maxAssets, vault.coinBalance(), "instant cap should not exceed idle above reserve");
    }
}
