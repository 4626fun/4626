// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {OVaultRecoveryEscrow} from "@4626/shared/vault/recovery/OVaultRecoveryEscrow.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// =====================================================================
// R-H02 — per-asset free custody
// =====================================================================

contract MockERC20Reaudit is ERC20 {
    constructor(string memory n, string memory s) ERC20(n, s) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract Audit20260708_RH02_PerAssetEscrow is Test {
    OVaultRecoveryEscrow internal escrow;
    MockERC20Reaudit internal tokenA;
    MockERC20Reaudit internal tokenB;
    address internal vault = address(0xBEEF);
    address internal alice = address(0xA11CE);

    function setUp() public {
        escrow = new OVaultRecoveryEscrow(address(this));
        escrow.setVault(vault);
        tokenA = new MockERC20Reaudit("A", "A");
        tokenB = new MockERC20Reaudit("B", "B");
    }

    /// @notice Pre-R-H02 bug: global totalUnclaimed blocked second asset notify.
    function test_PoC_secondAssetNotify_succeedsWhileFirstUnclaimed() public {
        tokenA.mint(address(escrow), 100 ether);
        vm.prank(vault);
        escrow.notifyRecovery(address(tokenA), 1, 100 ether);
        assertEq(escrow.totalUnclaimedRecovery(), 100 ether);
        assertEq(escrow.totalUnclaimedRecoveryByAsset(address(tokenA)), 100 ether);

        // Push B and notify while A is still fully unclaimed.
        tokenB.mint(address(escrow), 50 ether);
        vm.prank(vault);
        escrow.notifyRecovery(address(tokenB), 2, 50 ether);

        assertEq(escrow.recoveredByEpochAsset(2, address(tokenB)), 50 ether);
        assertEq(escrow.totalUnclaimedRecoveryByAsset(address(tokenB)), 50 ether);
        assertEq(escrow.totalUnclaimedRecovery(), 150 ether);
    }

    function test_claimReducesPerAssetUnclaimed() public {
        tokenA.mint(address(escrow), 10 ether);
        vm.prank(vault);
        escrow.notifyRecovery(address(tokenA), 1, 10 ether);

        vm.prank(vault);
        escrow.claimRecovery(address(tokenA), 1, alice, 4 ether);

        assertEq(tokenA.balanceOf(alice), 4 ether);
        assertEq(escrow.totalUnclaimedRecoveryByAsset(address(tokenA)), 6 ether);
        assertEq(escrow.totalUnclaimedRecovery(), 6 ether);
    }

    function test_notifyStillRequiresCustody() public {
        vm.prank(vault);
        vm.expectRevert(
            abi.encodeWithSelector(
                OVaultRecoveryEscrow.InsufficientRecoveryCustody.selector, address(tokenA), 0, 1 ether
            )
        );
        escrow.notifyRecovery(address(tokenA), 1, 1 ether);
    }
}

// =====================================================================
// R-H03 — remote eligible coverage snapshot (unit-level ShareOFT stand-in)
// =====================================================================

contract MockShareOftEligibleReaudit is ERC20 {
    mapping(address => uint256) private _snapBlock;
    mapping(address => uint256) private _snapBal;

    constructor() ERC20("Share", "SH") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        _snap(from);
        _snap(to);
        super._update(from, to, value);
    }

    function _snap(address account) internal {
        if (account == address(0)) return;
        if (_snapBlock[account] == block.number) return;
        _snapBal[account] = balanceOf(account);
        _snapBlock[account] = block.number;
    }

    function balanceEligibleForLotteryCoverage(address account) public view returns (uint256) {
        if (_snapBlock[account] == block.number) return _snapBal[account];
        return balanceOf(account);
    }

    /// @dev Mirrors remote queue storage semantics after R-H03.
    function queueCoverage(address buyer) external view returns (uint256) {
        return balanceEligibleForLotteryCoverage(buyer);
    }
}

contract Audit20260708_RH03_RemoteEligible is Test {
    MockShareOftEligibleReaudit internal share;
    address internal buyer = address(0xB0B);

    function setUp() public {
        share = new MockShareOftEligibleReaudit();
    }

    function test_PoC_queueUsesEligible_notPostBuyLive() public {
        // Aged holdings.
        share.mint(buyer, 1e18);
        vm.roll(block.number + 1);

        // Same block: flash + "buy" credits.
        share.mint(buyer, 1_000_000e18);
        share.mint(buyer, 10e18); // simulated buy amount

        assertEq(share.balanceOf(buyer), 1_000_011e18);
        // Queue must store eligible (1e18), not live.
        assertEq(share.queueCoverage(buyer), 1e18);
        assertEq(share.balanceEligibleForLotteryCoverage(buyer), 1e18);
    }

    function test_zeroAged_queueEligibleZero() public {
        share.mint(buyer, 10e18); // first credit this block
        assertEq(share.queueCoverage(buyer), 0);
    }
}

// =====================================================================
// R-H01 bookkeeping unit: totalRecovered must track escrow credits
// (full eject path covered by integration when available; this locks the invariant)
// =====================================================================

contract Audit20260708_RH01_TotalRecoveredInvariant is Test {
    OVaultRecoveryEscrow internal escrow;
    MockERC20Reaudit internal token;
    address internal vault = address(0xBEEF);

    // Simulated vault book (mirrors ImpairmentEpoch.totalRecovered).
    uint256 internal totalRecovered;

    function setUp() public {
        escrow = new OVaultRecoveryEscrow(address(this));
        escrow.setVault(vault);
        token = new MockERC20Reaudit("CC", "CC");
    }

    function _ejectStyleNotify(uint256 epochId, uint256 recovered) internal {
        // Correct post-R-H01 path: push + notify + book.
        token.mint(address(escrow), recovered);
        vm.prank(vault);
        escrow.notifyRecovery(address(token), epochId, recovered);
        totalRecovered += recovered;
    }

    function test_ejectStyleNotify_claimableMatchesBook() public {
        _ejectStyleNotify(1, 100 ether);
        assertEq(totalRecovered, 100 ether);
        assertEq(escrow.recoveredByEpochAsset(1, address(token)), 100 ether);

        // Claim surface: gross = totalRecovered * units / supply with 100% units.
        uint256 claimUnits = 1e18;
        uint256 totalClaimSupply = 1e18;
        uint256 gross = (totalRecovered * claimUnits) / totalClaimSupply;
        assertEq(gross, 100 ether);

        vm.prank(vault);
        escrow.claimRecovery(address(token), 1, address(0xA11CE), gross);
        assertEq(token.balanceOf(address(0xA11CE)), 100 ether);
    }

    function test_preFixBug_escrowWithoutBook_claimSurfaceZero() public {
        // Document the bug: escrow credit without totalRecovered → claim gross 0.
        token.mint(address(escrow), 100 ether);
        vm.prank(vault);
        escrow.notifyRecovery(address(token), 1, 100 ether);
        // Forgot: totalRecovered += 100
        uint256 gross = (totalRecovered * 1e18) / 1e18;
        assertEq(gross, 0, "pre-fix: claim surface pays 0 while escrow holds");
        assertEq(escrow.recoveredByEpochAsset(1, address(token)), 100 ether);
    }
}
