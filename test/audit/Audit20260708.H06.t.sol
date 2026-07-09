// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {CreatorShareOFT} from "@4626/creator/vault/CreatorShareOFT.sol";

contract MockVaultSharesH06 is ERC20 {
    constructor() ERC20("Vault Shares", "vSH") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockRegistryH06 {
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

/// @notice H-06 — unbacked ShareOFT mint must be blocked when vault+wrapper are configured.
contract Audit20260708_H06_ShareOftBacking is Test {
    CreatorShareOFT internal shareOFT;
    MockVaultSharesH06 internal vaultShares;
    address internal owner = address(this);
    address internal wrapper = address(0xA11CE);
    address internal minter = address(0xB0B);
    address internal recipient = address(0xBEEF);
    address constant LZ = 0x1a44076050125825900e736c501f859c50fE728c;

    function setUp() public {
        vm.mockCall(LZ, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ, abi.encodeWithSignature("delegate()"), abi.encode(owner));

        vaultShares = new MockVaultSharesH06();
        MockRegistryH06 registry = new MockRegistryH06();
        shareOFT = new CreatorShareOFT("Share", "sTEST", address(registry), owner);
        shareOFT.setVault(address(vaultShares));
        shareOFT.setWrapper(wrapper);
        shareOFT.setMinter(minter, true);
    }

    function test_ownerCannotMintWithoutMinterRole() public {
        vm.expectRevert(CreatorShareOFT.OnlyVaultOrMinter.selector);
        shareOFT.mint(recipient, 1 ether);
    }

    function test_minterCannotMintUnbackedWhenWrapperConfigured() public {
        // No vault shares on wrapper → any mint is unbacked.
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(CreatorShareOFT.UnbackedShareMint.selector, 0, 1 ether * 1000));
        shareOFT.mint(recipient, 1 ether);
    }

    function test_minterCanMintWhenWrapperHoldsBacking() public {
        uint256 oftAmount = 5 ether;
        vaultShares.mint(wrapper, oftAmount * shareOFT.VAULT_SHARE_NORMALIZATION());

        vm.prank(minter);
        shareOFT.mint(recipient, oftAmount);

        assertEq(shareOFT.balanceOf(recipient), oftAmount);
        assertEq(shareOFT.totalSupply(), oftAmount);
    }

    function test_cannotClearWrapperWhileSupplyExists() public {
        vaultShares.mint(wrapper, 1 ether * 1000);
        vm.prank(minter);
        shareOFT.mint(recipient, 1 ether);

        vm.expectRevert(CreatorShareOFT.WrapperRequiredWhileSupplyExists.selector);
        shareOFT.setWrapper(address(0));
    }

    function test_mintWithoutWrapperSkipsBackingCheck() public {
        // Fresh OFT with vault set but no wrapper (bootstrap / remote style).
        MockRegistryH06 registry = new MockRegistryH06();
        CreatorShareOFT bare = new CreatorShareOFT("Bare", "bSHARE", address(registry), owner);
        bare.setVault(address(vaultShares));
        bare.setMinter(minter, true);

        vm.prank(minter);
        bare.mint(recipient, 10 ether);
        assertEq(bare.totalSupply(), 10 ether);
    }
}
