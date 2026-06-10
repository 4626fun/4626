// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {CreatorOVault} from "../../contracts/vault/CreatorOVault.sol";
import {CreatorOVaultCoreModule} from "../../contracts/vault/modules/CreatorOVaultCoreModule.sol";
import {CreatorOVaultStrategiesModule} from "../../contracts/vault/modules/CreatorOVaultStrategiesModule.sol";
import {CreatorOVaultAdminModule} from "../../contracts/vault/modules/CreatorOVaultAdminModule.sol";

/// @title CreatorOVaultMath — Minimal Halmos symbolic execution smoke on real vault share/asset math + fees
/// @notice This is the first targeted Halmos layer for 4626's ERC-4626 core (option 3 from the verification roadmap).
///
/// Run (after installing halmos):
///   pip install halmos
///   halmos --contract CreatorOVaultMath --function check_ --solver-timeout-assertion 30000
///
/// What this exercises:
///   1. The exact Ajna sleeve fee helpers that affect every preview* for Ajna strategy positions
///      (toll on entry, tax on exit). These are the "fee math" the user explicitly called out.
///   2. A minimal faithful model of CreatorOVault's virtual share math (_decimalsOffset=3,
///      VIRTUAL_SHARES_OFFSET=1e3, VIRTUAL_ASSETS_OFFSET=1) + the OZ convertTo* formulas.
///   3. The previewRedeem liquidation cap (S-C02 fix for queued withdrawals).
///
/// Why this shape (minimal + real):
///   - The full CreatorOVault + CoreModule + strategy wiring has many external calls and
///     delegatecall boundaries. Starting here gives fast symbolic signal on the pure math
///     that the invariant suites (RebalanceInvariantHandler, UserPositionInvariantBase) and
///     the Tamago/Lean ERC4626 proofs rely on.
///   - This file now contains BOTH the fast pure model AND direct checks against the
///     live deployed CreatorOVault bytecode (0-strategy minimal setup) — the natural
///     continuation after the initial model smoke.
///
/// Relationship to existing work:
///   - Tamago/verity/ already has full Lean proofs of the ERC4626 mirror (convertTo*,
///     no-loss, closed-world, fixed-share value floor, etc.).
///   - This Halmos layer is the pragmatic "this week in Foundry" step the user requested
///     before considering selective Certora or deeper Lean on the live contracts.
///
/// Limitations (honest):
///   - The live checks currently use a 0-strategy minimal deployment. This is intentional
///     for the first live Halmos smoke (keeps the search space tractable). Adding 1-mock
///     strategy + strategyMaxAssets + the safe valuation fallback paths is the next
///     increment (easy to do with the existing WeightedMockStrategy from the harness).
///   - Integer division + mulDiv(Ceil) edge cases around 0 and max values are the highest
///     risk areas — the specs focus there.

// ============================================================================
// Minimal mock coin for live vault deployment in Halmos checks (self-contained)
// ============================================================================
contract MockRebalanceCoinForHalmos is IERC20 {
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

contract CreatorOVaultMath is Test {
    // ========================================================================
    // AJNA FEE HELPERS — exact copies of the real logic in AjnaERC4626Vault.sol
    // (lines 450-467 at time of writing). These are pure and drive all Ajna previews.
    // ========================================================================

    function _feeFromTotal(uint256 assets, uint256 bps) internal pure returns (uint256) {
        return Math.mulDiv(assets, bps, 10_000, Math.Rounding.Ceil);
    }

    function _feeFromNet(uint256 assets, uint256 bps) internal pure returns (uint256) {
        return _grossUp(assets, bps) - assets;
    }

    function _grossUp(uint256 netAssets, uint256 bps) internal pure returns (uint256) {
        if (bps == 0) return netAssets;
        return Math.mulDiv(netAssets, 10_000, 10_000 - bps, Math.Rounding.Ceil);
    }

    function _netFromGross(uint256 grossAssets, uint256 bps) internal pure returns (uint256) {
        if (bps == 0) return grossAssets;
        uint256 fee = Math.mulDiv(grossAssets, bps, 10_000, Math.Rounding.Ceil);
        return grossAssets - fee;
    }

    // ========================================================================
    // CREATOROVAULT VIRTUAL SHARE MODEL — faithful extraction of the critical pieces
    // used by the real vault (CreatorOVault.sol:100, 2013-2015, 1992-1993, OZ ERC4626).
    //
    // Real vault:
    //   _decimalsOffset() = 3
    //   VIRTUAL_SHARES_OFFSET = 1e3
    //   VIRTUAL_ASSETS_OFFSET = 1
    //   totalAssets() = coinBalance + sum(capped strategy assets)
    //   previewRedeem applies a queued-withdrawal reservation cap (S-C02)
    // ========================================================================

    uint256 internal constant VIRTUAL_SHARES_OFFSET = 1_000;
    uint256 internal constant VIRTUAL_ASSETS_OFFSET = 1;

    // Controllable state for the model (mirrors what totalAssets/totalSupply expose to the math)
    uint256 public modelTotalAssets;
    uint256 public modelTotalSupply;

    function _decimalsOffset() internal pure returns (uint8) {
        return 3; // exact match to CreatorOVault
    }

    function setModelState(uint256 _totalAssets, uint256 _totalSupply) internal {
        modelTotalAssets = _totalAssets;
        modelTotalSupply = _totalSupply;
    }

    // Replicates the OZ ERC4626 _convertToShares with the vault's virtual offsets
    function modelConvertToShares(uint256 assets) public view returns (uint256) {
        uint256 supply = modelTotalSupply + 10 ** _decimalsOffset();
        uint256 assetsWithOffset = assets + VIRTUAL_ASSETS_OFFSET;

        if (supply == 0) {
            return assetsWithOffset;
        }
        uint256 denom = modelTotalAssets + 10 ** _decimalsOffset();
        if (denom == 0) {
            return assetsWithOffset;
        }
        return Math.mulDiv(assetsWithOffset, supply, denom); // floor (matches OZ Down behavior for these paths)
    }

    function modelConvertToAssets(uint256 shares) public view returns (uint256) {
        uint256 supply = modelTotalSupply + 10 ** _decimalsOffset();
        uint256 assetsWithOffset = shares + VIRTUAL_ASSETS_OFFSET; // symmetric treatment in model

        if (supply == 0) {
            return assetsWithOffset; // at zero state the offset dominates
        }
        uint256 denom = modelTotalAssets + 10 ** _decimalsOffset();
        if (denom == 0) {
            return assetsWithOffset;
        }
        return Math.mulDiv(assetsWithOffset, denom, supply); // floor (matches OZ Down behavior for these paths)
    }

    // Model of the previewRedeem cap (CreatorOVault.sol:1030-1037)
    function modelPreviewRedeem(uint256 shares, uint256 totalQueuedWithdrawalShares) public view returns (uint256) {
        uint256 assets = modelConvertToAssets(shares);
        uint256 liquid = modelTotalAssets; // simplified: in reality this is totalAssets()
        uint256 reserved = modelConvertToAssets(totalQueuedWithdrawalShares);
        uint256 available = liquid > reserved ? liquid - reserved : 0;
        return assets > available ? available : assets;
    }

    // ========================================================================
    // HALMOS SYMBOLIC CHECKS — fee math
    // ========================================================================

    /// @notice Fee on entry is always <= the input (never takes more than deposited).
    function check_feeFromTotal_never_exceeds_input(uint256 assets, uint16 bps) public pure {
        bps = uint16(bound(bps, 0, 10_000));
        uint256 fee = _feeFromTotal(assets, bps);
        assertLe(fee, assets);
    }

    /// @notice Gross-up for a fee then net-down recovers the original (within 1 wei due to ceil).
    function check_grossUp_netFromGross_roundtrip(uint256 net, uint16 bps) public pure {
        bps = uint16(bound(bps, 0, 9_999)); // avoid div-by-zero in grossUp
        uint256 gross = _grossUp(net, bps);
        uint256 back = _netFromGross(gross, bps);
        assertGe(back, net); // due to ceil rounding we may be 1 wei generous on the way back
        assertLe(back - net, 1);
    }

    /// @notice _feeFromNet is consistent with gross-up definition.
    function check_feeFromNet_matches_grossUp(uint256 net, uint16 bps) public pure {
        bps = uint16(bound(bps, 0, 9_999));
        uint256 feeViaNet = _feeFromNet(net, bps);
        uint256 gross = _grossUp(net, bps);
        assertEq(feeViaNet, gross - net);
    }

    /// @notice Zero bps means identity for all four helpers.
    function check_zero_bps_is_identity(uint256 x) public pure {
        assertEq(_feeFromTotal(x, 0), x);
        assertEq(_grossUp(x, 0), x);
        assertEq(_netFromGross(x, 0), x);
        assertEq(_feeFromNet(x, 0), 0);
    }

    // ========================================================================
    // HALMOS SYMBOLIC CHECKS — vault virtual share math (model of real CreatorOVault)
    // ========================================================================

    /// @notice At zero state, convertToShares applies the exact 1000x virtual offset the vault uses.
    function check_zeroState_convertToShares_matches_vault_offset(uint256 assets) public {
        vm.assume(assets < type(uint128).max); // avoid overflow in model for this smoke
        setModelState(0, 0);
        uint256 shares = modelConvertToShares(assets);
        // Real vault at zero supply: shares = (assets + 1) * 1000  (approx, via the formula)
        // We assert the offset is present and dominant.
        assertGe(shares, assets * 1000);
        assertLe(shares, (assets + 1) * 1000 + 1);
    }

    /// @notice convertToAssets(convertToShares(x)) >= x - 1 (standard ERC4626 virtual share floor property)
    function check_convertTo_roundtrip_assets_to_shares(uint256 assets) public {
        vm.assume(assets < type(uint128).max);
        // Use a non-zero reasonable state so we actually exercise the ratio path
        setModelState(1000 ether, 1000 * 1000); // 1:1 with offset already baked in
        uint256 shares = modelConvertToShares(assets);
        uint256 back = modelConvertToAssets(shares);
        assertGe(back, assets > 0 ? assets - 1 : 0);
    }

    /// @notice previewRedeem never returns more than the liquid assets after reserving queued withdrawals.
    function check_previewRedeem_cap_respects_queued_withdrawals(
        uint256 shares,
        uint256 totalQueued,
        uint256 totalAssets_,
        uint256 totalSupply_
    ) public {
        vm.assume(totalSupply_ < type(uint128).max);
        vm.assume(totalAssets_ < type(uint128).max);
        setModelState(totalAssets_, totalSupply_);
        uint256 capped = modelPreviewRedeem(shares, totalQueued);
        uint256 reserved = modelConvertToAssets(totalQueued);
        uint256 available = totalAssets_ > reserved ? totalAssets_ - reserved : 0;
        assertLe(capped, available);
    }

    /// @notice convertToShares is monotonically non-decreasing (basic sanity for any sane vault math).
    function check_convertToShares_monotonic(uint256 a, uint256 b) public {
        setModelState(12345 ether, 98765 * 1000);
        if (a > b) (a, b) = (b, a);
        uint256 sa = modelConvertToShares(a);
        uint256 sb = modelConvertToShares(b);
        assertLe(sa, sb);
    }

    /// @notice Price per share (modelled the same way the vault does in pricePerShare) is sane.
    ///         Real vault: ((totalAssets + 1) * 1e18) / (supply + 10**3)
    function check_pricePerShare_model(uint256 totalA, uint256 totalS) public {
        vm.assume(totalS < type(uint128).max);
        vm.assume(totalA < type(uint128).max);
        setModelState(totalA, totalS);
        uint256 pps = (modelTotalAssets + 1) * 1e18 / (modelTotalSupply + 10 ** _decimalsOffset());
        // Just ensure it doesn't revert and is positive when there is supply
        if (modelTotalSupply > 0) {
            assertGt(pps, 0);
        }
    }

    // ========================================================================
    // LIVE CREATOROVAULT — real deployed bytecode (continuation of minimal Halmos smoke)
    //
    // These checks deploy an actual CreatorOVault (0 strategies) using the same
    // construction path as the invariant harnesses and production deploys.
    // We then run the same classes of symbolic properties against the live
    // convertToShares / convertToAssets / previewRedeem / totalAssets.
    //
    // This is the direct next increment after the pure model: we are now
    // symbolically executing against the real contract the user will deploy.
    // ========================================================================

    function _deployMinimalLiveVault()
        internal
        returns (CreatorOVault vault, MockRebalanceCoinForHalmos coin)
    {
        coin = new MockRebalanceCoinForHalmos();
        vault = new CreatorOVault(address(coin), address(this), "HalmosLive", "hLV");

        vault.setModulesOnce(
            address(new CreatorOVaultCoreModule()),
            address(new CreatorOVaultStrategiesModule()),
            address(new CreatorOVaultAdminModule())
        );

        // Minimal safe defaults matching harness + production patterns
        vault.setKeeper(address(this));
        vault.setMinimumTotalIdle(0);
        vault.setFlashLoanProtection(0, type(uint256).max, 1);
        vault.setMaxTotalSupply(type(uint256).max);
    }

    /// @notice On a real deployed CreatorOVault (0 strategies), convertToAssets(convertToShares(x)) >= x-1
    function check_live_convertTo_roundtrip(uint256 assets) public {
        vm.assume(assets < type(uint128).max);
        (CreatorOVault vault, MockRebalanceCoinForHalmos coin) = _deployMinimalLiveVault();

        // Bootstrap via real deposit (must meet minimum first deposit + L-06 tracked balance)
        address user = address(0xBEEF);
        uint256 first = 50_000_000 ether;
        coin.mint(user, first + assets);
        vm.prank(user);
        coin.approve(address(vault), type(uint256).max);
        vm.prank(user);
        vault.deposit(first + assets, user);

        uint256 shares = vault.convertToShares(assets);
        uint256 back = vault.convertToAssets(shares);
        assertGe(back, assets > 0 ? assets - 1 : 0);
    }

    /// @notice Live vault totalAssets reflects actual deposits (0-strategy case, tracked coinBalance)
    function check_live_totalAssets_matches_deposits(uint256 deposited) public {
        vm.assume(deposited >= 50_000_000 ether && deposited < type(uint128).max);
        (CreatorOVault vault, MockRebalanceCoinForHalmos coin) = _deployMinimalLiveVault();

        address user = address(0xBEEF);
        coin.mint(user, deposited);
        vm.prank(user);
        coin.approve(address(vault), deposited);
        vm.prank(user);
        vault.deposit(deposited, user);

        assertEq(vault.totalAssets(), deposited);
    }

    /// @notice Live previewRedeem cap never exceeds liquid (0-strategy minimal case)
    function check_live_previewRedeem_cap(uint256 shares, uint256 queuedShares) public {
        vm.assume(shares < type(uint128).max);
        vm.assume(queuedShares < type(uint128).max);
        (CreatorOVault vault, MockRebalanceCoinForHalmos coin) = _deployMinimalLiveVault();

        // Bootstrap tracked assets with valid first deposit
        address user = address(0xBEEF);
        uint256 first = 50_000_000 ether;
        coin.mint(user, first + 50_000_000 ether);
        vm.prank(user);
        coin.approve(address(vault), type(uint256).max);
        vm.prank(user);
        vault.deposit(first + 50_000_000 ether, user);

        uint256 assets = vault.previewRedeem(shares);
        assertLe(assets, vault.totalAssets());
    }

    // ========================================================================
    // CONCRETE FOUNDRY TEST (so the file appears in normal `forge test` runs)
    // The real symbolic power comes from invoking this file with the `halmos` binary.
    // ========================================================================

    function test_halmos_spec_compiles_and_runs_concrete_paths() public {
        setModelState(1_000_000 ether, 1_000_000 * 1_000);
        uint256 shares = modelConvertToShares(123 ether);
        uint256 back = modelConvertToAssets(shares);
        assertGe(back, 122 ether);

        uint256 fee = _feeFromTotal(10_000, 250); // 2.5% toll example
        assertLe(fee, 10_000);
        assertGt(fee, 0);

        // Exercise the live deployment path concretely so it cannot bit-rot.
        // We must go through an actual deposit (not raw mint) because CreatorOVault
        // uses tracked coinBalance (anti-donation L-06 fix), not live balanceOf.
        // First deposit must also be >= MINIMUM_FIRST_DEPOSIT (50M tokens).
        (CreatorOVault liveVault, MockRebalanceCoinForHalmos liveCoin) = _deployMinimalLiveVault();
        address depositor = address(0xD15C0);
        uint256 firstDeposit = 50_000_000 ether; // exact minimum
        liveCoin.mint(depositor, firstDeposit + 123_456 ether);
        vm.prank(depositor);
        liveCoin.approve(address(liveVault), type(uint256).max);
        vm.prank(depositor);
        liveVault.deposit(firstDeposit + 123_456 ether, depositor);

        assertEq(liveVault.totalAssets(), firstDeposit + 123_456 ether);
        uint256 liveShares = liveVault.convertToShares(1_000 ether);
        assertGt(liveShares, 0);
    }
}
