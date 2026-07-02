// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {VaultActivationBatcher} from "../contracts/helpers/batchers/VaultActivationBatcher.sol";

contract MockCreatorToken is ERC20 {
    constructor() ERC20("Creator", "CR") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockActivationRegistry {
    mapping(address => address) internal _vaultFor;
    mapping(address => address) internal _wrapperFor;

    function setRouting(address creatorToken, address vault, address wrapper) external {
        _vaultFor[creatorToken] = vault;
        _wrapperFor[creatorToken] = wrapper;
    }

    function getVaultForToken(address creatorToken) external view returns (address) {
        return _vaultFor[creatorToken];
    }

    function getWrapperForToken(address creatorToken) external view returns (address) {
        return _wrapperFor[creatorToken];
    }
}

contract VaultActivationBatcherRegistryValidationTest is Test {
    VaultActivationBatcher internal batcher;
    MockActivationRegistry internal registry;
    MockCreatorToken internal creatorToken;

    address internal canonicalVault = makeAddr("canonicalVault");
    address internal canonicalWrapper = makeAddr("canonicalWrapper");
    address internal rogueVault = makeAddr("rogueVault");
    address internal rogueWrapper = makeAddr("rogueWrapper");
    address internal ccaStrategy = makeAddr("ccaStrategy");
    address internal user = makeAddr("user");

    uint256 internal constant DEPOSIT = 1_000e18;

    function setUp() public {
        registry = new MockActivationRegistry();
        batcher = new VaultActivationBatcher(makeAddr("permit2"), address(registry));
        creatorToken = new MockCreatorToken();

        registry.setRouting(address(creatorToken), canonicalVault, canonicalWrapper);
        creatorToken.mint(user, DEPOSIT);
    }

    function test_batchActivate_revertsOnVaultRegistryMismatch() public {
        vm.startPrank(user);
        creatorToken.approve(address(batcher), DEPOSIT);
        vm.expectRevert(
            abi.encodeWithSelector(
                VaultActivationBatcher.VaultRegistryMismatch.selector, canonicalVault, rogueVault
            )
        );
        batcher.batchActivate(
            address(creatorToken), rogueVault, canonicalWrapper, ccaStrategy, DEPOSIT, 0, 0
        );
        vm.stopPrank();
    }

    function test_batchActivate_revertsOnWrapperRegistryMismatch() public {
        vm.startPrank(user);
        creatorToken.approve(address(batcher), DEPOSIT);
        vm.expectRevert(
            abi.encodeWithSelector(
                VaultActivationBatcher.WrapperRegistryMismatch.selector, canonicalWrapper, rogueWrapper
            )
        );
        batcher.batchActivate(
            address(creatorToken), canonicalVault, rogueWrapper, ccaStrategy, DEPOSIT, 0, 0
        );
        vm.stopPrank();
    }

    function test_batchActivateWithReserve_revertsOnRegistryMismatch() public {
        vm.startPrank(user);
        creatorToken.approve(address(batcher), DEPOSIT);
        vm.expectRevert(
            abi.encodeWithSelector(
                VaultActivationBatcher.VaultRegistryMismatch.selector, canonicalVault, rogueVault
            )
        );
        batcher.batchActivateWithReserve(
            address(creatorToken),
            rogueVault,
            canonicalWrapper,
            ccaStrategy,
            DEPOSIT,
            0,
            0,
            address(0),
            0
        );
        vm.stopPrank();
    }
}
