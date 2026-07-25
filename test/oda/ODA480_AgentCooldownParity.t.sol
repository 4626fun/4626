// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {AgentOVault} from "@4626/agent/vault/AgentOVault.sol";
import {AgentOVaultCoreModule} from "@4626/agent/vault/modules/AgentOVaultCoreModule.sol";
import {AgentOVaultWrapper} from "@4626/agent/vault/AgentOVaultWrapper.sol";
import {CreatorOVaultCoreModule} from "@4626/creator/vault/modules/CreatorOVaultCoreModule.sol";
import {OVaultAdminModule} from "@4626/shared/vault/modules/OVaultAdminModule.sol";
import {OVaultStrategiesModule} from "@4626/shared/vault/modules/OVaultStrategiesModule.sol";
import {MockAgentTokenV4} from "test/mocks/MockAgentTokenV4.sol";

contract ODA480MockAgentShare is ERC20 {
    constructor() ERC20("Agent Share", "ASHARE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}

contract ODA480TrustedActivator {
    function depositAndTransfer(MockAgentTokenV4 coin, AgentOVault vault, uint256 amount, address recipient)
        external
    {
        coin.approve(address(vault), amount);
        uint256 shares = vault.deposit(amount, address(this));
        vault.transfer(recipient, shares);
    }
}

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

    /// Admission whitelist entries for EOAs must not reopen same-block exits.
    /// Only whitelisted *contracts* (wrapper / activator) skip the pooled stamp.
    function test_agentLane_whitelistedEoa_stillStampsCooldown() external {
        (MockAgentTokenV4 coin, AgentOVault vault) = _deploy();
        uint256 bootstrap = _bootstrapNominal(vault);
        _fund(coin, vault, attacker, bootstrap);

        vault.setWhitelist(attacker, true);

        vm.prank(attacker);
        vault.deposit(bootstrap, attacker);

        assertEq(vault.lastDepositBlock(attacker), block.number, "whitelisted EOA must still arm cooldown");
        vm.prank(attacker);
        vm.expectRevert();
        vault.withdraw(1e18, attacker, attacker);
    }

    /// Trusted activation adapters must be able to deposit and wrap/transfer the
    /// resulting shares atomically. Their vault whitelist is also the explicit
    /// trust marker for bypassing the pooled-address cooldown.
    function test_agentLane_whitelistedActivator_canTransferDepositInSameTransaction() external {
        (MockAgentTokenV4 coin, AgentOVault vault) = _deploy();
        ODA480TrustedActivator activator = new ODA480TrustedActivator();
        address recipient = makeAddr("activationRecipient");
        uint256 amount = _bootstrapNominal(vault);

        vault.setWhitelist(address(activator), true);
        coin.mint(address(activator), amount);

        activator.depositAndTransfer(coin, vault, amount, recipient);

        assertEq(vault.lastDepositBlock(address(activator)), 0, "trusted adapter must not arm pooled cooldown");
        assertGt(vault.balanceOf(recipient), 0, "activation transfer must complete");
    }

    /// A wrapper holds pooled vault shares for every ShareOFT holder. Another user's
    /// deposit must not refresh that pooled address and front-run a matured withdrawal.
    function test_agentLane_wrapperDeposit_doesNotFreezeOtherUsers() external {
        (MockAgentTokenV4 coin, AgentOVault vault) = _deploy();
        AgentOVaultWrapper wrapper = new AgentOVaultWrapper(address(coin), address(vault), address(this));
        ODA480MockAgentShare share = new ODA480MockAgentShare();
        wrapper.setShareOFT(address(share));
        vault.setWhitelist(address(wrapper), true);

        address alice = makeAddr("wrapperAlice");
        address bob = makeAddr("wrapperBob");
        uint256 aliceDeposit = _bootstrapNominal(vault) * 2;
        uint256 bobDeposit = 10e18;

        coin.mint(alice, aliceDeposit);
        vm.prank(alice);
        coin.approve(address(wrapper), type(uint256).max);
        coin.mint(bob, bobDeposit);
        vm.prank(bob);
        coin.approve(address(wrapper), type(uint256).max);

        vm.prank(alice);
        wrapper.deposit(aliceDeposit, 0);
        uint256 pooledCooldown = vault.lastDepositBlock(address(wrapper));
        assertEq(pooledCooldown, 0, "trusted wrapper must not use a global vault cooldown");

        vm.roll(block.number + wrapper.wrapperWithdrawDelayBlocks());
        vm.prank(bob);
        wrapper.deposit(bobDeposit, 0);

        assertEq(
            vault.lastDepositBlock(address(wrapper)), pooledCooldown, "one user's deposit must not freeze pooled exits"
        );

        vm.prank(alice);
        uint256 assetsOut = wrapper.withdraw(1e18, 0);
        assertGt(assetsOut, 0, "matured user withdrawal must remain available");
    }
}
