// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../contracts/vault/CreatorOVault.sol";

contract MockCreatorCoinForWithdrawDelay is ERC20 {
    constructor() ERC20("Creator Coin", "CR8R") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract CreatorOVaultWithdrawDelayTest is Test {
    uint256 internal constant INITIAL_DEPOSIT = 6_000_000e18;
    uint256 internal constant WITHDRAW_DELAY_BLOCKS = 1;
    uint256 internal constant SMALL_WITHDRAW_ASSETS = 1_000e18;

    MockCreatorCoinForWithdrawDelay internal creatorCoin;
    CreatorOVault internal vault;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        creatorCoin = new MockCreatorCoinForWithdrawDelay();
        vault = new CreatorOVault(address(creatorCoin), address(this), "Creator OVault", "ovCR8R");

        vault.setFlashLoanProtection(WITHDRAW_DELAY_BLOCKS, type(uint128).max, 2);

        creatorCoin.mint(alice, INITIAL_DEPOSIT * 2);
        creatorCoin.mint(bob, INITIAL_DEPOSIT * 2);

        vm.prank(alice);
        creatorCoin.approve(address(vault), type(uint256).max);

        vm.prank(bob);
        creatorCoin.approve(address(vault), type(uint256).max);
    }

    function test_transferedSharesCannotRedeemUntilDelayExpires() public {
        vm.prank(alice);
        uint256 mintedShares = vault.deposit(INITIAL_DEPOSIT, alice);
        uint256 depositBlock = block.number;

        uint256 transferredShares = mintedShares / 2;
        uint256 requiredBlock = depositBlock + WITHDRAW_DELAY_BLOCKS;

        // New semantics: the cooldown is enforced on transfers out, so freshly-minted shares cannot
        // be moved to another address to bypass the withdrawal delay.
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(CreatorOVault.TransferTooSoon.selector, depositBlock, requiredBlock)
        );
        vault.transfer(bob, transferredShares);

        // After the delay, the transfer succeeds and the recipient does NOT inherit sender cooldown state.
        vm.roll(requiredBlock);
        vm.prank(alice);
        vault.transfer(bob, transferredShares);
        assertEq(vault.lastDepositBlock(bob), 0);

        uint256 bobBalanceBefore = creatorCoin.balanceOf(bob);
        uint256 sharesToRedeem = transferredShares / 2;
        vm.prank(bob);
        uint256 assetsOut = vault.redeem(sharesToRedeem, bob, bob);

        assertGt(assetsOut, 0);
        assertEq(creatorCoin.balanceOf(bob), bobBalanceBefore + assetsOut);
    }

    function test_transferedSharesCannotWithdrawUntilDelayExpires() public {
        vm.prank(alice);
        uint256 mintedShares = vault.deposit(INITIAL_DEPOSIT, alice);
        uint256 depositBlock = block.number;

        uint256 transferredShares = mintedShares / 2;
        uint256 requiredBlock = depositBlock + WITHDRAW_DELAY_BLOCKS;

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(CreatorOVault.TransferTooSoon.selector, depositBlock, requiredBlock)
        );
        vault.transfer(bob, transferredShares);

        vm.roll(requiredBlock);
        vm.prank(alice);
        vault.transfer(bob, transferredShares);
        assertEq(vault.lastDepositBlock(bob), 0);

        uint256 bobBalanceBefore = creatorCoin.balanceOf(bob);
        vm.prank(bob);
        uint256 sharesSpent = vault.withdraw(SMALL_WITHDRAW_ASSETS, bob, bob);

        assertGt(sharesSpent, 0);
        assertEq(creatorCoin.balanceOf(bob), bobBalanceBefore + SMALL_WITHDRAW_ASSETS);
    }

    function test_transferDoesNotReduceRecipientDelay_whenRecipientIsNewer() public {
        vm.prank(alice);
        uint256 aliceShares = vault.deposit(INITIAL_DEPOSIT, alice);
        uint256 aliceDepositBlock = vault.lastDepositBlock(alice);

        // Use an explicit target to avoid relying on implicit block-number behavior in the test harness.
        vm.roll(aliceDepositBlock + 100);

        vm.prank(bob);
        vault.deposit(100_000e18, bob);
        uint256 bobDepositBlock = vault.lastDepositBlock(bob);
        assertGt(bobDepositBlock, aliceDepositBlock);

        vm.prank(alice);
        vault.transfer(bob, aliceShares / 10);

        assertEq(vault.lastDepositBlock(bob), bobDepositBlock);
    }
}
