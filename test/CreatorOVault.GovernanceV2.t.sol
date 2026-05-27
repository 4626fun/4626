// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {CreatorOVault} from "../contracts/vault/CreatorOVault.sol";
import {CreatorOVaultAdminModule} from "../contracts/vault/modules/CreatorOVaultAdminModule.sol";
import {CreatorOVaultCoreModule} from "../contracts/vault/modules/CreatorOVaultCoreModule.sol";
import {CreatorOVaultStrategiesModule} from "../contracts/vault/modules/CreatorOVaultStrategiesModule.sol";
import {CreatorOVaultLiquidityLib} from "../contracts/vault/libraries/CreatorOVaultLiquidityLib.sol";

contract MockCreatorCoinV2 is ERC20 {
    constructor() ERC20("Creator Coin", "CR8R") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract CreatorOVaultGovernanceV2Test is Test {
    uint256 internal constant INITIAL_DEPOSIT = 50_000_000e18;

    MockCreatorCoinV2 internal creatorCoin;
    CreatorOVault internal vault;

    address internal alice = makeAddr("alice");

    function setUp() public {
        creatorCoin = new MockCreatorCoinV2();
        vault = new CreatorOVault(address(creatorCoin), address(this), "Creator OVault", "ovCR8R");

        address coreModule = address(new CreatorOVaultCoreModule());
        address strategiesModule = address(new CreatorOVaultStrategiesModule());
        address adminModule = address(new CreatorOVaultAdminModule());
        vault.setModulesOnce(coreModule, strategiesModule, adminModule);

        vault.setFlashLoanProtection(0, 1e18, 2);

        creatorCoin.mint(alice, INITIAL_DEPOSIT);
        vm.prank(alice);
        creatorCoin.approve(address(vault), type(uint256).max);
        vm.prank(alice);
        vault.deposit(INITIAL_DEPOSIT, alice);

        vault.setProfitMaxUnlockTime(0);
        vault.report();
        vault.setProfitMaxUnlockTime(7 days);
    }

    function test_liquiditySnapshot_reportsIdleInstantBps() public view {
        CreatorOVaultLiquidityLib.LiquiditySnapshot memory snap = vault.liquiditySnapshot();
        assertEq(snap.totalAssets, vault.totalAssets());
        assertEq(snap.idleAssets, vault.coinBalance());
        assertGt(snap.instantIdleBps, 0);
        assertEq(snap.strategies.length, vault.strategyCount());
    }

    function test_riskTimelock_schedulesAndExecutesPerformanceFee() public {
        vault.setRiskConfigDelay(1 days);
        vault.scheduleSetPerformanceFee(100);

        (uint8 kind,,, uint64 unlock) = (
            vault.pendingRiskKind(), vault.pendingRiskTarget(), vault.pendingRiskValue(), vault.pendingRiskUnlockTime()
        );
        assertEq(kind, 1);
        assertEq(unlock, block.timestamp + 1 days);

        vm.warp(unlock);
        vault.executePendingRiskConfig();
        assertEq(vault.performanceFee(), 100);
        assertEq(vault.pendingRiskKind(), 0);
    }

    function test_managementFee_accruesOnReport() public {
        address recipient = makeAddr("mgmtRecipient");
        vault.setManagementFeeRecipient(recipient);
        vault.scheduleSetManagementFee(200);

        uint256 sharesBefore = vault.balanceOf(recipient);
        skip(30 days);
        vault.report();
        assertGt(vault.balanceOf(recipient), sharesBefore, "management fee minted shares");
    }

    function test_permit_approvesSpender() public {
        uint256 ownerKey = 0xA11CE;
        address owner = vm.addr(ownerKey);
        address spender = makeAddr("spender");
        uint256 value = 1e18;
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = vault.nonces(owner);

        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                owner,
                spender,
                value,
                nonce,
                deadline
            )
        );

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", vault.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerKey, digest);
        vault.permit(owner, spender, value, deadline, v, r, s);

        assertEq(vault.allowance(owner, spender), value);
    }
}
