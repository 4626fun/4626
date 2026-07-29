// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {CreatorOVault} from "@4626/creator/vault/CreatorOVault.sol";
import {AgentOVault} from "@4626/agent/vault/AgentOVault.sol";
import {CreatorOVaultCoreModule} from "@4626/creator/vault/modules/CreatorOVaultCoreModule.sol";
import {AgentOVaultCoreModule} from "@4626/agent/vault/modules/AgentOVaultCoreModule.sol";
import {OVaultStrategiesModule} from "@4626/shared/vault/modules/OVaultStrategiesModule.sol";
import {OVaultAdminModule} from "@4626/shared/vault/modules/OVaultAdminModule.sol";
import {AgentOVaultWrapper} from "@4626/agent/vault/AgentOVaultWrapper.sol";
import {OVaultImpairmentClaims} from "@4626/shared/vault/recovery/OVaultImpairmentClaims.sol";
import {OVaultRecoveryEscrow} from "@4626/shared/vault/recovery/OVaultRecoveryEscrow.sol";
import {IStrategy} from "@4626/shared/interfaces/strategies/IStrategy.sol";
import {IStrategyValuation} from "@4626/shared/interfaces/strategies/IStrategyValuation.sol";
import {MockAgentTokenV4} from "test/mocks/MockAgentTokenV4.sol";

/// @dev ShareOFT stand-in for wrapper tests (mirrors test/oda/ODA480_AgentCooldownParity).
contract L509MockShare is ERC20 {
    constructor() ERC20("Agent Share", "ASHARE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}

/// @dev Tax-aware strategy: measures its own receipts because AgentTokenV4 taxes the
///      vault→strategy and strategy→vault hops. `reportBps` < 100 simulates a strategy
///      that under-reports its receipt (loss-hiding) for the U-08 guard test.
contract L509TaxAwareStrategy is IStrategy, IStrategyValuation {
    IERC20 public immutable TOKEN;
    uint256 public trackedAssets;
    uint256 public reportBps = 100;

    constructor(address token_) {
        TOKEN = IERC20(token_);
    }

    function setReportBps(uint256 bps) external {
        reportBps = bps;
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

    function deposit(uint256 amount) external override returns (uint256) {
        if (amount == 0) return 0;
        uint256 before = TOKEN.balanceOf(address(this));
        require(TOKEN.transferFrom(msg.sender, address(this), amount), "tf");
        uint256 received = TOKEN.balanceOf(address(this)) - before;
        trackedAssets += received;
        return (received * reportBps) / 100;
    }

    function withdraw(uint256 amount) external override returns (uint256 withdrawn) {
        withdrawn = amount > trackedAssets ? trackedAssets : amount;
        if (withdrawn == 0) return 0;
        trackedAssets -= withdrawn;
        require(TOKEN.transfer(msg.sender, withdrawn), "t"); // taxed hop: vault receives less
    }

    function emergencyWithdraw() external override returns (uint256 withdrawn) {
        withdrawn = trackedAssets;
        trackedAssets = 0;
        if (withdrawn > 0) require(TOKEN.transfer(msg.sender, withdrawn), "t");
    }

    function harvest() external pure override returns (uint256) {
        return 0;
    }

    function rebalance() external override {}
}

/// @dev Creator-lane token with a test-only downward rebase (Lead 5).
contract L509RebaseDownToken is ERC20 {
    constructor() ERC20("Rebase Down", "RBD") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function rebaseDown(address account, uint256 bps) external {
        uint256 bal = balanceOf(account);
        _burn(account, (bal * bps) / 10_000);
    }
}

/// @notice LeftClaw #509 per-finding coverage: measured refill (U-01), delivered
///         semantics + working minOut (U-02), cooldown policy incl. EIP-7702 (U-03),
///         tax-aware quotes (U-04), dead mint surface (U-05), measured injectCapital
///         (U-06), delta ledger writes (U-07), guard placement (U-08), recovery
///         booking (U-09) and the lead fixes (wrapper cooldown, operator sentinel,
///         rebase-down clamp, first-deposit re-seed).
contract AgentOVaultLeftClaw509RemediationTest is Test {
    uint256 internal constant FEE_BPS = 1_000; // 10% transfer tax
    uint256 internal constant OP_DEPOSIT = 1 << 0;
    uint256 internal constant OP_WITHDRAW = 1 << 1;

    event CapitalInjected(address indexed from, uint256 amount, uint256 newPricePerShare);

    MockAgentTokenV4 internal agentToken;
    AgentOVault internal vault;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        agentToken = new MockAgentTokenV4("Agent Token V4", "AGNT", uint16(FEE_BPS), 0);
        vault = new AgentOVault(address(agentToken), address(this), "Agent OVault", "aoAGNT");
        vault.setModulesOnce(
            address(new AgentOVaultCoreModule()), address(new OVaultStrategiesModule()), address(new OVaultAdminModule())
        );
    }

    function _afterTax(uint256 amount) internal pure returns (uint256) {
        return amount - (amount * FEE_BPS) / 10_000;
    }

    function _bootstrapNominal() internal view returns (uint256) {
        return (vault.MINIMUM_FIRST_DEPOSIT() * 10_000) / (10_000 - FEE_BPS) + 1e18;
    }

    function _seedFirstDeposit(address depositor) internal {
        uint256 nominal = _bootstrapNominal();
        agentToken.mint(depositor, nominal);
        vm.startPrank(depositor);
        agentToken.approve(address(vault), type(uint256).max);
        vault.deposit(nominal, depositor);
        vm.stopPrank();
    }

    // -----------------------------------------------------------------
    // U-01: measured refill — taxed strategy→vault legs no longer brick withdrawals
    // -----------------------------------------------------------------

    function test_u01_taxedStrategyRefill_succeeds() public {
        L509TaxAwareStrategy strat = new L509TaxAwareStrategy(address(agentToken));
        vault.addStrategy(address(strat), 10_000, true);
        vault.setAutoAllocate(true);

        _seedFirstDeposit(alice); // everything above minIdle auto-allocates into the taxed strategy
        assertGt(strat.trackedAssets(), 0, "deposit must auto-allocate");
        assertLe(agentToken.balanceOf(address(vault)), 10_000e18, "only minIdle may remain");
        vault.setFlashLoanProtection(0, type(uint256).max, 1);

        uint256 shares = vault.balanceOf(alice) / 2;
        vm.prank(alice);
        uint256 delivered = vault.redeem(shares, bob, alice);

        assertGt(delivered, 0, "taxed refill must close the deficit");
        assertEq(agentToken.balanceOf(bob), delivered, "receiver gets the delivered amount");
        assertGt(strat.trackedAssets(), 0, "strategy retains the remainder");
    }

    // -----------------------------------------------------------------
    // U-02 + U-04: delivered-truth redeem makes wrapper minOut achievable
    // -----------------------------------------------------------------

    function test_u02_wrapper_minOut_achievable_with_delivered_quotes() public {
        L509MockShare share = new L509MockShare();
        AgentOVaultWrapper wrapper = new AgentOVaultWrapper(address(agentToken), address(vault), address(this));
        wrapper.setShareOFT(address(share));
        vault.setWhitelist(address(wrapper), true);
        vault.setTrustedAdapter(address(wrapper), true);
        vault.setFlashLoanProtection(0, type(uint256).max, 1);

        // Two taxed hops (alice→wrapper, wrapper→vault): gross up past the vault's
        // first-deposit minimum for the compounded receipt.
        uint256 nominal = _bootstrapNominal() * 2;
        agentToken.mint(alice, nominal);
        vm.startPrank(alice);
        agentToken.approve(address(wrapper), type(uint256).max);
        uint256 shareOut = wrapper.deposit(nominal, 0);
        vm.stopPrank();
        assertGt(shareOut, 0);

        vm.roll(block.number + wrapper.wrapperWithdrawDelayBlocks() + 1);

        uint256 quoted = wrapper.previewWithdraw(shareOut);
        vm.prank(alice);
        uint256 assetsOut = wrapper.withdraw(shareOut, quoted);
        assertGe(assetsOut, quoted, "minOut from the tax-netted preview must clear");
        assertGt(assetsOut, 0);
    }

    // -----------------------------------------------------------------
    // U-03: EIP-7702 EOA carrying code must not inherit the old code.length
    //       contract-exemption from the inflow cooldown
    // -----------------------------------------------------------------

    function test_u03_7702_eoaWithCode_selfDeposit_stillStamps() public {
        _seedFirstDeposit(alice);

        address eoa7702 = makeAddr("eoa7702");
        vm.etch(eoa7702, hex"60806040"); // EIP-7702-style: EOA now carries code
        assertGt(eoa7702.code.length, 0, "etch sanity");

        uint256 nominal = 10e18;
        agentToken.mint(eoa7702, nominal);
        vm.startPrank(eoa7702);
        agentToken.approve(address(vault), type(uint256).max);
        vault.deposit(nominal, eoa7702);
        vm.stopPrank();

        assertEq(vault.lastDepositBlock(eoa7702), block.number, "EOA-with-code must still arm the cooldown");
        vm.prank(eoa7702);
        vm.expectRevert();
        vault.withdraw(1e18, eoa7702, eoa7702);
    }

    // -----------------------------------------------------------------
    // U-04: tax-aware previewDeposit matches the measured mint
    // -----------------------------------------------------------------

    function test_u04_previewDeposit_matches_minted_shares() public {
        _seedFirstDeposit(alice);

        uint256 nominal = 25e18;
        uint256 quoted = vault.previewDeposit(nominal);

        agentToken.mint(bob, nominal);
        vm.startPrank(bob);
        agentToken.approve(address(vault), type(uint256).max);
        uint256 minted = vault.deposit(nominal, bob);
        vm.stopPrank();

        assertEq(quoted, minted, "tax-aware preview must match the measured mint");
    }

    // -----------------------------------------------------------------
    // U-05: dead mint surface advertises unsupported
    // -----------------------------------------------------------------

    function test_u05_mint_surface_advertises_unsupported() public {
        _seedFirstDeposit(alice);

        assertEq(vault.maxMint(alice), 0, "maxMint must advertise 0");
        vm.expectRevert(AgentOVault.MintNotSupported.selector);
        vault.previewMint(1e18);
    }

    // -----------------------------------------------------------------
    // U-06: injectCapital books the measured receipt
    // -----------------------------------------------------------------

    function test_u06_injectCapital_books_received() public {
        uint256 nominal0 = _bootstrapNominal();
        uint256 received0 = _afterTax(nominal0);
        _seedFirstDeposit(alice);

        uint256 nominal = 10e18;
        uint256 received = _afterTax(nominal);
        agentToken.mint(address(this), nominal);
        agentToken.approve(address(vault), type(uint256).max);

        uint256 baselineBefore = vault.totalAssetsAtLastReport();
        uint256 expectedPps = ((received0 + received + 1) * 1e18) / (received0 * 1_000 + 1_000);
        vm.expectEmit(true, false, false, true, address(vault));
        emit CapitalInjected(address(this), received, expectedPps);
        vault.injectCapital(nominal);

        assertEq(vault.coinBalance(), received0 + received, "book keeps the measured receipt only");
        assertEq(vault.totalAssetsAtLastReport(), baselineBefore + received, "baseline books received");
    }

    // -----------------------------------------------------------------
    // U-07: donations stay untracked across a later deposit
    // -----------------------------------------------------------------

    function test_u07_donation_stays_untracked_across_deposit() public {
        _seedFirstDeposit(alice);

        agentToken.mint(address(vault), 1_000e18); // donation
        uint256 totalAfterDonation = vault.totalAssets();

        uint256 nominal = 10e18;
        uint256 received = _afterTax(nominal);
        agentToken.mint(bob, nominal);
        vm.startPrank(bob);
        agentToken.approve(address(vault), type(uint256).max);
        vault.deposit(nominal, bob);
        vm.stopPrank();

        assertEq(vault.totalAssets(), totalAfterDonation + received, "donation must stay untracked");
        assertEq(vault.coinBalance(), totalAfterDonation + received, "delta ledger books only the measured receipt");
    }

    // -----------------------------------------------------------------
    // U-08: post-allocation price guard catches an under-reporting strategy
    // -----------------------------------------------------------------

    function test_u08_guard_catches_underreporting_strategy_allocation() public {
        L509TaxAwareStrategy strat = new L509TaxAwareStrategy(address(agentToken));
        vault.addStrategy(address(strat), 10_000, true);
        vault.setAutoAllocate(true);

        _seedFirstDeposit(alice); // first deposit skips the guard by design

        strat.setReportBps(80); // now under-reports: booked debt drops 20% on allocation

        uint256 nominal = _bootstrapNominal();
        agentToken.mint(bob, nominal);
        vm.startPrank(bob);
        agentToken.approve(address(vault), type(uint256).max);
        // try/catch instead of expectRevert(bytes4): the guard's revert carries args,
        // and this foundry build only prefix-matches on exact-length revert data.
        try vault.deposit(nominal, bob) {
            revert("under-reporting allocation must trip the guard");
        } catch (bytes memory reason) {
            assertEq(bytes4(reason), CreatorOVault.PriceChangeExceedsLimit.selector, "post-allocation guard must trip");
        }
        vm.stopPrank();
    }

    // -----------------------------------------------------------------
    // U-09: taxed recovery notify books what the escrow actually received
    // -----------------------------------------------------------------

    function test_u09_taxedRecovery_books_delivered() public {
        L509TaxAwareStrategy strat = new L509TaxAwareStrategy(address(agentToken));
        _seedFirstDeposit(alice);
        vault.addStrategy(address(strat), 5_000, true);
        vault.deployToStrategies();

        OVaultImpairmentClaims claims = new OVaultImpairmentClaims(address(this));
        OVaultRecoveryEscrow escrow = new OVaultRecoveryEscrow(address(this));
        claims.setVault(address(vault));
        escrow.setVault(address(vault));
        vault.setImpairmentClaims(address(claims));
        vault.setImpairmentRecoveryEscrow(address(escrow));
        vault.setImpairmentChallengeWindow(1 hours);

        uint256 epochId = vault.tripImpairment(address(strat), 1);
        bytes32 leaf = keccak256(abi.encode(epochId, alice, vault.balanceOf(alice)));
        vault.proposeImpairmentRoot(epochId, leaf, vault.balanceOf(alice), address(agentToken));
        vm.warp(block.timestamp + 1 hours + 1);
        vault.finalizeImpairment(epochId);

        uint256 nominal = 100e18;
        uint256 delivered = _afterTax(nominal);
        vault.notifyImpairmentRecovery(epochId, nominal);

        (,,,,,,,,,,,, uint256 totalRecovered,) = vault.impairmentEpochs(epochId);
        assertEq(totalRecovered, delivered, "recovery books the escrow-delivered amount");
        assertEq(escrow.recoveredByEpochAsset(epochId, address(agentToken)), delivered, "escrow records delivered");
        assertEq(agentToken.balanceOf(address(escrow)), delivered, "escrow custody sanity");
    }

    // -----------------------------------------------------------------
    // Lead 1: wrapper fee whitelist is a commercial waiver, not a cooldown waiver
    // -----------------------------------------------------------------

    function test_lead1_wrapper_feeWaiver_doesNot_waive_cooldown() public {
        L509MockShare share = new L509MockShare();
        AgentOVaultWrapper wrapper = new AgentOVaultWrapper(address(agentToken), address(vault), address(this));
        wrapper.setShareOFT(address(share));
        vault.setWhitelist(address(wrapper), true);
        vault.setTrustedAdapter(address(wrapper), true);
        vault.setFlashLoanProtection(0, type(uint256).max, 1);
        wrapper.setWhitelist(alice, true); // fee waiver only

        uint256 nominal = _bootstrapNominal() * 2;
        agentToken.mint(alice, nominal);
        vm.startPrank(alice);
        agentToken.approve(address(wrapper), type(uint256).max);
        uint256 shareOut = wrapper.deposit(nominal, 0);

        vm.expectRevert(); // hot units stay cooldown-gated despite the fee waiver
        wrapper.withdraw(shareOut / 10, 0);
        vm.stopPrank();

        vm.roll(block.number + wrapper.wrapperWithdrawDelayBlocks());
        vm.prank(alice);
        uint256 out = wrapper.withdraw(shareOut / 10, 0);
        assertGt(out, 0, "cooled units exit fine");
    }

    // -----------------------------------------------------------------
    // Lead 2: operator grants fail closed; the view mirrors enforcement
    // -----------------------------------------------------------------

    function test_lead2_operator_zeroPerms_failsClosed_and_view_mirrors() public {
        _seedFirstDeposit(alice);
        vault.setFlashLoanProtection(0, type(uint256).max, 1);

        address bot = makeAddr("bot");
        uint256 nominal = 10e18;
        agentToken.mint(bot, nominal * 4);
        vm.prank(bot);
        agentToken.approve(address(vault), type(uint256).max);

        // Unregistered: permissionless baseline — deposit works, view reads authorized.
        assertTrue(vault.isAuthorizedOperator(bot, OP_DEPOSIT), "baseline must read authorized");
        vm.prank(bot);
        vault.deposit(nominal, bot);

        // Registered with zero perms: fail closed (previously restored full baseline).
        vault.setOperatorPerms(bot, 0);
        assertFalse(vault.isAuthorizedOperator(bot, OP_DEPOSIT), "zero-perm operator must read denied");
        vm.prank(bot);
        vm.expectRevert(abi.encodeWithSelector(CreatorOVaultCoreModule.OperatorPermissionDenied.selector, bot, OP_DEPOSIT));
        vault.deposit(nominal, bot);

        // Granted only OP_DEPOSIT: deposit ok, redeem denied.
        vault.setOperatorPerms(bot, OP_DEPOSIT);
        vm.prank(bot);
        vault.deposit(nominal, bot);
        assertTrue(vault.isAuthorizedOperator(bot, OP_DEPOSIT));
        assertFalse(vault.isAuthorizedOperator(bot, OP_WITHDRAW));
        vm.prank(bot);
        vm.expectRevert(abi.encodeWithSelector(CreatorOVaultCoreModule.OperatorPermissionDenied.selector, bot, OP_WITHDRAW));
        vault.redeem(1, bot, bot);

        // Clearing restores the permissionless baseline.
        vault.clearOperatorPerms(bot);
        assertTrue(vault.isAuthorizedOperator(bot, OP_WITHDRAW), "cleared operator returns to baseline");
        uint256 botShares = vault.balanceOf(bot);
        vm.prank(bot);
        vault.redeem(botShares / 2, bot, bot);
    }

    // -----------------------------------------------------------------
    // Lead 5: totalAssets idle leg clamps to the live balance on rebase-down
    // -----------------------------------------------------------------

    function test_lead5_totalAssets_clamps_to_live_after_rebase_down() public {
        L509RebaseDownToken rbd = new L509RebaseDownToken();
        CreatorOVault cvault = new CreatorOVault(address(rbd), address(this), "Creator OVault", "ovRBD");
        cvault.setModulesOnce(
            address(new CreatorOVaultCoreModule()), address(new OVaultStrategiesModule()), address(new OVaultAdminModule())
        );

        uint256 amount = cvault.MINIMUM_FIRST_DEPOSIT();
        rbd.mint(alice, amount);
        vm.startPrank(alice);
        rbd.approve(address(cvault), type(uint256).max);
        cvault.deposit(amount, alice);
        vm.stopPrank();
        assertEq(cvault.totalAssets(), amount, "pre-rebase sanity");

        // Donations before any rebase do not inflate the book (L-06 preserved).
        rbd.mint(address(cvault), 1_000e18);
        assertEq(cvault.totalAssets(), amount, "donations stay untracked");

        rbd.rebaseDown(address(cvault), 1_000); // -10% of the live balance
        assertEq(cvault.totalAssets(), rbd.balanceOf(address(cvault)), "idle leg clamps down to live balance");
        assertLt(cvault.totalAssets(), amount, "stale-high tracked figure must not price exits");
    }

    // -----------------------------------------------------------------
    // Lead 6: burn-to-zero with an asset residue is NOT a first deposit —
    //         the re-seed loses the bootstrap quote and minimum exemption
    // -----------------------------------------------------------------

    function test_lead6_burnToZero_reseed_loses_firstDeposit_exemptions() public {
        _seedFirstDeposit(alice);
        vault.setFlashLoanProtection(0, type(uint256).max, 1);

        uint256 aliceShares = vault.balanceOf(alice); // read before prank: view calls consume it
        vm.prank(alice);
        vault.redeem(aliceShares, alice, alice);
        assertEq(vault.totalSupply(), 0, "supply burned to zero");
        uint256 residualAssets = vault.totalAssets();
        if (residualAssets == 0) return; // exact-zero exit: nothing to prove here

        uint256 small = 1e18; // far below MINIMUM_FIRST_DEPOSIT
        uint256 received = _afterTax(small);
        agentToken.mint(bob, small);
        vm.startPrank(bob);
        agentToken.approve(address(vault), type(uint256).max);
        uint256 shares = vault.deposit(small, bob);
        vm.stopPrank();

        assertGt(shares, 0, "below-min deposit must succeed once re-seed exemptions are lost");
        assertLt(shares, received * 1_000, "must not re-seed the bootstrap 1:1000 quote");
    }
}
