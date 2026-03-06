// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../contracts/vault/CreatorOVault.sol";
import {CreatorOVaultAdminModule} from "../contracts/vault/modules/CreatorOVaultAdminModule.sol";
import {CreatorOVaultCoreModule} from "../contracts/vault/modules/CreatorOVaultCoreModule.sol";
import {CreatorOVaultStrategiesModule} from "../contracts/vault/modules/CreatorOVaultStrategiesModule.sol";

contract MockCreatorCoinEvents is ERC20 {
    constructor() ERC20("Creator Coin", "CR8R") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

abstract contract CreatorOVaultEventsTestBase is Test {
    address internal coreModule;
    address internal strategiesModule;
    address internal adminModule;

    function setUp() public virtual {
        coreModule = address(new CreatorOVaultCoreModule());
        strategiesModule = address(new CreatorOVaultStrategiesModule());
        adminModule = address(new CreatorOVaultAdminModule());
    }

    function _setVaultModules(CreatorOVault vault) internal {
        vault.setModulesOnce(coreModule, strategiesModule, adminModule);
    }
}

contract CreatorOVaultEventsTest is CreatorOVaultEventsTestBase {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);

    address internal alice = makeAddr("alice");

    MockCreatorCoinEvents internal creatorCoin;
    CreatorOVault internal vault;

    function setUp() public override {
        super.setUp();

        creatorCoin = new MockCreatorCoinEvents();
        vault = new CreatorOVault(address(creatorCoin), address(this), "Creator OVault", "ovCR8R");
        _setVaultModules(vault);
        vault.setFlashLoanProtection(0, type(uint256).max, 1);
    }

    function test_deposit_emitsTransferAndDeposit() external {
        uint256 assets = vault.MINIMUM_FIRST_DEPOSIT();
        uint256 shares = vault.previewDeposit(assets);

        creatorCoin.mint(alice, assets);
        vm.prank(alice);
        creatorCoin.approve(address(vault), type(uint256).max);

        vm.expectEmit(true, true, false, true, address(vault));
        emit Transfer(address(0), alice, shares);
        vm.expectEmit(true, true, false, true, address(vault));
        emit Deposit(alice, alice, assets, shares);

        vm.prank(alice);
        vault.deposit(assets, alice);
    }

    function test_mint_emitsTransferAndDeposit() external {
        uint256 assets = vault.MINIMUM_FIRST_DEPOSIT();
        uint256 shares = assets * 1000;

        assertEq(vault.previewMint(shares), assets);

        creatorCoin.mint(alice, assets);
        vm.prank(alice);
        creatorCoin.approve(address(vault), type(uint256).max);

        vm.expectEmit(true, true, false, true, address(vault));
        emit Transfer(address(0), alice, shares);
        vm.expectEmit(true, true, false, true, address(vault));
        emit Deposit(alice, alice, assets, shares);

        vm.prank(alice);
        vault.mint(shares, alice);
    }

    function test_withdraw_emitsTransferAndWithdraw() external {
        uint256 assets = vault.MINIMUM_FIRST_DEPOSIT() * 2;
        creatorCoin.mint(alice, assets);

        vm.startPrank(alice);
        creatorCoin.approve(address(vault), type(uint256).max);
        vault.deposit(assets, alice);
        vm.stopPrank();

        uint256 withdrawAssets = 100e18;
        uint256 shares = vault.previewWithdraw(withdrawAssets);

        vm.expectEmit(true, true, false, true, address(vault));
        emit Transfer(alice, address(0), shares);
        vm.expectEmit(true, true, true, true, address(vault));
        emit Withdraw(alice, alice, alice, withdrawAssets, shares);

        vm.prank(alice);
        vault.withdraw(withdrawAssets, alice, alice);
    }

    function test_redeem_emitsTransferAndWithdraw() external {
        uint256 assets = vault.MINIMUM_FIRST_DEPOSIT() * 2;
        creatorCoin.mint(alice, assets);

        vm.startPrank(alice);
        creatorCoin.approve(address(vault), type(uint256).max);
        vault.deposit(assets, alice);
        vm.stopPrank();

        uint256 shares = vault.balanceOf(alice) / 10;
        uint256 redeemAssets = vault.previewRedeem(shares);

        vm.expectEmit(true, true, false, true, address(vault));
        emit Transfer(alice, address(0), shares);
        vm.expectEmit(true, true, true, true, address(vault));
        emit Withdraw(alice, alice, alice, redeemAssets, shares);

        vm.prank(alice);
        vault.redeem(shares, alice, alice);
    }

    // Large queued withdrawals intentionally use WithdrawalQueued/WithdrawalClaimed instead
    // of the standard ERC-4626 Withdraw event path. These tests cover only the normal entrypoints.
}
