// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../contracts/vault/CreatorOVault.sol";
import {CreatorOVaultAdminModule} from "../contracts/vault/modules/CreatorOVaultAdminModule.sol";
import {CreatorOVaultCoreModule} from "../contracts/vault/modules/CreatorOVaultCoreModule.sol";
import {CreatorOVaultStrategiesModule} from "../contracts/vault/modules/CreatorOVaultStrategiesModule.sol";

contract MockCreatorCoinModuleIdentity is ERC20 {
    constructor() ERC20("Creator Coin", "CR8R") {}
}

contract MockNoModuleIdentity {
    function ping() external pure returns (bool) {
        return true;
    }
}

contract CreatorOVaultModuleIdentityTest is Test {
    MockCreatorCoinModuleIdentity internal creatorCoin;
    CreatorOVault internal vault;

    address internal coreModule;
    address internal strategiesModule;
    address internal adminModule;

    function setUp() public {
        creatorCoin = new MockCreatorCoinModuleIdentity();
        vault = new CreatorOVault(address(creatorCoin), address(this), "Creator OVault", "ovCR8R");

        coreModule = address(new CreatorOVaultCoreModule());
        strategiesModule = address(new CreatorOVaultStrategiesModule());
        adminModule = address(new CreatorOVaultAdminModule());
    }

    function test_SetModulesOnce_AcceptsExpectedModuleKinds() external {
        vault.setModulesOnce(coreModule, strategiesModule, adminModule);
    }

    function test_SetModulesOnce_RevertsWhenModuleKindsAreSwapped() external {
        vm.expectRevert(CreatorOVault.InvalidModuleAddress.selector);
        vault.setModulesOnce(strategiesModule, coreModule, adminModule);
    }

    function test_SetModulesOnce_RevertsWhenModulesLackIdentitySurface() external {
        address mockA = address(new MockNoModuleIdentity());
        address mockB = address(new MockNoModuleIdentity());
        address mockC = address(new MockNoModuleIdentity());

        vm.expectRevert(CreatorOVault.InvalidModuleAddress.selector);
        vault.setModulesOnce(mockA, mockB, mockC);
    }
}
