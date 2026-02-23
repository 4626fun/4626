// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {CreatorOVault} from "../contracts/vault/CreatorOVault.sol";
import {CreatorOVaultAdminModule} from "../contracts/vault/modules/CreatorOVaultAdminModule.sol";
import {CreatorOVaultCoreModule} from "../contracts/vault/modules/CreatorOVaultCoreModule.sol";
import {CreatorOVaultStrategiesModule} from "../contracts/vault/modules/CreatorOVaultStrategiesModule.sol";

contract MockCreatorCoinCooldown is ERC20 {
    constructor() ERC20("Creator Coin", "CR8R") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract CreatorOVaultWithdrawDelayTransferGriefingTest is Test {
    address internal attacker = makeAddr("attacker");
    address internal victim = makeAddr("victim");

    address internal coreModule;
    address internal strategiesModule;
    address internal adminModule;

    function setUp() public {
        coreModule = address(new CreatorOVaultCoreModule());
        strategiesModule = address(new CreatorOVaultStrategiesModule());
        adminModule = address(new CreatorOVaultAdminModule());
    }

    function _deploy() internal returns (MockCreatorCoinCooldown coin, CreatorOVault vault) {
        coin = new MockCreatorCoinCooldown();
        vault = new CreatorOVault(address(coin), address(this), "Creator OVault", "ovTEST");
        vault.setModulesOnce(coreModule, strategiesModule, adminModule);
    }

    function _approve(address who, IERC20 token, address spender) internal {
        vm.prank(who);
        token.approve(spender, type(uint256).max);
    }

    function test_transfer_blocked_duringCooldown() external {
        (MockCreatorCoinCooldown coin, CreatorOVault vault) = _deploy();

        uint256 bootstrap = vault.MINIMUM_FIRST_DEPOSIT();
        coin.mint(attacker, bootstrap);
        _approve(attacker, coin, address(vault));

        // First deposit mints shares and sets lastDepositBlock[attacker] = block.number.
        vm.prank(attacker);
        vault.deposit(bootstrap, attacker);

        uint256 currentBlock = block.number;
        uint256 requiredBlock = currentBlock + vault.withdrawDelayBlocks();

        // Same-block share transfers out must be blocked, otherwise `deposit -> transfer -> withdraw` bypasses.
        vm.prank(attacker);
        vm.expectRevert(
            abi.encodeWithSelector(CreatorOVault.TransferTooSoon.selector, currentBlock, requiredBlock)
        );
        vault.transfer(victim, 1);
    }

    function test_transferAfterCooldown_doesNotUpdateRecipientLastDepositBlock_andVictimCanWithdraw() external {
        (MockCreatorCoinCooldown coin, CreatorOVault vault) = _deploy();

        uint256 bootstrap = vault.MINIMUM_FIRST_DEPOSIT();
        uint256 smallDeposit = 10e18;

        coin.mint(attacker, bootstrap + smallDeposit);
        coin.mint(victim, smallDeposit);
        _approve(attacker, coin, address(vault));
        _approve(victim, coin, address(vault));

        // Block 1: bootstrap the vault and give attacker shares.
        vm.prank(attacker);
        vault.deposit(bootstrap, attacker);

        // Block 2: victim deposits; their cooldown is now tied to their own activity.
        vm.roll(block.number + 1);
        vm.prank(victim);
        vault.deposit(smallDeposit, victim);
        uint256 victimLastDeposit = vault.lastDepositBlock(victim);

        // Block 3: attacker refreshes their own cooldown state by minting shares again.
        vm.roll(block.number + 1);
        vm.prank(attacker);
        vault.deposit(smallDeposit, attacker);

        // Block 4: after cooldown passes, attacker can transfer dust shares to victim.
        vm.roll(block.number + vault.withdrawDelayBlocks());
        vm.prank(attacker);
        vault.transfer(victim, 1);

        // Recipient cooldown state must not change due to arbitrary incoming transfers.
        assertEq(vault.lastDepositBlock(victim), victimLastDeposit, "victim lastDepositBlock should not change");

        // Victim can still withdraw (cooldown based only on their own deposit).
        vm.prank(victim);
        vault.withdraw(1e18, victim, victim);
    }
}

