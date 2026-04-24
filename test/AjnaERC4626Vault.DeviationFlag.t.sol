// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IAjnaPool} from "../contracts/interfaces/IAjnaPool.sol";
import {AjnaERC4626Vault} from "../contracts/vault/strategies/ajna4626/AjnaERC4626Vault.sol";
import {AjnaVaultAuth} from "../contracts/vault/strategies/ajna4626/AjnaVaultAuth.sol";

/// @title AjnaERC4626Vault — ERC-4626 deviation flag tests (F-19 / 4626-442)
/// @notice Pins the machine-readable deviation bitmap returned by
///         `erc4626DeviationFlags()` and the `hasConservativeMaxWithdraw()`
///         convenience getter, plus the stability contract with the existing
///         `isPartialWithdrawVault()` flag.
contract AjnaERC4626VaultDeviationFlagTest is Test {
    // -----------------------------------------------------------------
    // Minimal mocks (mirrors the pattern in AjnaERC4626Vault.t.sol, pared
    // down to what the constructor requires — flag reads are `pure` so no
    // pool interaction is needed in the test body).
    // -----------------------------------------------------------------
    _MockERC20 internal asset;
    _MockAjnaPool internal pool;
    AjnaVaultAuth internal auth;
    AjnaERC4626Vault internal vault;

    function setUp() public {
        asset = new _MockERC20("Creator", "CREATOR");
        pool = new _MockAjnaPool(IERC20(address(asset)));
        auth = new AjnaVaultAuth(address(this));
        vault = new AjnaERC4626Vault(
            address(pool), IERC20(address(asset)), "Ajna Inner Vault", "AIV", auth
        );
    }

    // -----------------------------------------------------------------
    // Bitmap
    // -----------------------------------------------------------------

    /// Exact value assertion: 0x3 = bit 0 (maxWithdraw under-reports) + bit 1
    /// (maxRedeem under-reports). Any change to this value must be intentional
    /// and must go through `docs/contracts/ERC4626_DEVIATION_FLAGS.md`.
    function test_deviationFlags_equalsThree() public view {
        assertEq(vault.erc4626DeviationFlags(), 0x3, "AjnaERC4626Vault must return 0x3");
    }

    /// Bitwise assertions — makes this test act as documentation for
    /// integrators reading the test file directly.
    function test_deviationFlags_bit0_maxWithdrawUnderReports() public view {
        uint256 flags = vault.erc4626DeviationFlags();
        assertTrue((flags & (uint256(1) << 0)) != 0, "bit 0 (maxWithdraw) must be set");
    }

    function test_deviationFlags_bit1_maxRedeemUnderReports() public view {
        uint256 flags = vault.erc4626DeviationFlags();
        assertTrue((flags & (uint256(1) << 1)) != 0, "bit 1 (maxRedeem) must be set");
    }

    /// Bits 2..255 are reserved per the shared convention doc and MUST be
    /// zero on this vault.
    function test_deviationFlags_reservedBitsAreZero() public view {
        uint256 flags = vault.erc4626DeviationFlags();
        // Mask everything above bit 1.
        uint256 reserved = flags & ~uint256(0x3);
        assertEq(reserved, 0, "reserved bits must be zero on AjnaERC4626Vault");
    }

    /// Named constants on the vault must match the bit positions documented
    /// in `docs/contracts/ERC4626_DEVIATION_FLAGS.md`.
    function test_deviationFlags_namedConstants() public view {
        assertEq(vault.DEVIATION_MAX_WITHDRAW_UNDER_REPORTS(), uint256(1) << 0);
        assertEq(vault.DEVIATION_MAX_REDEEM_UNDER_REPORTS(),   uint256(1) << 1);
    }

    // -----------------------------------------------------------------
    // Convenience getter
    // -----------------------------------------------------------------

    function test_hasConservativeMaxWithdraw_true() public view {
        assertTrue(vault.hasConservativeMaxWithdraw(), "AjnaERC4626Vault under-reports by design");
    }

    /// Convenience getter and bitmap must agree: if either bit 0 or bit 1 is
    /// set then `hasConservativeMaxWithdraw()` must be true.
    function test_convenienceFlag_agreesWithBitmap() public view {
        uint256 flags = vault.erc4626DeviationFlags();
        bool bitmapSaysConservative = (flags & uint256(0x3)) != 0;
        assertEq(
            vault.hasConservativeMaxWithdraw(),
            bitmapSaysConservative,
            "hasConservativeMaxWithdraw must agree with bits 0/1 of the bitmap"
        );
    }

    // -----------------------------------------------------------------
    // Coexistence with isPartialWithdrawVault (existing flag, kept for
    // backward compatibility).
    // -----------------------------------------------------------------

    function test_isPartialWithdrawVault_still_true() public view {
        assertTrue(vault.isPartialWithdrawVault(), "isPartialWithdrawVault must remain true for back-compat");
    }
}

// -----------------------------------------------------------------
// Minimal asset mock — deliberately under-scoped (no balances needed for
// deviation-flag tests). Named with a leading underscore to mark "local
// to this test file" and avoid collisions with the project-wide MockERC20.
// -----------------------------------------------------------------
contract _MockERC20 is ERC20 {
    constructor(string memory n, string memory s) ERC20(n, s) {}
}

// -----------------------------------------------------------------
// Minimal pool mock: only the accessors the constructor touches need real
// returns. Everything else reverts so accidental call paths get surfaced.
// -----------------------------------------------------------------
contract _MockAjnaPool is IAjnaPool {
    IERC20 internal immutable _quote;

    constructor(IERC20 quote_) { _quote = quote_; }

    function quoteTokenAddress() external view returns (address) { return address(_quote); }

    // ---- required by IAjnaPool but unused in these tests ----
    function addQuoteToken(uint256, uint256, uint256) external pure returns (uint256, uint256) { revert("ns"); }
    function drawDebt(address, uint256, uint256, uint256) external pure { revert("ns"); }
    function repayDebt(address, uint256, uint256, address, uint256) external pure returns (uint256) { revert("ns"); }
    function removeQuoteToken(uint256, uint256) external pure returns (uint256, uint256) { revert("ns"); }
    function moveQuoteToken(uint256, uint256, uint256, uint256) external pure returns (uint256, uint256, uint256) { revert("ns"); }
    function lenderInfo(uint256, address) external pure returns (uint256, uint256) { return (0, 0); }
    function bucketInfo(uint256) external pure returns (uint256, uint256, uint256, uint256, uint256) { return (0, 0, 0, 0, 1e18); }
    function borrowerInfo(address) external pure returns (uint256, uint256, uint256) { return (0, 0, 0); }
    function inflatorInfo() external pure returns (uint256, uint256) { return (1e18, 0); }
    function collateralAddress() external pure returns (address) { return address(0); }
    function poolUtilization() external pure returns (uint256) { return 0; }
    function interestRate() external pure returns (uint256) { return 0; }
}
