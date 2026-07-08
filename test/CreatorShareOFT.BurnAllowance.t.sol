// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import "@4626/creator/vault/CreatorShareOFT.sol";

/**
 * @title CreatorShareOFT Burn Allowance Regression (Aristotle L-1)
 * @notice FIX: L-1 (docs/audits/CreatorOVault_aristotle) — `owner()` used to share the
 *         vault's allowance-free burn exemption, so the owner key alone could destroy
 *         any holder's shares with no approval and no holder-side signal. `owner()` now
 *         goes through the same `_spendAllowance` path as any other minter; only the
 *         vault (trusted custodian of accounting) remains unconditionally exempt.
 */
contract MockRegistryForBurnAllowance {
    function getLayerZeroEndpoint(uint256) external pure returns (address) {
        return address(0x1a44076050125825900e736c501f859c50fE728c);
    }

    function getEidForChainId(uint256) external pure returns (uint32) {
        return 30184;
    }

    function getLotteryManager(uint256) external pure returns (address) {
        return address(0);
    }
}

contract CreatorShareOFTBurnAllowanceTest is Test {
    CreatorShareOFT public shareOFT;
    MockRegistryForBurnAllowance public registry;

    address public owner = address(0x1);
    address public vaultAddr = address(0x2);
    address public holder = address(0x3);

    address constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    function setUp() public {
        registry = new MockRegistryForBurnAllowance();

        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(owner));

        vm.prank(owner);
        shareOFT = new CreatorShareOFT("Test Share", "sTEST", address(registry), owner);

        vm.startPrank(owner);
        shareOFT.setVault(vaultAddr);
        shareOFT.mint(holder, 1_000 ether);
        vm.stopPrank();
    }

    /// Owner must NOT be able to burn a holder's shares without an allowance.
    function test_ownerCannotBurnWithoutAllowance() public {
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, owner, 0, 100 ether)
        );
        shareOFT.burn(holder, 100 ether);
    }

    /// Once the holder grants an allowance to the owner, the owner can burn up to that
    /// amount (and it is decremented like a normal `_spendAllowance` call) — this is the
    /// intended "opt-in" path replacing the old blanket exemption.
    function test_ownerCanBurnWithExplicitAllowance() public {
        vm.prank(holder);
        shareOFT.approve(owner, 100 ether);

        vm.prank(owner);
        shareOFT.burn(holder, 60 ether);

        assertEq(shareOFT.balanceOf(holder), 940 ether);
        assertEq(shareOFT.allowance(holder, owner), 40 ether);
    }

    /// The vault remains unconditionally exempt from the allowance check (unchanged
    /// trusted-custodian behavior — vault-driven burns are part of normal
    /// deposit/withdraw/unwrap accounting, not an arbitrary third-party action).
    function test_vaultCanStillBurnWithoutAllowance() public {
        vm.prank(vaultAddr);
        shareOFT.burn(holder, 250 ether);

        assertEq(shareOFT.balanceOf(holder), 750 ether);
    }

    /// A registered minter (neither vault nor owner) must still require an allowance —
    /// unchanged H-3 behavior, kept here as a control case alongside the L-1 fix.
    function test_minterCannotBurnWithoutAllowance() public {
        address minter = address(0x4);
        vm.prank(owner);
        shareOFT.setMinter(minter, true);

        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, minter, 0, 1 ether)
        );
        shareOFT.burn(holder, 1 ether);
    }
}
