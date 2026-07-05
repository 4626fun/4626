// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {CreatorOVault} from "../contracts/vault/CreatorOVault.sol";
import {AgentOVault} from "../contracts/vault/agent/AgentOVault.sol";
import {CreatorOVaultAdminModule} from "../contracts/vault/modules/CreatorOVaultAdminModule.sol";
import {CreatorOVaultCoreModule} from "../contracts/vault/modules/CreatorOVaultCoreModule.sol";
import {AgentOVaultCoreModule} from "../contracts/vault/agent/modules/AgentOVaultCoreModule.sol";
import {CreatorOVaultStrategiesModule} from "../contracts/vault/modules/CreatorOVaultStrategiesModule.sol";
import {MockAgentTokenV4} from "./mocks/MockAgentTokenV4.sol";

/// @dev Rebasing-up / reflexive mock: credits the receiver MORE than the sent amount
///      (bonus minted on transfer). Used to prove the measured pull fails closed when
///      `received > requested`.
contract MockRebasingUpToken is ERC20 {
    uint256 public immutable bonusBps;

    constructor(uint256 bonusBps_) ERC20("Rebasing Up Token", "RBUP") {
        bonusBps = bonusBps_;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (from != address(0) && to != address(0) && value > 0) {
            uint256 bonus = (value * bonusBps) / 10_000;
            if (bonus > 0) {
                _mint(to, bonus);
            }
        }
    }
}

contract AgentOVaultTransferAccountingTest is Test {
    uint256 internal constant FEE_BPS = 1_000; // 10% transfer tax

    address internal coreModule;
    address internal agentCoreModule;
    address internal strategiesModule;
    address internal adminModule;

    MockAgentTokenV4 internal agentToken;
    AgentOVault internal vault;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        coreModule = address(new CreatorOVaultCoreModule());
        agentCoreModule = address(new AgentOVaultCoreModule());
        strategiesModule = address(new CreatorOVaultStrategiesModule());
        adminModule = address(new CreatorOVaultAdminModule());

        agentToken = new MockAgentTokenV4("Agent Token V4", "AGNT", uint16(FEE_BPS), 0);
        vault = new AgentOVault(address(agentToken), address(this), "Agent OVault", "aoAGNT");
        vault.setModulesOnce(agentCoreModule, strategiesModule, adminModule);
    }

    function _afterTax(uint256 amount) internal pure returns (uint256) {
        return amount - (amount * FEE_BPS) / 10_000;
    }

    // -----------------------------------------------------------------
    // Module identity wiring
    // -----------------------------------------------------------------

    function test_agentVault_rejects_creatorCoreModule() public {
        AgentOVault fresh = new AgentOVault(address(agentToken), address(this), "Agent OVault", "aoAGNT2");
        vm.expectRevert(CreatorOVault.InvalidModuleAddress.selector);
        fresh.setModulesOnce(coreModule, strategiesModule, adminModule);
    }

    function test_creatorVault_rejects_agentCoreModule() public {
        CreatorOVault fresh = new CreatorOVault(address(agentToken), address(this), "Creator OVault", "ovAGNT");
        vm.expectRevert(CreatorOVault.InvalidModuleAddress.selector);
        fresh.setModulesOnce(agentCoreModule, strategiesModule, adminModule);
    }

    // -----------------------------------------------------------------
    // (a) CreatorOVault exact-transfer behavior is unchanged
    //     (see also test/CreatorOVault.TransferAccounting.t.sol)
    // -----------------------------------------------------------------

    function test_creatorVault_still_reverts_on_feeOnTransfer_deposit() public {
        CreatorOVault creatorVault = new CreatorOVault(address(agentToken), address(this), "Creator OVault", "ovAGNT");
        creatorVault.setModulesOnce(coreModule, strategiesModule, adminModule);

        uint256 amount = creatorVault.MINIMUM_FIRST_DEPOSIT();
        agentToken.mint(alice, amount);
        vm.prank(alice);
        agentToken.approve(address(creatorVault), type(uint256).max);

        uint256 expectedReceived = _afterTax(amount);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(CreatorOVault.TransferAmountMismatch.selector, amount, expectedReceived)
        );
        creatorVault.deposit(amount, alice);

        assertEq(creatorVault.totalSupply(), 0);
        assertEq(creatorVault.coinBalance(), 0);
    }

    // -----------------------------------------------------------------
    // (b) + (c) AgentOVault deposit mints from measured received amount
    //     and books coinBalance / totalAssets from actual receipt
    // -----------------------------------------------------------------

    function test_agentVault_deposit_mints_shares_from_received_not_nominal() public {
        // Gross up so post-tax receipt clears the first-deposit minimum.
        uint256 nominal = (vault.MINIMUM_FIRST_DEPOSIT() * 10_000) / (10_000 - FEE_BPS) + 1e18;
        uint256 received = _afterTax(nominal);

        agentToken.mint(alice, nominal);
        vm.prank(alice);
        agentToken.approve(address(vault), type(uint256).max);

        vm.prank(alice);
        uint256 shares = vault.deposit(nominal, alice);

        // Shares priced from measured receipt with the vault's virtual-offset math
        // (decimals offset = 3): received * (0 + 1000) / (0 + 1)
        assertEq(shares, received * 1000, "shares must come from received, not nominal");
        assertEq(vault.balanceOf(alice), shares);

        // No nominal inflation anywhere in the books.
        assertEq(agentToken.balanceOf(address(vault)), received, "vault token balance");
        assertEq(vault.coinBalance(), received, "coinBalance must equal actual receipt");
        assertEq(vault.totalAssets(), received, "totalAssets must equal actual receipt");
        assertEq(vault.totalAssetsAtLastReport(), received, "report baseline must use actual receipt");
    }

    function test_agentVault_second_deposit_prices_shares_from_received() public {
        _seedFirstDeposit(alice);

        uint256 supplyBefore = vault.totalSupply();
        uint256 assetsBefore = vault.totalAssets();
        uint256 baselineBefore = vault.totalAssetsAtLastReport();
        uint256 ppsBefore = vault.pricePerShare();

        uint256 nominal = 1_000_000e18;
        uint256 received = _afterTax(nominal);

        agentToken.mint(bob, nominal);
        vm.startPrank(bob);
        agentToken.approve(address(vault), type(uint256).max);
        uint256 shares = vault.deposit(nominal, bob);
        vm.stopPrank();

        // Same virtual-offset math as previewDeposit, applied to `received`.
        uint256 expectedShares = (received * (supplyBefore + 1000)) / (assetsBefore + 1);
        assertEq(shares, expectedShares, "second deposit shares from received");
        assertEq(vault.totalAssets(), assetsBefore + received, "totalAssets grows by received");
        assertEq(vault.coinBalance(), assetsBefore + received, "coinBalance grows by received");
        assertEq(vault.totalAssetsAtLastReport(), baselineBefore + received, "baseline grows by received");

        // PPS must not be diluted by nominal-vs-received skew on the second deposit.
        assertGe(vault.pricePerShare() + 1, ppsBefore, "no PPS dilution from transfer tax");
    }

    // -----------------------------------------------------------------
    // (d) First-deposit minimum is enforced on the actual received amount
    // -----------------------------------------------------------------

    function test_agentVault_firstDeposit_minimum_uses_received_amount() public {
        // Nominal clears the minimum, but post-tax receipt does not -> must revert.
        uint256 minimum = vault.MINIMUM_FIRST_DEPOSIT();
        uint256 nominal = minimum;
        uint256 received = _afterTax(nominal);
        assertLt(received, minimum);

        agentToken.mint(alice, nominal);
        vm.prank(alice);
        agentToken.approve(address(vault), type(uint256).max);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(CreatorOVaultCoreModule.FirstDepositTooSmall.selector, received, minimum)
        );
        vault.deposit(nominal, alice);
    }

    // -----------------------------------------------------------------
    // (e) Outflow + mint policy: explicit, documented limitations
    // -----------------------------------------------------------------

    /// @dev `mint()` stays exact-transfer: with an inbound tax the pre-quoted
    ///      assets cannot fully arrive, so it reverts instead of minting
    ///      under-collateralized shares. `deposit()` is the supported inflow.
    function test_agentVault_mint_reverts_for_feeOnTransfer_token() public {
        uint256 assets = vault.MINIMUM_FIRST_DEPOSIT();
        uint256 shares = assets * 1000; // supply=0 quote with decimals offset 3

        agentToken.mint(alice, assets);
        vm.prank(alice);
        agentToken.approve(address(vault), type(uint256).max);

        uint256 expectedReceived = _afterTax(assets);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(CreatorOVault.TransferAmountMismatch.selector, assets, expectedReceived)
        );
        vault.mint(shares, alice);
    }

    /// @dev Withdraw debits the vault by exactly `assets`; the burn-on-transfer tax
    ///      hits the receiver outside vault custody. Vault books stay consistent and
    ///      never underflow, and shares are burned for exactly `assets`.
    function test_agentVault_withdraw_debits_vault_exactly_receiver_bears_tax() public {
        _seedFirstDeposit(alice);
        vault.setFlashLoanProtection(0, type(uint256).max, 1);

        uint256 assetsOut = 100e18;
        uint256 vaultBalBefore = agentToken.balanceOf(address(vault));
        uint256 totalAssetsBefore = vault.totalAssets();
        uint256 baselineBefore = vault.totalAssetsAtLastReport();
        uint256 sharesBefore = vault.balanceOf(alice);

        vm.prank(alice);
        uint256 sharesBurned = vault.withdraw(assetsOut, bob, alice);

        // Vault-side debit is exact.
        assertEq(agentToken.balanceOf(address(vault)), vaultBalBefore - assetsOut, "vault debited exactly");
        assertEq(vault.coinBalance(), vaultBalBefore - assetsOut, "coinBalance debited exactly");
        assertEq(vault.totalAssets(), totalAssetsBefore - assetsOut, "totalAssets debited exactly");
        assertEq(vault.totalAssetsAtLastReport(), baselineBefore - assetsOut, "baseline debited exactly");
        assertEq(vault.balanceOf(alice), sharesBefore - sharesBurned, "shares burned");

        // Receiver bears the outbound transfer tax (documented limitation).
        assertEq(agentToken.balanceOf(bob), _afterTax(assetsOut), "receiver gets post-tax amount");
    }

    function test_agentVault_redeem_debits_vault_exactly_receiver_bears_tax() public {
        _seedFirstDeposit(alice);
        vault.setFlashLoanProtection(0, type(uint256).max, 1);

        uint256 sharesToRedeem = 100e18 * 1000; // ~100e18 assets at 1:1000 PPS
        uint256 vaultBalBefore = agentToken.balanceOf(address(vault));

        vm.prank(alice);
        uint256 assetsOut = vault.redeem(sharesToRedeem, bob, alice);

        assertGt(assetsOut, 0);
        assertEq(agentToken.balanceOf(address(vault)), vaultBalBefore - assetsOut, "vault debited exactly");
        assertEq(vault.coinBalance(), vaultBalBefore - assetsOut, "coinBalance debited exactly");
        assertEq(agentToken.balanceOf(bob), _afterTax(assetsOut), "receiver gets post-tax amount");
    }

    // -----------------------------------------------------------------
    // Donation / nominal-credit resistance
    // -----------------------------------------------------------------

    function test_agentVault_deposit_never_credits_more_than_actual_receipt() public {
        _seedFirstDeposit(alice);

        // Direct donation must not change totalAssets (tracked coinBalance, not live balanceOf).
        uint256 totalAssetsBefore = vault.totalAssets();
        agentToken.mint(address(vault), 1_000e18);
        assertEq(vault.totalAssets(), totalAssetsBefore, "donation must not inflate totalAssets");
    }

    /// @dev Rebasing-up / reflexive tokens (received > requested) must fail closed:
    ///      crediting more than the caller paid would mint uncollateralized value.
    function test_agentVault_deposit_reverts_when_received_exceeds_requested() public {
        MockRebasingUpToken upToken = new MockRebasingUpToken(500); // +5% bonus on transfer
        AgentOVault upVault = new AgentOVault(address(upToken), address(this), "Agent OVault", "aoRBUP");
        upVault.setModulesOnce(agentCoreModule, strategiesModule, adminModule);

        uint256 nominal = upVault.MINIMUM_FIRST_DEPOSIT();
        uint256 received = nominal + (nominal * 500) / 10_000;

        upToken.mint(alice, nominal);
        vm.prank(alice);
        upToken.approve(address(upVault), type(uint256).max);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(CreatorOVault.TransferAmountMismatch.selector, nominal, received)
        );
        upVault.deposit(nominal, alice);

        assertEq(upVault.totalSupply(), 0);
        assertEq(upVault.coinBalance(), 0);
    }

    /// @dev The Deposit event must report the measured amounts (received + shares),
    ///      not the nominal request — indexers/keepers key off this event.
    function test_agentVault_deposit_event_reports_received_not_nominal() public {
        uint256 nominal = (vault.MINIMUM_FIRST_DEPOSIT() * 10_000) / (10_000 - FEE_BPS) + 1e18;
        uint256 received = _afterTax(nominal);

        agentToken.mint(alice, nominal);
        vm.prank(alice);
        agentToken.approve(address(vault), type(uint256).max);

        vm.expectEmit(true, true, false, true, address(vault));
        emit Deposit(alice, alice, received, received * 1000);
        vm.prank(alice);
        vault.deposit(nominal, alice);
    }

    event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);

    // -----------------------------------------------------------------
    // helpers
    // -----------------------------------------------------------------

    function _seedFirstDeposit(address depositor) internal {
        uint256 nominal = (vault.MINIMUM_FIRST_DEPOSIT() * 10_000) / (10_000 - FEE_BPS) + 1e18;
        agentToken.mint(depositor, nominal);
        vm.startPrank(depositor);
        agentToken.approve(address(vault), type(uint256).max);
        vault.deposit(nominal, depositor);
        vm.stopPrank();
    }
}
