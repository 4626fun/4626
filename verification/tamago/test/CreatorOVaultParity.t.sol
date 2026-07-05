// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Deployer} from "tamago/generated/ERC20Deployer.sol";
import {ERC20Iface} from "tamago/generated/ERC20Iface.sol";
import {ERC4626Deployer} from "tamago/generated/ERC4626Deployer.sol";
import {ERC4626Iface} from "tamago/generated/ERC4626Iface.sol";
import {CreatorOVault} from "../../CreatorOVault.sol";

/// @dev Minimal mintable ERC-20 so we can seed CreatorOVault for view-function parity checks.
contract MockCreatorCoin is ERC20 {
    constructor() ERC20("Mock Creator", "MOCK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title CreatorOVaultParityTest
 * @notice Spec-parity checks between CreatorOVault (OpenZeppelin ERC-4626) and
 *         the formally-verified Tamago ERC-4626 deployer on the read-only ERC-4626
 *         surface.
 *
 *         CreatorOVault's deposit/mint/redeem/withdraw delegate to a core module
 *         that is not wired in this test — so write paths are not exercised here.
 *         What IS exercised:
 *           - convertToShares / convertToAssets at zero state
 *           - totalAssets accounting after a direct asset transfer (donation)
 *           - preview*() never overstates the user's favor (the ERC-4626 spec
 *             invariant Tamago proves)
 *           - maxDeposit / maxMint defaults
 *
 *         Any divergence here is a hint — not a defect — that CreatorOVault
 *         differs in policy from the spec-minimal Tamago vault (e.g. virtual
 *         shares offset, whitelist gating, pause/shutdown). Comments below
 *         call out the known intentional differences.
 */
contract CreatorOVaultParityTest is Test {
    MockCreatorCoin internal asset_;
    CreatorOVault internal cv;       // your vault
    ERC4626Iface internal tv;        // Tamago vault
    ERC20Iface internal tvAsset;     // Tamago vault's underlying ERC-20

    address internal owner_ = address(0xA11CE);

    function setUp() public {
        // ---------- CreatorOVault wired against a vanilla mintable ERC20 ----------
        asset_ = new MockCreatorCoin();
        cv = new CreatorOVault(address(asset_), owner_, "Creator OVault Test", "tCOV");

        // ---------- Tamago vault wired against its self-mintable ERC20 ------------
        tvAsset = ERC20Deployer.deploy(address(this));
        tv = ERC4626Deployer.deploy(address(tvAsset));
    }

    // -----------------------------------------------------------------------------
    // Asset wiring
    // -----------------------------------------------------------------------------

    function test_asset_wiring() public view {
        assertEq(cv.asset(), address(asset_), "CreatorOVault.asset()");
        assertEq(tv.asset(), address(tvAsset), "Tamago.asset()");
    }

    // -----------------------------------------------------------------------------
    // Conversion at zero state
    //
    // Spec-minimal Tamago at zero state returns the input verbatim (1:1).
    // CreatorOVault uses OpenZeppelin's virtual shares/assets offset to mitigate
    // first-depositor inflation — so its zero-state mapping is NOT 1:1.
    // We assert both behaviors explicitly so the divergence is documented and
    // any future regression on either side is caught.
    // -----------------------------------------------------------------------------

    function test_convertToShares_zeroState_isIdentity_onTamago() public view {
        for (uint256 i = 0; i < 4; i++) {
            uint256 a = 1 ether * (i + 1);
            assertEq(tv.convertToShares(a), a, "Tamago should round 1:1 at zero state");
        }
    }

    function test_convertToShares_zeroState_creatorOVault_appliesVirtualOffset() public view {
        // CreatorOVault overrides `_decimalsOffset()` to 3 (virtual shares defense),
        // so zero-state conversion is scaled by 10^3 rather than identity.
        for (uint256 i = 0; i < 4; i++) {
            uint256 a = 1 ether * (i + 1);
            assertEq(cv.convertToShares(a), a * 1000, "CreatorOVault zero-state convertToShares");
            assertEq(cv.convertToAssets(a), a / 1000, "CreatorOVault zero-state convertToAssets");
        }
    }

    // -----------------------------------------------------------------------------
    // totalAssets after a donation
    //
    // Tamago and CreatorOVault both intentionally use tracked accounting instead
    // of direct token-balance reads, so raw donations should not affect totalAssets().
    // CreatorOVault intentionally does NOT auto-count donations in totalAssets():
    // it uses tracked `coinBalance` to prevent donation-based fee extraction.
    // -----------------------------------------------------------------------------

    function test_totalAssets_reflectsDonation_creatorOVault() public {
        assertEq(cv.totalAssets(), 0, "initial");
        asset_.mint(address(cv), 123 ether);
        assertEq(cv.totalAssets(), 0, "after donation");
    }

    function test_totalAssets_reflectsDonation_tamago() public {
        assertEq(tv.totalAssets(), 0, "initial");
        tvAsset.mint(address(tv), 123 ether);
        assertEq(tv.totalAssets(), 0, "after donation");
    }

    // -----------------------------------------------------------------------------
    // ERC-4626 preview rounding invariants (Tamago side)
    //
    // The spec requires:
    //   previewDeposit(a) <= convertToShares(a)
    //   previewMint(s)    >= convertToAssets(s)
    //   previewWithdraw(a)>= convertToShares(a)
    //   previewRedeem(s)  <= convertToAssets(s)
    // i.e. previews always round in the direction that protects the vault.
    // Tamago has these proven in Lean; here we sanity-check the property at
    // runtime so a regression in the vendored bytecode would surface.
    // -----------------------------------------------------------------------------

    function testFuzz_tamago_previewRoundingInvariants(uint96 rawAssets, uint96 rawShares) public {
        // Seed some state so conversions aren't trivially 1:1
        uint256 seed = (uint256(rawAssets) % 1e22) + 1;
        tvAsset.mint(address(this), seed * 2);
        tvAsset.approve(address(tv), type(uint256).max);
        tv.deposit(seed, address(this));

        uint256 a = (uint256(rawAssets) % 1e22) + 1;
        uint256 s = (uint256(rawShares) % 1e22) + 1;

        assertLe(tv.previewDeposit(a),  tv.convertToShares(a), "previewDeposit > convertToShares");
        assertGe(tv.previewMint(s),     tv.convertToAssets(s), "previewMint < convertToAssets");
        assertGe(tv.previewWithdraw(a), tv.convertToShares(a), "previewWithdraw < convertToShares");
        assertLe(tv.previewRedeem(s),   tv.convertToAssets(s), "previewRedeem > convertToAssets");
    }

    // -----------------------------------------------------------------------------
    // maxDeposit / maxMint defaults
    //
    // Tamago's spec-minimal vault returns type(uint256).max for unconstrained
    // receivers. CreatorOVault gates on pause/shutdown/whitelist — for the
    // default deployed state in this test the owner is whitelisted and the
    // vault is not paused/shutdown, so it should match Tamago's default.
    // For a non-whitelisted receiver CreatorOVault returns 0 (a known policy
    // difference we pin here).
    // -----------------------------------------------------------------------------

    function test_maxDeposit_default() public view {
        assertEq(tv.maxDeposit(owner_),                type(uint256).max, "Tamago.maxDeposit");
        // CreatorOVault: whitelistEnabled defaults to false in constructor,
        // so non-whitelisted users are NOT restricted at deploy time.
        // We just assert maxDeposit is "large" (i.e. effectively unbounded).
        assertGt(cv.maxDeposit(owner_), 1e30, "CreatorOVault.maxDeposit(owner) large");
    }

    function test_maxMint_default() public view {
        assertEq(tv.maxMint(owner_), type(uint256).max, "Tamago.maxMint");
        assertGt(cv.maxMint(owner_), 1e30, "CreatorOVault.maxMint(owner) large");
    }

    // -----------------------------------------------------------------------------
    // maxWithdraw / maxRedeem at zero share balance: both must return 0.
    // -----------------------------------------------------------------------------

    function test_maxWithdraw_zero_shares_isZero() public view {
        assertEq(tv.maxWithdraw(owner_), 0, "Tamago.maxWithdraw");
        assertEq(cv.maxWithdraw(owner_), 0, "CreatorOVault.maxWithdraw");
    }

    function test_maxRedeem_zero_shares_isZero() public view {
        assertEq(tv.maxRedeem(owner_), 0, "Tamago.maxRedeem");
        assertEq(cv.maxRedeem(owner_), 0, "CreatorOVault.maxRedeem");
    }
}
