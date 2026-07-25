// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {AgentOVault} from "@4626/agent/vault/AgentOVault.sol";
import {AgentOVaultCoreModule} from "@4626/agent/vault/modules/AgentOVaultCoreModule.sol";
import {CreatorOVaultCoreModule} from "@4626/creator/vault/modules/CreatorOVaultCoreModule.sol";
import {OVaultAdminModule} from "@4626/shared/vault/modules/OVaultAdminModule.sol";
import {OVaultStrategiesModule} from "@4626/shared/vault/modules/OVaultStrategiesModule.sol";
import {MockAgentTokenV4} from "test/mocks/MockAgentTokenV4.sol";

/// @notice ODA-480-[3] lane parity: the agent lane's measured-transfer `deposit()`
///         override must apply the same withdraw-cooldown policy as the creator-lane
///         base module. See test/CreatorOVault.WithdrawDelayTransferGriefing.t.sol for
///         the creator-lane originals these cases mirror.
contract ODA480AgentCooldownParityTest is Test {
    uint256 internal constant FEE_BPS = 1_000; // 10% transfer tax

    address internal attacker = makeAddr("attacker");
    address internal victim = makeAddr("victim");

    address internal agentCoreModule;
    address internal strategiesModule;
    address internal adminModule;

    function setUp() public {
        agentCoreModule = address(new AgentOVaultCoreModule());
        strategiesModule = address(new OVaultStrategiesModule());
        adminModule = address(new OVaultAdminModule());
    }

    function _deploy() internal returns (MockAgentTokenV4 coin, AgentOVault vault) {
        coin = new MockAgentTokenV4("Agent Token V4", "AGNT", uint16(FEE_BPS), 0);
        vault = new AgentOVault(address(coin), address(this), "Agent OVault", "aoAGNT");
        vault.setModulesOnce(agentCoreModule, strategiesModule, adminModule);
    }

    /// @dev Gross up so the post-tax receipt still clears the first-deposit minimum.
    function _bootstrapNominal(AgentOVault vault) internal view returns (uint256) {
        return (vault.MINIMUM_FIRST_DEPOSIT() * 10_000) / (10_000 - FEE_BPS) + 1e18;
    }

    function _fund(MockAgentTokenV4 coin, AgentOVault vault, address who, uint256 amount) internal {
        coin.mint(who, amount);
        vm.prank(who);
        coin.approve(address(vault), type(uint256).max);
    }

    /// ODA-480-[3]: third-party `deposit(assets, victim)` must not refresh an existing
    /// holder's cooldown on the agent lane either.
    function test_agentLane_depositToVictim_doesNotRefreshVictimLastDepositBlock() external {
        (MockAgentTokenV4 coin, AgentOVault vault) = _deploy();

        uint256 bootstrap = _bootstrapNominal(vault);
        uint256 smallDeposit = 10e18;

        _fund(coin, vault, attacker, bootstrap + smallDeposit);
        _fund(coin, vault, victim, smallDeposit);

        vm.prank(attacker);
        vault.deposit(bootstrap, attacker);

        // Victim's cooldown is tied to their own activity.
        vm.roll(block.number + 1);
        vm.prank(victim);
        vault.deposit(smallDeposit, victim);
        uint256 victimLastDeposit = vault.lastDepositBlock(victim);
        assertGt(vault.balanceOf(victim), 0, "victim must already hold shares");

        vm.roll(block.number + vault.withdrawDelayBlocks());
        vm.prank(attacker);
        vault.deposit(smallDeposit, victim);

        assertEq(vault.lastDepositBlock(victim), victimLastDeposit, "third-party deposit-to must not grief cooldown");

        // Cooldown was not extended, so the victim can still exit.
        vm.prank(victim);
        vault.withdraw(1e18, victim, victim);
    }

    /// Self-deposit must stamp the cooldown (flash-loan / same-block exit guard).
    function test_agentLane_selfDeposit_stampsCooldown() external {
        (MockAgentTokenV4 coin, AgentOVault vault) = _deploy();

        uint256 bootstrap = _bootstrapNominal(vault);
        uint256 smallDeposit = 10e18;
        _fund(coin, vault, attacker, bootstrap + smallDeposit);

        vm.prank(attacker);
        vault.deposit(bootstrap, attacker);
        assertEq(vault.lastDepositBlock(attacker), block.number, "first self-deposit must stamp cooldown");

        vm.roll(block.number + vault.withdrawDelayBlocks() + 1);
        vm.prank(attacker);
        vault.deposit(smallDeposit, attacker);

        assertEq(vault.lastDepositBlock(attacker), block.number, "repeat self-deposit must refresh cooldown");
    }

    /// Deposit-to a receiver with zero prior shares must stamp cooldown, otherwise the
    /// agent lane would mint immediately-redeemable shares to a fresh wallet.
    function test_agentLane_depositToFreshReceiver_stampsCooldown() external {
        (MockAgentTokenV4 coin, AgentOVault vault) = _deploy();

        uint256 bootstrap = _bootstrapNominal(vault);
        uint256 smallDeposit = 10e18;
        address freshReceiver = makeAddr("freshReceiver");

        _fund(coin, vault, attacker, bootstrap + smallDeposit);

        vm.prank(attacker);
        vault.deposit(bootstrap, attacker);

        vm.roll(block.number + vault.withdrawDelayBlocks());
        vm.prank(attacker);
        vault.deposit(smallDeposit, freshReceiver);

        assertEq(vault.lastDepositBlock(freshReceiver), block.number, "empty receiver must get cooldown");

        vm.prank(freshReceiver);
        vm.expectRevert();
        vault.withdraw(1e18, freshReceiver, freshReceiver);
    }
}
